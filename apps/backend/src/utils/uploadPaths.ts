import path from 'path';
import fs from 'fs';

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

// Strips anything unsafe for a folder name (path separators, special
// characters) while keeping spaces, so "Sunrise Towers" stays readable
// on disk instead of becoming "Sunrise_Towers".
export function sanitizeSegment(seg: string): string {
  return seg.replace(/[\\/]/g, '-').replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
}

export function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// project name -> fixed module folder, e.g. uploads/Sunrise Towers/Expenses/
export function buildUploadDir(projectName: string, moduleFolder: string): string {
  return path.join(UPLOAD_ROOT, sanitizeSegment(projectName), sanitizeSegment(moduleFolder));
}