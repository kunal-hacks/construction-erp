import { Router } from 'express';
import {
  getDailyReports, getDailyReportById, createDailyReport,
  updateDailyReport, deleteDailyReport, getWorkerOptions,
} from '../controllers/dailyReports.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getDailyReports);
router.get('/worker-options', getWorkerOptions);
router.get('/:id', getDailyReportById);
router.post('/', createDailyReport);
router.put('/:id', updateDailyReport);
router.delete('/:id', deleteDailyReport);

export default router;