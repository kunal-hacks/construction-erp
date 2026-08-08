import { Router } from 'express';
import { getAdminDashboard, getExpenseAnalytics, getInventoryAnalytics, getBudgetAnalysis, getMachineryAnalytics } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/dashboard', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), getAdminDashboard);
router.get('/expenses', getExpenseAnalytics);
router.get('/inventory', getInventoryAnalytics);
router.get('/budget', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), getBudgetAnalysis);
router.get('/machinery', getMachineryAnalytics);

export default router;