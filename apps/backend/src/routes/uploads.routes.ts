import { Router } from 'express';
import { uploadFile, getFile, listUploads, getUploadModules, deleteUpload } from '../controllers/uploads.controller';
import { authenticate } from '../middleware/auth';
import { documentUpload } from '../middleware/documentUpload';

const router = Router();
router.use(authenticate);

router.get('/', listUploads);
router.get('/modules', getUploadModules);   // distinct modules with uploads — powers dynamic filter chips
router.get('/file/:id', getFile);           // secure view/download — access-checked
router.post('/', documentUpload.single('file'), uploadFile);
router.delete('/:id', deleteUpload);

export default router;