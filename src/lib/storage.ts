import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import { uploadToCloudinary, isCloudinaryConfigured, type CloudinaryUploadResult } from './cloudinary';

export interface StorageUploadResult {
  url: string;
  publicId: string;
  filename: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  width?: number;
  height?: number;
  provider: 'r2' | 'cloudinary';
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );
}

export function isStorageConfigured(): boolean {
  return isR2Configured() || isCloudinaryConfigured();
}

let s3ClientInstance: S3Client | null = null;

function getR2Client(): S3Client {
  if (s3ClientInstance) return s3ClientInstance;

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 storage credentials are not set.');
  }

  s3ClientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3ClientInstance;
}

/**
 * Uploads a file buffer directly to Cloudflare R2, falling back to Cloudinary if needed.
 */
export async function uploadFileBuffer(
  buffer: Buffer,
  options: {
    filename: string;
    mimeType: string;
    folder?: string;
  }
): Promise<StorageUploadResult> {
  const { filename, mimeType, folder = 'chat_attachments' } = options;
  const isImage = mimeType.startsWith('image/');

  // 1. Cloudflare R2 Storage (Primary)
  if (isR2Configured()) {
    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'orbat-chat-uploads';
    const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '') || (isImage ? '.jpg' : '.bin');
    const storageKey = `${folder}/${Date.now()}-${randomUUID()}${ext}`;
    const s3 = getR2Client();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const publicBase = (
      process.env.CLOUDFLARE_R2_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL ||
      `https://${bucket}.r2.dev`
    ).replace(/\/$/, '');

    const fileUrl = `${publicBase}/${storageKey}`;

    return {
      url: fileUrl,
      publicId: storageKey,
      filename,
      size: buffer.length,
      mimeType,
      isImage,
      provider: 'r2',
    };
  }

  // 2. Cloudinary Storage (Fallback)
  if (isCloudinaryConfigured()) {
    const res: CloudinaryUploadResult = await uploadToCloudinary(buffer, {
      folder,
      filename,
      resourceType: isImage ? 'image' : 'auto',
    });

    return {
      url: isImage
        ? res.secure_url.replace(/\.(heic|heif|avif|bmp|tiff?)$/i, '.jpg')
        : res.secure_url,
      publicId: res.public_id,
      filename,
      size: res.bytes || buffer.length,
      mimeType,
      isImage,
      width: res.width,
      height: res.height,
      provider: 'cloudinary',
    };
  }

  throw new Error(
    'No storage provider configured. Set CLOUDFLARE_R2 credentials in environment variables.'
  );
}

