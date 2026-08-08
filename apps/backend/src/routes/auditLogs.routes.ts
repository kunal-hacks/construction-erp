import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLogs.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', authorize(Role.SUPER_ADMIN, Role.ADMIN), getAuditLogs);

export default router;