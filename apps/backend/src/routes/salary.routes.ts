import { Router } from 'express';
import { getSalaries, generateSalary, processSalaryPayment, payWorkerSalary, getWorkerSalarySummary, payTempWorkerSalary, getTempWorkerSalarySummary } from '../controllers/salary.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

// Must come BEFORE '/:id/pay' — otherwise Express matches "workers" as the
// :id parameter and swallows these requests into processSalaryPayment.
router.get('/workers/summary', getWorkerSalarySummary);
router.post('/workers/pay', payWorkerSalary);
router.get('/workers/temp-summary', getTempWorkerSalarySummary);   // NEW
router.post('/workers/temp-pay', payTempWorkerSalary); 

router.get('/', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), getSalaries);
router.post('/generate', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), generateSalary);
router.post('/:id/pay', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), processSalaryPayment);

export default router;