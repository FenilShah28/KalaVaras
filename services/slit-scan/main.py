"""
KalaVaras Slit-Scan Microservice — Flask API
=============================================

Exposes two endpoints:
  GET  /health    — unauthenticated health check for uptime monitoring
  POST /process   — authenticated slit-scan + rhythm waveform pipeline

Authentication:
  Every /process request must include header:
  X-Internal-Secret: <INTERNAL_SERVICE_SECRET>
  This secret is shared between the Node.js API and this service via env vars.
  Requests without a valid secret receive HTTP 401.

Error responses always use the shape:
  { "success": false, "error": "<message>" }

Processing is delegated entirely to processor.py — this file handles only
HTTP concerns (auth, validation, response shaping, error handling).
"""

import os
import logging
import time

from flask import Flask, request, jsonify
from processor import run_pipeline

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("kalavaras.slit-scan")

# ─── App ──────────────────────────────────────────────────────────────────────

app = Flask(__name__)

INTERNAL_SECRET = os.environ.get("INTERNAL_SERVICE_SECRET", "")

REQUIRED_ENV = [
    "INTERNAL_SERVICE_SECRET",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
]


def _check_env() -> list[str]:
    """Return list of missing required environment variables."""
    return [k for k in REQUIRED_ENV if not os.environ.get(k)]


def _auth() -> bool:
    """Verify X-Internal-Secret header matches the shared secret."""
    token = request.headers.get("X-Internal-Secret", "")
    # Constant-time comparison to prevent timing attacks
    import hmac
    return bool(token) and hmac.compare_digest(token, INTERNAL_SECRET)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """
    Health check — unauthenticated.
    Also reports any missing env vars so the Node.js API can detect misconfiguration.
    """
    missing = _check_env()
    status = "ok" if not missing else "misconfigured"
    code = 200 if not missing else 503

    return jsonify({
        "success": code == 200,
        "status": status,
        "service": "slit-scan",
        "timestamp": time.time(),
        "missing_env": missing,
    }), code


@app.route("/process", methods=["POST"])
def process():
    """
    Run the full slit-scan pipeline for a source video asset.

    Request body (JSON):
      {
        "asset_id":       "<uuid>",        # media_assets.id from DB
        "storage_key":    "<path>",        # R2 object key for source video
        "stroke_card_id": "<uuid>",        # parent stroke card
        "mime_type":      "video/mp4"      # validated by Node.js API before call
      }

    Response body (JSON):
      {
        "success": true,
        "slit_scan_key":       "processed/<card_id>/<asset_id>_slit.png",
        "rhythm_waveform_key": "processed/<card_id>/<asset_id>_wave.png"
      }
    """
    # ── Auth ──────────────────────────────────────────────────────────────────
    if not _auth():
        logger.warning("Unauthorized /process request from %s", request.remote_addr)
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    # ── Parse body ────────────────────────────────────────────────────────────
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "JSON body required"}), 400

    asset_id     = data.get("asset_id")
    storage_key  = data.get("storage_key")
    card_id      = data.get("stroke_card_id")
    mime_type    = data.get("mime_type", "video/mp4")

    # ── Validate required fields ──────────────────────────────────────────────
    missing = [f for f in ["asset_id", "storage_key", "stroke_card_id"] if not data.get(f)]
    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    # ── Validate MIME type (belt-and-suspenders — Node.js already checked) ────
    ALLOWED_MIMES = {"video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"}
    if mime_type not in ALLOWED_MIMES:
        return jsonify({"success": False, "error": f"Unsupported MIME type: {mime_type}"}), 422

    # ── Run pipeline ──────────────────────────────────────────────────────────
    logger.info("Processing asset_id=%s card_id=%s key=%s", asset_id, card_id, storage_key)
    t0 = time.time()

    try:
        result = run_pipeline(
            asset_id=asset_id,
            storage_key=storage_key,
            stroke_card_id=card_id,
            mime_type=mime_type,
        )
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timed out for asset_id=%s", asset_id)
        return jsonify({"success": False, "error": "Video processing timed out"}), 504
    except Exception as exc:
        logger.exception("Pipeline failed for asset_id=%s: %s", asset_id, exc)
        return jsonify({"success": False, "error": str(exc)}), 500

    elapsed = round(time.time() - t0, 2)
    logger.info("Pipeline done for asset_id=%s in %ss", asset_id, elapsed)

    return jsonify({
        "success": True,
        "slit_scan_key":       result["slit_scan_key"],
        "rhythm_waveform_key": result["rhythm_waveform_key"],
        "elapsed_seconds":     elapsed,
    }), 200


# ─── Missing import (subprocess used in error handler) ───────────────────────
import subprocess  # noqa: E402 — needed for TimeoutExpired in handler above


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    missing = _check_env()
    if missing:
        logger.warning("⚠️  Missing env vars: %s — service may not work correctly", missing)

    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    logger.info("Starting slit-scan service on port %d (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
