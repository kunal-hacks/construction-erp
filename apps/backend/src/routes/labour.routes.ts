import { Router } from 'express';
import { getLabour, createLabour, recordAttendance, getContractors, createContractor } from '../controllers/labour.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', getLabour);
router.post('/', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), createLabour);
router.post('/attendance', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), recordAttendance);
router.get('/contractors', getContractors);
router.post('/contractors', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), createContractor);

export default router;