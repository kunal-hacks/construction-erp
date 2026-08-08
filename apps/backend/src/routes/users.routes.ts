import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser, hardDeleteUser, resetUserPassword } from '../controllers/users.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);
router.use(authorize(Role.SUPER_ADMIN)); // entire Users module is Super-Admin-only, per your two-role model

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);           // deactivate
router.delete('/:id/permanent', hardDeleteUser); // permanent delete
router.post('/:id/reset-password', resetUserPassword);

export default router;