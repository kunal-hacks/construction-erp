import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser, hardDeleteUser, resetUserPassword } from '../controllers/users.controller';
import { authenticate, authorize } from '../middleware/auth';
import { inviteEmailRateLimit } from '../middleware/rateLimiter';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);
router.use(authorize(Role.SUPER_ADMIN));

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', inviteEmailRateLimit, createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.delete('/:id/permanent', hardDeleteUser);
router.post('/:id/set-password', resetUserPassword);

export default router;