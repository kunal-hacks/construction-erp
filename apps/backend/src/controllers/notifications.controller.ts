import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '10' } = req.query;
    const take = parseInt(pageSize as string, 10);
    const skip = (parseInt(page as string, 10) - 1) * take;
    const { isRead } = req.query;

    const where: Record<string, unknown> = { userId: req.user!.id };
    if (isRead !== undefined) where.isRead = isRead === 'true';

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);

    sendSuccess(res, { notifications, unreadCount }, 'Success', 200, {
      total,
      page: parseInt(page as string, 10),
      pageSize: take,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    sendError(res, 'Failed to fetch notifications', 500);
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // findFirst + update since Prisma doesn't allow compound where with non-unique fields in update()
    const notif = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!notif) {
      sendError(res, 'Notification not found', 404);
      return;
    }

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    sendSuccess(res, null, 'Notification marked as read');
  } catch (error) {
    sendError(res, 'Failed to update notification', 500);
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) {
    sendError(res, 'Failed to update notifications', 500);
  }
};