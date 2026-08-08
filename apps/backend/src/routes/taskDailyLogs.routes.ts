import { Router } from 'express';
import { getTaskDailyLogs, createTaskDailyLog, reviewTask } from '../controllers/taskDailyLogs.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', getTaskDailyLogs);
router.post('/', createTaskDailyLog);
router.post('/review', authorize(Role.SUPER_ADMIN, Role.ADMIN), reviewTask);

export default router;