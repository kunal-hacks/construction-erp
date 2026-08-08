import { Router } from 'express';
import { getQuotations, createQuotation } from '../controllers/quotations.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getQuotations);
router.post('/', createQuotation);

export default router;