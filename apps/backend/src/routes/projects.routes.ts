import { Router } from 'express';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getProjectDashboard,
} from '../controllers/projects.controller';

import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.get('/:id/dashboard', getProjectDashboard);

router.post('/', authorize(Role.SUPER_ADMIN, Role.ADMIN), createProject);

router.put(
  '/:id',
  authorize(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.PROJECT_MANAGER
  ),
  updateProject
);

router.delete(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  deleteProject
);

router.post(
  '/:id/members',
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  addProjectMember
);

router.delete(
  '/:id/members/:userId',
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  removeProjectMember
);

export default router;