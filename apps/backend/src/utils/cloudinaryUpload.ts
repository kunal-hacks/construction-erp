import cloudinary from '../config/cloudinary';
import { Readable } from 'stream';
import { logger } from './logger';

interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format?: string;
  bytes: number;
}

// Streams a buffer (from multer memoryStorage) straight to Cloudinary —
// no temp file on disk, so it works the same on any host, including
// read-only filesystems on some hosting platforms.
export const uploadBufferToCloudinary = (
  buffer: Buffer,
  options: { folder: string; resourceType?: 'image' | 'video' | 'raw' | 'auto' }
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType || 'auto',
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          logger.error('Cloudinary upload error:', error);
          reject(error || new Error('Cloudinary upload failed'));
          return;
        }
        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    // Best-effort — don't fail the request just because cleanup failed
  }
};

// Maps a mimetype to the Cloudinary resource_type it needs to upload as.
export const getCloudinaryResourceType = (mimetype: string): 'image' | 'video' | 'raw' => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw'; // pdf, docx, xlsx, etc.
};