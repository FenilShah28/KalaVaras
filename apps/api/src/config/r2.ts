import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Cloudflare R2 client — S3-compatible API.
 *
 * R2 endpoint format: https://<account-id>.r2.cloudflarestorage.com
 * Public URL is separate (served via Cloudflare CDN or custom domain).
 *
 * Security:
 * - Credentials come exclusively from env vars (never hardcoded)
 * - Bucket is private — all access goes through signed URLs or the API
 */
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

// =====================================================================
// UPLOAD
// =====================================================================

interface UploadOptions {
  buffer: Buffer;
  key: string;
  contentType: string;
  /** Optional metadata — stored with the object in R2 */
  metadata?: Record<string, string>;
}

/**
 * Upload a buffer to Cloudflare R2.
 * Uses multipart upload for files > 5MB via @aws-sdk/lib-storage.
 * Returns the public URL of the uploaded object.
 */
export async function uploadToR2(opts: UploadOptions): Promise<string> {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: env.R2_BUCKET_NAME,
      Key: opts.key,
      Body: opts.buffer,
      ContentType: opts.contentType,
      Metadata: opts.metadata ?? {},
    },
  });

  await upload.done();

  const publicUrl = `${env.R2_PUBLIC_URL}/${opts.key}`;
  logger.info('R2 upload complete', { key: opts.key, size: opts.buffer.length, contentType: opts.contentType });

  return publicUrl;
}

// =====================================================================
// DELETE
// =====================================================================

/**
 * Delete an object from Cloudflare R2 by its storage key.
 * Called when a media asset record is deleted from the database.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );

  logger.info('R2 object deleted', { key });
}
