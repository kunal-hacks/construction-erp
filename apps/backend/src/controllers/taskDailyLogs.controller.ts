import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds } from '../middleware/projectScope';
import { deductMaterialsForIncrement } from '../utils/taskProgress';

export const getTaskDailyLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const logs = await prisma.taskDailyLog.findMany({
      where: { taskId },
      include: {
        TaskDailyLogWorker: { include: { Worker: { select: { id: true, name: true, skill: true } } } },
        TaskDailyLogMaterial: { include: { Material: { select: { id: true, name: true, unit: true } } } },
      },
      orderBy: { logDate: 'desc' },
    });
    sendSuccess(res, logs);
  } catch (error) {
    logger.error('Get task daily logs error:', error);
    sendError(res, 'Failed to fetch daily logs', 500);
  }
};

// Creates one day's log — this is the single action that does everything:
// records who worked (Option A = their attendance for the day), updates
// cumulative % on the Task, and deducts material proportionally.
export const createTaskDailyLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { logDate, reportedPercent, notes, workers, materialsUsed } = req.body;

    if (!logDate || reportedPercent === undefined || !workers || workers.length === 0) {
      sendError(res, 'logDate, reportedPercent and at least one worker are required', 400);
      return;
    }
    if (logDate && new Date(logDate) > new Date()) {
      sendError(res, 'Log date cannot be in the future', 400);
      return;
    }

    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { TaskType: true } });
    if (!task) { sendNotFound(res, 'Task not found'); return; }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(task.projectId)) {
      sendError(res, 'You do not have access to this task', 403);
      return;
    }

    if (Number(reportedPercent) < task.cumulativePercent) {
      sendError(res, `Reported % (${reportedPercent}) cannot be lower than the current cumulative % (${task.cumulativePercent})`, 400);
      return;
    }

    const percentIncrement = (Number(reportedPercent) - task.cumulativePercent) / 100;

    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.taskDailyLog.create({
        data: {
          id: crypto.randomUUID(),
          taskId,
          logDate: new Date(logDate),
          reportedPercent: Number(reportedPercent),
          notes: notes || null,
          createdBy: req.user!.id,
          TaskDailyLogWorker: {
            create: workers.map((w: any) => ({
              id: crypto.randomUUID(),
              workerId: w.workerId || null,
              newWorkerName: w.newWorkerName || null,
              role: w.role,
              wageForDay: Number(w.wageForDay),
            })),
          },
          // Manual material list — only meaningful for no-standard trades
          // (Electrical etc.), per Decision #2.
          TaskDailyLogMaterial: materialsUsed && materialsUsed.length > 0 ? {
            create: materialsUsed.map((m: any) => ({
              id: crypto.randomUUID(),
              materialId: m.materialId,
              quantityUsed: Number(m.quantityUsed),
            })),
          } : undefined,
        },
        include: {
          TaskDailyLogWorker: { include: { Worker: true } },
          TaskDailyLogMaterial: { include: { Material: true } },
        },
      });

      // Standard-based trades: automatic proportional deduction
      let warnings: string[] = [];
      if (task.TaskType?.hasStandard && percentIncrement > 0) {
        warnings = await deductMaterialsForIncrement({
          tx, taskId, projectId: task.projectId, percentIncrement, createdBy: req.user!.id,
        });
      }

      // Manual trades: directly deduct whatever was listed, no % math needed
      if (materialsUsed && materialsUsed.length > 0) {
        for (const m of materialsUsed) {
          const inventoryItem = await tx.inventoryItem.findUnique({
            where: { projectId_materialId: { projectId: task.projectId, materialId: m.materialId } },
          });
          if (!inventoryItem || inventoryItem.quantity < Number(m.quantityUsed)) {
            const material = await tx.material.findUnique({ where: { id: m.materialId } });
            warnings.push(`Low stock: ${material?.name} — need ${m.quantityUsed}, only ${inventoryItem?.quantity || 0} available`);
          }
          if (inventoryItem) {
            await tx.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: { quantity: Math.max(0, inventoryItem.quantity - Number(m.quantityUsed)), updatedAt: new Date() },
            });
            await tx.stockMovement.create({
              data: {
                id: crypto.randomUUID(),
                inventoryItemId: inventoryItem.id,
                movementType: 'OUT',
                quantity: Number(m.quantityUsed),
                reference: `Task: ${task.title} (manual entry)`,
              },
            });
          }
        }
      }

      // Update the Task's cumulative % and route status.
      // 100% -> REVIEW (Admin must approve into DONE). <100% -> IN_PROGRESS.
      const newStatus = Number(reportedPercent) >= 100 ? 'REVIEW' : 'IN_PROGRESS';
      await tx.task.update({
        where: { id: taskId },
        data: { cumulativePercent: Number(reportedPercent), status: newStatus, updatedAt: new Date() },
      });

      return { log, warnings };
    });

    sendCreated(res, result, 'Daily log recorded successfully');
  } catch (error: any) {
    logger.error('Create task daily log error:', error);
    sendError(res, error.message || 'Failed to record daily log', 500);
  }
};

// Admin-only: approve a REVIEW task into DONE, or send it back to IN_PROGRESS
export const reviewTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { decision } = req.body; // 'APPROVE' | 'REVERT'

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) { sendNotFound(res, 'Task not found'); return; }
    if (task.status !== 'REVIEW') {
      sendError(res, 'Task is not currently under review', 400);
      return;
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: decision === 'APPROVE' ? 'DONE' : 'IN_PROGRESS',
        completedAt: decision === 'APPROVE' ? new Date() : null,
        updatedAt: new Date(),
      },
    });

    sendSuccess(res, updated, decision === 'APPROVE' ? 'Task approved as completed' : 'Task sent back to In Progress');
  } catch (error) {
    logger.error('Review task error:', error);
    sendError(res, 'Failed to review task', 500);
  }
};