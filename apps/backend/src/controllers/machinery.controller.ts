import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds } from '../middleware/projectScope';
import { createCostTransfer, getTransferredTotal, getTransferredTotalScoped } from '../utils/costTransfer';

export const getMachineryLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, search, startDate, endDate } = req.query;

    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (search) where.machineryName = { contains: search as string, mode: 'insensitive' };
    if (startDate || endDate) {
      where.logDate = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.machineryLog.findMany({
        where, skip, take,
        include: { Project: { select: { id: true, name: true } } },
        orderBy: { logDate: 'desc' },
      }),
      prisma.machineryLog.count({ where }),
    ]);

    sendPaginatedSuccess(res, logs, total, page, pageSize);
  } catch (error) {
    logger.error('Get machinery logs error:', error);
    sendError(res, 'Failed to fetch logs', 500);
  }
};

export const createMachineryLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { machineryName, projectId, logDate, hoursUsed, fuelUsed, operatorName, workDone, hourlyRate, notes } = req.body;

    if (!machineryName || !projectId || !logDate || !hoursUsed) {
      sendError(res, 'machineryName, projectId, logDate and hoursUsed are required', 400);
      return;
    }
    if (new Date(logDate) > new Date()) {
      sendError(res, 'Log date cannot be in the future', 400);
      return;
    }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, 'You do not have access to this project', 403);
      return;
    }

    const parsedHours = Number(hoursUsed);
    const parsedRate = hourlyRate !== undefined && hourlyRate !== '' ? Number(hourlyRate) : null;
    const totalCost = parsedRate !== null ? parsedHours * parsedRate : null;

    const log = await prisma.machineryLog.create({
      data: {
        id: randomUUID(),
        machineryName,
        projectId,
        logDate: new Date(logDate),
        hoursUsed: parsedHours,
        fuelUsed: fuelUsed !== undefined && fuelUsed !== '' ? Number(fuelUsed) : null,
        operatorName: operatorName || null,
        workDone: workDone || null,
        hourlyRate: parsedRate,
        totalCost,
        notes: notes || null,
      },
      include: { Project: { select: { id: true, name: true } } },
    });

    sendCreated(res, log, 'Machinery log created');
  } catch (error: any) {
    logger.error('Create machinery log error:', error);
    sendError(res, error.message || 'Failed to create log', 500);
  }
};

export const updateMachineryLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { machineryName, logDate, hoursUsed, fuelUsed, operatorName, workDone, hourlyRate, notes } = req.body;

    const existing = await prisma.machineryLog.findUnique({ where: { id } });
    if (!existing) { sendNotFound(res, 'Log entry not found'); return; }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && (!existing.projectId || !allowedProjectIds.includes(existing.projectId))) {
      sendError(res, 'You do not have access to this log entry', 403);
      return;
    }
    if (logDate && new Date(logDate) > new Date()) {
      sendError(res, 'Log date cannot be in the future', 400);
      return;
    }

    const newHours = hoursUsed !== undefined ? Number(hoursUsed) : existing.hoursUsed;
    const newRate = hourlyRate !== undefined
      ? (hourlyRate !== '' ? Number(hourlyRate) : null)
      : existing.hourlyRate;
    const totalCost = newRate !== null && newRate !== undefined ? newHours * newRate : null;

    const updated = await prisma.machineryLog.update({
      where: { id },
      data: {
        ...(machineryName && { machineryName }),
        ...(logDate && { logDate: new Date(logDate) }),
        ...(hoursUsed !== undefined && { hoursUsed: newHours }),
        ...(fuelUsed !== undefined && { fuelUsed: fuelUsed !== '' ? Number(fuelUsed) : null }),
        ...(operatorName !== undefined && { operatorName: operatorName || null }),
        ...(workDone !== undefined && { workDone: workDone || null }),
        ...(hourlyRate !== undefined && { hourlyRate: newRate }),
        totalCost,
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: { Project: { select: { id: true, name: true } } },
    });

    sendSuccess(res, updated, 'Log entry updated successfully');
  } catch (error: any) {
    logger.error('Update machinery log error:', error);
    sendError(res, error.message || 'Failed to update log', 500);
  }
};

export const deleteMachineryLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.machineryLog.findUnique({ where: { id: req.params.id } });
    if (!existing) { sendNotFound(res, 'Log entry not found'); return; }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && (!existing.projectId || !allowedProjectIds.includes(existing.projectId))) {
      sendError(res, 'You do not have access to this log entry', 403);
      return;
    }

    await prisma.machineryLog.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Log entry deleted');
  } catch (error) {
    logger.error('Delete machinery log error:', error);
    sendError(res, 'Failed to delete log', 500);
  }
};

// Same shape as Truck Entries' summary — works both scoped to one project
// and aggregated across every project the user can see.
export const getMachinerySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, startDate, endDate } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (startDate || endDate) {
      where.logDate = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [summary, logsForCost] = await Promise.all([
      prisma.machineryLog.aggregate({ where, _sum: { hoursUsed: true }, _count: { id: true } }),
      prisma.machineryLog.findMany({ where, select: { totalCost: true } }),
    ]);

    const totalCost = logsForCost.reduce((sum, l) => sum + Number(l.totalCost || 0), 0);

    const transferred = projectId && typeof projectId === 'string'
      ? await getTransferredTotal(projectId, 'machinery')
      : await getTransferredTotalScoped(allowedProjectIds, 'machinery');

    const costInfo = { totalCost, transferred, pending: totalCost - transferred };

    sendSuccess(res, { summary, costInfo });
  } catch (error) {
    logger.error('Get machinery summary error:', error);
    sendError(res, 'Failed to fetch summary', 500);
  }
};

export const transferMachineryToExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, amount, date } = req.body;
    if (!projectId || !amount || Number(amount) <= 0) {
      sendError(res, 'projectId and a positive amount are required', 400);
      return;
    }
    if (date && new Date(date) > new Date()) {
      sendError(res, 'Payment date cannot be in the future', 400);
      return;
    }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, 'You do not have access to this project', 403);
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) { sendNotFound(res, 'Project not found'); return; }

    const logs = await prisma.machineryLog.findMany({ where: { projectId }, select: { totalCost: true } });
    const totalCost = logs.reduce((sum, l) => sum + Number(l.totalCost || 0), 0);
    const transferred = await getTransferredTotal(projectId, 'machinery');
    const pending = totalCost - transferred;

    if (Number(amount) > pending) {
      sendError(res, `Amount exceeds pending balance of ₹${pending.toFixed(2)}`, 400);
      return;
    }

    const result = await createCostTransfer({
      projectId, module: 'machinery', amount: Number(amount),
      userId: req.user!.id, projectName: project.name, date,
    });

    sendCreated(res, result, 'Payment recorded successfully');
  } catch (error) {
    logger.error('Transfer machinery error:', error);
    sendError(res, 'Failed to transfer to expenses', 500);
  }
};

