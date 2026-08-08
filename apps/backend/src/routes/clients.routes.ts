import { Router } from 'express';
import { getClients, createClient, updateClient } from '../controllers/misc.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', getClients);
router.post('/', authorize(Role.SUPER_ADMIN, Role.ADMIN), createClient);
router.put('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN), updateClient);

export default router;
