import { Router } from 'express';
import { getDocumentCategories, createDocumentCategory } from '../controllers/documentCategories.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/', getDocumentCategories);
router.post('/', createDocumentCategory); // any authenticated role (PM + Admin) can add — same as vendors
export default router;