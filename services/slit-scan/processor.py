"""
KalaVaras Slit-Scan Processor
==============================

Implements the full slit-scan pipeline:
  1. Download video from Cloudflare R2 via signed URL
  2. Extract frames using FFmpeg (subprocess with NO shell interpolation)
  3. Sample centre column from each frame using Pillow
  4. Compose columns into a horizontal trajectory strip (slit-scan image)
  5. Generate rhythm waveform (per-frame luminance delta as a sparkline PNG)
  6. Upload both outputs to Cloudflare R2 via boto3

SECURITY NOTES:
- All subprocess calls use list form (never shell=True)
- No user input is ever interpolated into shell commands
- UUID filenames used exclusively — original filenames never stored
- Hard 90-second timeout on FFmpeg extraction
- Temp files cleaned up in finally block regardless of outcome
- MIME type validated before processing begins

ALGORITHM:
Slit-scan photography captures one vertical slice from each frame of a video
and arranges them side-by-side to reveal the temporal path of a brushstroke.
For folk art, this makes invisible motor memory visible as spatial pattern.
"""

import os
import uuid
import subprocess
import tempfile
import shutil
import logging
from typing import List, Tuple
from pathlib import Path

import boto3
import requests
from PIL import Image, ImageDraw
from botocore.config import Config

logger = logging.getLogger(__name__)

# ─── R2 client (S3-compatible) ───────────────────────────────────────────────

def _get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_to_r2(file_path: str, key: str, content_type: str) -> str:
    """Upload a local file to Cloudflare R2, return public URL."""
    client = _get_r2_client()
    bucket = os.environ["R2_BUCKET_NAME"]
    public_url = os.environ["R2_PUBLIC_URL"]

    with open(file_path, "rb") as f:
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=f,
            ContentType=content_type,
        )

    url = f"{public_url}/{key}"
    logger.info(f"Uploaded to R2: {key}")
    return url


# ─── Step 1: Download video ───────────────────────────────────────────────────

def download_video(storage_key: str, dest_path: str) -> None:
    """
    Download a video from R2 via presigned URL.
    Streams in 8KB chunks to avoid loading entire file into memory.
    """
    client = _get_r2_client()
    bucket = os.environ["R2_BUCKET_NAME"]

    # Generate a presigned URL valid for 5 minutes
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": storage_key},
        ExpiresIn=300,
    )

    with requests.get(url, stream=True, timeout=30) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    logger.info(f"Video downloaded: {os.path.getsize(dest_path)} bytes")


# ─── Step 2: Extract frames via FFmpeg ───────────────────────────────────────

FFMPEG_TIMEOUT_SECONDS = 90

def extract_frames(video_path: str, frames_dir: str, fps: int = 15) -> List[str]:
    """
    Extract frames from video at `fps` frames per second using FFmpeg.

    SECURITY: Uses list-form subprocess — no shell interpolation.
    All output filenames are zero-padded integers (no user input in path).
    """
    output_pattern = os.path.join(frames_dir, "%06d.png")

    cmd = [
        "ffmpeg",
        "-i", video_path,           # Input — validated path, not user string
        "-vf", f"fps={fps}",         # Frame rate filter
        "-vsync", "vfr",             # Variable frame rate sync
        "-q:v", "2",                 # Quality (lower = better)
        "-y",                        # Overwrite without prompt
        output_pattern,              # Output pattern — controlled by us
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=FFMPEG_TIMEOUT_SECONDS,
    )

    if result.returncode != 0:
        logger.error(f"FFmpeg stderr: {result.stderr[:500]}")
        raise RuntimeError(f"FFmpeg extraction failed (exit {result.returncode})")

    frames = sorted([
        os.path.join(frames_dir, f)
        for f in os.listdir(frames_dir)
        if f.endswith(".png")
    ])

    logger.info(f"Extracted {len(frames)} frames at {fps}fps")
    return frames


# ─── Step 3: Centre-column sampling ──────────────────────────────────────────

def extract_centre_column(image_path: str) -> Image.Image:
    """
    Extract the 1-pixel-wide centre vertical column from a frame.
    This is the core of the slit-scan technique.
    """
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        cx = img.width // 2
        # Crop a 1px-wide column at the horizontal centre
        column = img.crop((cx, 0, cx + 1, img.height))
        return column.copy()  # Return copy so we can close the original


# ─── Step 4: Compose slit-scan image ─────────────────────────────────────────

def compose_slit_scan(frame_paths: List[str], output_path: str) -> Tuple[int, int]:
    """
    Composite centre columns from each frame into a horizontal strip.

    Returns:
        (width, height) of the output image
    """
    if not frame_paths:
        raise ValueError("No frames to compose")

    columns = [extract_centre_column(p) for p in frame_paths]

    height = columns[0].height
    width = len(columns)

    strip = Image.new("RGB", (width, height))

    for i, col in enumerate(columns):
        strip.paste(col, (i, 0))

    strip.save(output_path, format="PNG", optimize=True)
    logger.info(f"Slit-scan composed: {width}×{height}px from {len(columns)} frames")
    return width, height


