import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendError } from '../utils/response';
import { AuthRequest } from './auth';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Reusing AuditLog as the counter — no new table/migration needed.
export const INVITE_EMAIL_AUDIT_ACTION = 'CREATE_USER_INVITE_EMAIL';

export const inviteEmailRateLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.user!.id;
    const now = new Date();
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const weekAgo = new Date(now.getTime() - WEEK_MS);

    const [dailyCount, weeklyCount] = await Promise.all([
      prisma.auditLog.count({
        where: { userId: adminId, action: INVITE_EMAIL_AUDIT_ACTION, createdAt: { gte: dayAgo } },
      }),
      prisma.auditLog.count({
        where: { userId: adminId, action: INVITE_EMAIL_AUDIT_ACTION, createdAt: { gte: weekAgo } },
      }),
    ]);

    if (dailyCount >= 10) {
      sendError(res, 'Daily limit reached — you can create only 2 users (with invite email) per day', 429);
      return;
    }

    if (weeklyCount >= 20) {
      sendError(res, 'Weekly limit reached — you can create only 5 users (with invite email) per week', 429);
      return;
    }

    next();
  } catch (error) {
    sendError(res, 'Failed to check rate limit', 500);
  }
};