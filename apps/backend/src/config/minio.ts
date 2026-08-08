import { Client } from 'minio';
import { config } from 'dotenv';

config();

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'construction-erp';

export const uploadFile = async (
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  folder: string = 'documents'
): Promise<string> => {
  try {
    // Create bucket if it doesn't exist
    const exists = await minioClient.bucketExists(BUCKET_NAME).catch(() => false);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME);
      console.log(`✅ MinIO Bucket '${BUCKET_NAME}' created`);
    }

    const fileName = `${folder}/${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    await minioClient.putObject(
      BUCKET_NAME,
      fileName,
      buffer,
      buffer.length,
      { 'Content-Type': mimetype }
    );

    console.log(`✅ File uploaded: ${fileName}`);
    return fileName;
  } catch (error: any) {
    console.error('❌ MinIO Upload Error:', error.message);
    throw new Error(`MinIO Upload Failed: ${error.message}`);
  }
};

export default minioClient;