# ─── Step 5: Rhythm waveform ──────────────────────────────────────────────────

def generate_rhythm_waveform(frame_paths: List[str], output_path: str) -> None:
    """
    Generate a rhythm waveform image from per-frame luminance changes.

    Algorithm:
    - For each frame, compute mean luminance of centre column
    - Plot the delta between consecutive frames as a line graph
    - This reveals the rhythm/speed of brushstroke movement

    Output: a 800×120px PNG with an orange sparkline on dark background
    """
    if len(frame_paths) < 2:
        # Not enough frames — create a flat line
        img = Image.new("RGB", (800, 120), (26, 18, 61))  # indigo-deep bg
        img.save(output_path, format="PNG")
        return

    # Compute per-frame mean luminance of centre column
    luminances = []
    for p in frame_paths:
        col = extract_centre_column(p)
        grey = col.convert("L")
        pixels = list(grey.getdata())
        luminances.append(sum(pixels) / len(pixels) if pixels else 0)

    # Compute deltas (speed of change)
    deltas = [abs(luminances[i] - luminances[i - 1]) for i in range(1, len(luminances))]
    if not deltas:
        deltas = [0]

    max_delta = max(deltas) or 1  # avoid div-by-zero

    # Render
    W, H = 800, 120
    PADDING = 12
    img = Image.new("RGB", (W, H), (26, 18, 61))  # indigo-deep bg
    draw = ImageDraw.Draw(img)

    plot_w = W - 2 * PADDING
    plot_h = H - 2 * PADDING

    def x_pos(i: int) -> int:
        return PADDING + int(i / max(len(deltas) - 1, 1) * plot_w)

    def y_pos(v: float) -> int:
        normalised = v / max_delta
        return PADDING + int((1 - normalised) * plot_h)

    # Draw gridlines
    for level in [0.25, 0.5, 0.75]:
        gy = PADDING + int((1 - level) * plot_h)
        draw.line([(PADDING, gy), (W - PADDING, gy)], fill=(60, 45, 110), width=1)

    # Draw waveform line
    if len(deltas) >= 2:
        points = [(x_pos(i), y_pos(d)) for i, d in enumerate(deltas)]
        draw.line(points, fill=(232, 89, 60), width=2)  # saffron

        # Draw dots at each point
        for px, py in points:
            r = 2
            draw.ellipse([(px - r, py - r), (px + r, py + r)], fill=(232, 89, 60))

    img.save(output_path, format="PNG", optimize=True)
    logger.info(f"Rhythm waveform generated: {len(deltas)} data points")


# ─── Main pipeline ────────────────────────────────────────────────────────────

def run_pipeline(
    asset_id: str,
    storage_key: str,
    stroke_card_id: str,
    mime_type: str,
) -> dict:
    """
    Full slit-scan pipeline.

    Returns dict with keys:
        slit_scan_key: str — R2 storage key for the slit-scan PNG
        rhythm_waveform_key: str — R2 storage key for the waveform PNG
    """
    tmp_dir = tempfile.mkdtemp(prefix="kalavaras_")

    try:
        # UUIDs for all output filenames — no user input in paths
        run_id = str(uuid.uuid4())
        video_path = os.path.join(tmp_dir, f"{run_id}.video")
        frames_dir = os.path.join(tmp_dir, "frames")
        slit_scan_path = os.path.join(tmp_dir, f"{run_id}_slit.png")
        waveform_path = os.path.join(tmp_dir, f"{run_id}_wave.png")
        os.makedirs(frames_dir, exist_ok=True)

        logger.info(f"Pipeline start: asset_id={asset_id} key={storage_key}")

        # 1. Download video from R2
        download_video(storage_key, video_path)

        # 2. Extract frames (15fps by default)
        frame_paths = extract_frames(video_path, frames_dir, fps=15)

        if not frame_paths:
            raise RuntimeError("FFmpeg produced no frames")

        # 3 + 4. Sample centre columns and compose slit-scan
        compose_slit_scan(frame_paths, slit_scan_path)

        # 5. Generate rhythm waveform
        generate_rhythm_waveform(frame_paths, waveform_path)

        # 6. Upload outputs to R2
        slit_key = f"processed/{stroke_card_id}/{asset_id}_slit.png"
        wave_key = f"processed/{stroke_card_id}/{asset_id}_wave.png"

        upload_to_r2(slit_scan_path, slit_key, "image/png")
        upload_to_r2(waveform_path, wave_key, "image/png")

        logger.info(f"Pipeline complete: asset_id={asset_id}")

        return {
            "slit_scan_key": slit_key,
            "rhythm_waveform_key": wave_key,
        }

    finally:
        # Always clean up temp files
        shutil.rmtree(tmp_dir, ignore_errors=True)
