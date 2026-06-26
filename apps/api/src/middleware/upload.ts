import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { BadRequestError } from '../utils/errors.js';

/**
 * Secure file upload middleware — multer configuration.
 *
 * Security rules:
 * 1. Files renamed to UUID on upload — original filename NEVER stored or used
 * 2. MIME type whitelist — only allow known safe types
 * 3. Max 5MB file size — prevents storage exhaustion
 * 4. Memory storage — file stays in memory buffer, never touches disk
 *    (EXIF stripping happens before writing to R2)
 * 5. Single file upload only — prevents batch abuse
 */

/** Allowed MIME types — strict whitelist */
const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Maximum file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Multer file filter — rejects files that don't match the MIME whitelist.
 * Checks both the declared MIME type and the file extension.
 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new BadRequestError(
      `File type "${file.mimetype}" is not allowed. Accepted: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
    ));
    return;
  }

  // Double-check extension matches MIME
  const ext = path.extname(file.originalname).toLowerCase();
  const validExtensions: Record<string, string[]> = {
    'video/mp4': ['.mp4'],
    'video/webm': ['.webm'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  };

  const allowedExts = validExtensions[file.mimetype];
  if (allowedExts && !allowedExts.includes(ext)) {
    cb(new BadRequestError(
      `File extension "${ext}" does not match MIME type "${file.mimetype}"`,
    ));
    return;
  }

  cb(null, true);
};

/**
 * Configured multer instance.
 * Uses memory storage so we can strip EXIF data before saving.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Single file only
    fields: 10, // Max form fields
  },
});

/**
 * Generate a secure UUID-based filename.
 * The original filename is NEVER used — prevents path traversal and
 * information leakage through filenames.
 */
export function generateSecureFilename(mimeType: string): string {
  const uuid = crypto.randomUUID();
  const extMap: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const ext = extMap[mimeType] || '.bin';
  return `${uuid}${ext}`;
}

/** Single file upload middleware — field name: 'file' */
export const uploadSingle = upload.single('file');

/** Export constants for use in other modules */
export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
