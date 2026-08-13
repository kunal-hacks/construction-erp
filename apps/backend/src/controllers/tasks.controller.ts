import { randomUUID } from 'crypto';
import { Response } from 'express';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds } from '../middleware/projectScope';
import { calculateTaskEstimate } from '../utils/taskCalculation';
import { previewMaterialsForIncrement } from '../utils/taskProgress';

const normalize = (task: any) => ({
  ...task,
  assignee: task.User || null,
  project: task.Project || null,
  taskType: task.TaskType || null,
  comments: (task.TaskComment || []).map((c: any) => ({ ...c, user: c.User || null })),
  _count: { comments: task._count?.TaskComment ?? 0 },
});

const TASK_TYPE_SELECT = { id: true, name: true, unit: true, hasStandard: true, dimensionFields: true };

export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, status, priority, assigneeId } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (status) where.status = status as TaskStatus;
    if (priority) where.priority = priority as TaskPriority;
    if (assigneeId) where.assigneeId = assigneeId as string;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where, skip, take,
        include: {
          User: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          Project: { select: { id: true, name: true } },
          TaskType: { select: TASK_TYPE_SELECT },
          _count: { select: { TaskComment: true } },
        },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { order: 'asc' }],
      }),
      prisma.task.count({ where }),
    ]);

    sendPaginatedSuccess(res, tasks.map(normalize), total, page, pageSize);
  } catch (error) {
    logger.error('Get tasks error:', error);
    sendError(res, 'Failed to fetch tasks', 500);
  }
};

export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        User: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        Project: { select: { id: true, name: true } },
        TaskType: { include: { MaterialCoefficient: { include: { Material: true } } } },
        TaskComment: {
          include: { User: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { TaskComment: true } },
      },
    });
    if (!task) { sendNotFound(res, 'Task not found'); return; }
    sendSuccess(res, normalize(task));
  } catch (error) {
    sendError(res, 'Failed to fetch task', 500);
  }
};

export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      projectId, title, description, status, priority, assigneeId, dueDate,
      taskTypeId, components, floorTier,
    } = req.body;

    let computedQuantity: number | null = null;
    let totalPersonDays: number | null = null;

    if (taskTypeId && components && Array.isArray(components) && components.length > 0) {
      const estimate = await calculateTaskEstimate(taskTypeId, components);
      computedQuantity = estimate.computedQuantity;
      totalPersonDays = estimate.totalPersonDays;
    }

    const task = await prisma.task.create({
      data: {
        id: randomUUID(),
        projectId,
        title,
        description: description || null,
        status: (status as TaskStatus) || TaskStatus.TODO,
        priority: (priority as TaskPriority) || TaskPriority.MEDIUM,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        taskTypeId: taskTypeId || null,
        dimensionsJson: components && components.length > 0 ? components : undefined,
        computedQuantity,
        totalPersonDays,
        floorTier: floorTier || null,
        updatedAt: new Date(),
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } },
        Project: { select: { id: true, name: true } },
        TaskType: { select: TASK_TYPE_SELECT },
        _count: { select: { TaskComment: true } },
      },
    });

    if (assigneeId && assigneeId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: assigneeId,
          title: 'New Task Assigned',
          message: `You have been assigned to task: ${title}`,
          type: 'IN_APP',
          updatedAt: new Date(),
        },
      });
    }

    let materialWarnings: any[] = [];
    if (task.taskTypeId && task.computedQuantity) {
      const preview = await previewMaterialsForIncrement({ taskId: task.id, percentIncrement: 1 });
      materialWarnings = preview.filter((m) => m.shortfall > 0);
    }

    sendCreated(res, { ...normalize(task), materialWarnings }, 'Task created successfully');
  } catch (error: any) {
    logger.error('Create task error:', error);
    sendError(res, error.message || 'Failed to create task', 500);
  }
};

