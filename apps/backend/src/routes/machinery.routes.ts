import { Router } from 'express';
import {
  getMachineryLogs, createMachineryLog, deleteMachineryLog,
  getMachinerySummary, transferMachineryToExpense,updateMachineryLog
} from '../controllers/machinery.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);
router.get('/logs', getMachineryLogs);

router.post('/logs', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), createMachineryLog);

router.put('/logs/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), updateMachineryLog);
router.delete('/logs/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), deleteMachineryLog);

router.get('/summary', getMachinerySummary);
router.post('/transfer', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), transferMachineryToExpense);

export default router;