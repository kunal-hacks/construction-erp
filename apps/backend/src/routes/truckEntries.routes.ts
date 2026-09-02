import { Router } from 'express';
import {
  getTruckEntries, createTruckEntry, updateTruckEntry, deleteTruckEntry,
  getTruckEntrySummary, transferTruckEntriesToExpense, importTruckEntries,
} from '../controllers/truckEntries.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', getTruckEntries);
router.get('/summary', getTruckEntrySummary);
router.post('/', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), createTruckEntry);
router.put('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), updateTruckEntry);
router.delete('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN), deleteTruckEntry);
router.post('/transfer', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), transferTruckEntriesToExpense);
router.post('/import', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), importTruckEntries);

export default router;