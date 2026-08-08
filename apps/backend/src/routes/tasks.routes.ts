import { Router } from 'express';
import {
  getTasks, getTaskById, createTask, updateTask, deleteTask,
  addComment, getTasksByProject, getTaskEstimate,
  getTaskMaterialCheck,
} from '../controllers/tasks.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getTasks);
router.get('/project/:projectId', getTasksByProject);
router.post('/estimate', getTaskEstimate);
router.get('/:id', getTaskById);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/comments', addComment);
router.get('/:id/material-check', getTaskMaterialCheck);

export default router;