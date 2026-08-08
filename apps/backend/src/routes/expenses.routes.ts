import { Router } from 'express';
import { getExpenses, getExpenseById, createExpense, updateExpense, deleteExpense, getExpenseSummary } from '../controllers/expenses.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', getExpenses);
router.get('/summary', getExpenseSummary);
router.get('/:id', getExpenseById);
router.post('/', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), createExpense);
router.put('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER), updateExpense);
router.delete('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN), deleteExpense);

export default router;