// Live preview, before anything is saved.
export const getTaskEstimate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskTypeId, components } = req.body;
    if (!taskTypeId || !components) {
      sendError(res, 'taskTypeId and components are required', 400);
      return;
    }
    const estimate = await calculateTaskEstimate(taskTypeId, components);
    sendSuccess(res, estimate);
  } catch (error: any) {
    logger.error('Task estimate error:', error);
    sendError(res, error.message || 'Failed to calculate estimate', 500);
  }
};

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) { sendNotFound(res, 'Task not found'); return; }

    const {
      title, description, status, priority, assigneeId, dueDate,
      taskTypeId, components, floorTier,
    } = req.body;

    let computedQuantity: number | undefined;
    let totalPersonDays: number | undefined;

    const effectiveTaskTypeId = taskTypeId !== undefined ? taskTypeId : task.taskTypeId;
    if (components && Array.isArray(components) && components.length > 0 && effectiveTaskTypeId) {
      const estimate = await calculateTaskEstimate(effectiveTaskTypeId, components);
      computedQuantity = estimate.computedQuantity;
      totalPersonDays = estimate.totalPersonDays ?? undefined;
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status: status as TaskStatus }),
        ...(priority && { priority: priority as TaskPriority }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(taskTypeId !== undefined && { taskTypeId: taskTypeId || null }),
        ...(components && { dimensionsJson: components }),
        ...(computedQuantity !== undefined && { computedQuantity }),
        ...(totalPersonDays !== undefined && { totalPersonDays }),
        ...(floorTier !== undefined && { floorTier: floorTier || null }),
        ...(status === TaskStatus.DONE && { completedAt: new Date() }),
        updatedAt: new Date(),
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } },
        TaskType: { select: TASK_TYPE_SELECT },
        _count: { select: { TaskComment: true } },
      },
    });

    sendSuccess(res, normalize(updated), 'Task updated');
  } catch (error: any) {
    logger.error('Update task error:', error);
    sendError(res, error.message || 'Failed to update task', 500);
  }
};

export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Task deleted');
  } catch (error) {
    sendError(res, 'Failed to delete task', 500);
  }
};

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    const comment = await prisma.taskComment.create({
      data: { id: randomUUID(), taskId: req.params.id, userId: req.user!.id, content },
      include: { User: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    });
    sendCreated(res, { ...comment, user: comment.User }, 'Comment added');
  } catch (error) {
    sendError(res, 'Failed to add comment', 500);
  }
};

export const getTasksByProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(req.params.projectId)) {
      sendError(res, 'You do not have access to this project', 403);
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { projectId: req.params.projectId },
      include: {
        User: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        TaskType: { select: TASK_TYPE_SELECT },
        _count: { select: { TaskComment: true } },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const normalized = tasks.map(normalize);
    const grouped = {
      TODO: normalized.filter((t) => t.status === 'TODO'),
      IN_PROGRESS: normalized.filter((t) => t.status === 'IN_PROGRESS'),
      REVIEW: normalized.filter((t) => t.status === 'REVIEW'),
      DONE: normalized.filter((t) => t.status === 'DONE'),
      BLOCKED: normalized.filter((t) => t.status === 'BLOCKED'),
    };

    sendSuccess(res, { tasks: normalized, grouped });
  } catch (error) {
    sendError(res, 'Failed to fetch tasks', 500);
  }
};

export const getTaskMaterialCheck = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { percent } = req.query;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) { sendNotFound(res, 'Task not found'); return; }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(task.projectId)) {
      sendError(res, 'You do not have access to this task', 403);
      return;
    }

    const targetPercent = percent !== undefined ? Number(percent) : 100;
    const percentIncrement = Math.max(0, (targetPercent - task.cumulativePercent) / 100);

    const materials = await previewMaterialsForIncrement({ taskId: id, percentIncrement });

    sendSuccess(res, {
      percentIncrement: percentIncrement * 100,
      materials,
      hasShortfall: materials.some((m) => m.shortfall > 0),
    });
  } catch (error: any) {
    logger.error('Task material check error:', error);
    sendError(res, error.message || 'Failed to check materials', 500);
  }
};

