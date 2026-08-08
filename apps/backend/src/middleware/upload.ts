import multer from 'multer';
import { Request } from 'express';
import { config } from '../config/env';
import { AppError } from './errorHandler';

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
): void => {
  if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new AppError(`File type ${file.mimetype} is not allowed`, 400));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 10,
  },
});

export const uploadSingle = upload.single('file');
export const uploadMultiple = upload.array('files', 10);
export const uploadFields = (fields: { name: string; maxCount?: number }[]) => 
  upload.fields(fields);
