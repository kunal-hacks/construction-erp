import { Response } from 'express';
import { prisma } from '../config/database';
import { sendError, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { userId, module, startDate, endDate } = req.query;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId as string;
    if (module) where.module = module as string;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          User: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Normalize for frontend
    const normalized = logs.map((log) => ({
      ...log,
      user: log.User,           // frontend reads log.user
      recordId: log.entityId,   // frontend reads log.recordId
      oldData: log.oldValues,   // frontend reads log.oldData
      newData: log.newValues,   // frontend reads log.newData
    }));

    sendPaginatedSuccess(res, normalized, total, page, pageSize);
  } catch (error) {
    sendError(res, 'Failed to fetch audit logs', 500);
  }
};