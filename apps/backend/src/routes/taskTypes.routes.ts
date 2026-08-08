import { Router } from 'express';
import {
  getTaskTypes, getTaskTypeById, createTaskType, updateTaskType,
  upsertMaterialCoefficient, deleteMaterialCoefficient,
} from '../controllers/taskTypes.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', getTaskTypes);
router.get('/:id', getTaskTypeById);
router.post('/', authorize(Role.SUPER_ADMIN, Role.ADMIN), createTaskType);
router.put('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN), updateTaskType);
router.post('/:id/materials', authorize(Role.SUPER_ADMIN, Role.ADMIN), upsertMaterialCoefficient);
router.delete('/:id/materials/:coefficientId', authorize(Role.SUPER_ADMIN, Role.ADMIN), deleteMaterialCoefficient);

export default router;