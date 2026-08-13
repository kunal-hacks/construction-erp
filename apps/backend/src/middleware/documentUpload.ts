import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { buildUploadDir, ensureDir } from '../utils/uploadPaths';

// Maps internal module keys (used in the DB, API calls, and frontend
// MODULE_LABELS) to the exact folder name used on disk. Keep this list in
// sync with the six fixed filters on the Documents page.
const MODULE_FOLDER_NAMES: Record<string, string> = {
  expenses: 'Expenses',
  'truck-entries': 'Truck Entries',
  machinery: 'Machinery',
  documents: 'Documents',
  'purchase-orders': 'Purchase Orders',
  quotations: 'Quotations',
};

const storage = multer.diskStorage({
  destination: async (req: any, _file, cb) => {
    try {
      const { projectId, module } = req.body;
      let projectName = 'General'; // project-less uploads land here

      if (projectId) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return cb(new Error('Invalid project'), '');
        projectName = project.name;
      }

      const moduleFolder = MODULE_FOLDER_NAMES[module] || module;
      const dir = buildUploadDir(projectName, moduleFolder);
      ensureDir(dir); // creates project + module folders on first use
      cb(null, dir);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const documentUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});
