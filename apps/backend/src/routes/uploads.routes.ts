import { Router } from 'express';
import { uploadFile, getFile, listUploads, getUploadModules, deleteUpload } from '../controllers/uploads.controller';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';

const router = Router();
router.use(authenticate);

router.get('/', listUploads);
router.get('/modules', getUploadModules);   // distinct modules with uploads — powers dynamic filter chips
router.get('/file/:id', getFile);           // secure view/download — access-checked
router.post('/', uploadSingle, uploadFile);
router.delete('/:id', deleteUpload);

export default router;