import { Router } from 'express';
import { getDocuments, uploadDocument, getDocumentUrl, deleteDocument } from '../controllers/documents.controller';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';

const router = Router();
router.use(authenticate);

router.get('/', getDocuments);
router.post('/', uploadSingle, uploadDocument);
router.get('/:id/url', getDocumentUrl);
router.delete('/:id', deleteDocument);

export default router;