import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { sendUserInviteEmail } from '../utils/mailer';
import { INVITE_EMAIL_AUDIT_ACTION } from '../middleware/rateLimiter';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { search, role, isActive } = req.query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) where.role = role as Role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, role: true, isActive: true, avatar: true,
          lastLogin: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const normalized = users.map((u) => ({ ...u, lastLoginAt: u.lastLogin }));

    sendPaginatedSuccess(res, normalized, total, page, pageSize);
  } catch (error) {
    logger.error('Get users error:', error);
    sendError(res, 'Failed to fetch users', 500);
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, isActive: true, avatar: true,
        lastLogin: true, createdAt: true,
        ProjectMember: {
          include: {
            Project: { select: { id: true, name: true, projectCode: true, status: true } },
          },
        },
      },
    });

    if (!user) { sendNotFound(res, 'User not found'); return; }

    sendSuccess(res, { ...user, lastLoginAt: user.lastLogin });
  } catch (error) {
    logger.error('Get user error:', error);
    sendError(res, 'Failed to fetch user', 500);
  }
};

// Admin no longer sets the password directly. A random, unusable placeholder
// is hashed and stored, a passwordResetToken is generated (same field the
// forgot/set-password flow already uses), and an invite email is sent so
// the new user can set their own password via POST /auth/set-password.
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, firstName, lastName, phone, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      sendError(res, 'User with this email already exists', 409);
      return;
    }

    const placeholderPassword = randomUUID() + randomUUID();
    const hashedPassword = await bcrypt.hash(placeholderPassword, 12);

    const resetToken = randomUUID();
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        phone: phone || null,
        role: role as Role,
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        updatedAt: new Date(),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, isActive: true, createdAt: true,
      },
    });

    try {
      await sendUserInviteEmail({ to: user.email, firstName: user.firstName, resetToken });
    } catch (mailError) {
      // User is still created even if the email fails — don't roll back the
      // account creation just because SMTP hiccuped.
      logger.error('Failed to send user invite email:', mailError);
    }

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        action: INVITE_EMAIL_AUDIT_ACTION,
        module: 'users',
        entityId: user.id,
        entityType: 'User',
        userId: req.user!.id,
      },
    });

    sendCreated(res, user, 'User created successfully. Invite email sent.');
  } catch (error) {
    logger.error('Create user error:', error);
    sendError(res, 'Failed to create user', 500);
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, role, isActive } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { sendNotFound(res, 'User not found'); return; }

    if (user.role === Role.SUPER_ADMIN && req.user?.role !== Role.SUPER_ADMIN) {
      sendError(res, 'Cannot modify Super Admin user', 403);
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(role && { role: role as Role }),
        ...(isActive !== undefined && { isActive: isActive === true || isActive === 'true' }),
        updatedAt: new Date(),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, isActive: true, updatedAt: true,
      },
    });

    sendSuccess(res, updatedUser, 'User updated successfully');
  } catch (error) {
    logger.error('Update user error:', error);
    sendError(res, 'Failed to update user', 500);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { sendNotFound(res, 'User not found'); return; }

    if (user.id === req.user?.id) {
      sendError(res, 'Cannot delete your own account', 400);
      return;
    }

    if (user.role === Role.SUPER_ADMIN) {
      sendError(res, 'Cannot delete Super Admin user', 403);
      return;
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false, updatedAt: new Date() },
    });

    sendSuccess(res, null, 'User deactivated successfully');
  } catch (error) {
    logger.error('Delete user error:', error);
    sendError(res, 'Failed to delete user', 500);
  }
};

export const hardDeleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { sendNotFound(res, 'User not found'); return; }

    if (user.id === req.user?.id) {
      sendError(res, 'Cannot delete your own account', 400);
      return;
    }

    if (user.role === Role.SUPER_ADMIN) {
      sendError(res, 'Cannot delete Super Admin user', 403);
      return;
    }

    const userId = user.id;

    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { userId } }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.dailyReport.deleteMany({ where: { userId } }),
      prisma.taskComment.deleteMany({ where: { userId } }),
      prisma.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } }),
      prisma.expense.deleteMany({ where: { userId } }),
      prisma.salary.updateMany({ where: { userId }, data: { userId: null } }),
      prisma.document.deleteMany({ where: { uploadedBy: userId } }),
      prisma.projectMember.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    sendSuccess(res, null, 'User permanently deleted');
  } catch (error) {
    logger.error('Hard delete user error:', error);
    sendError(res, 'Failed to permanently delete user', 500);
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { sendNotFound(res, 'User not found'); return; }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword, updatedAt: new Date() },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });

    sendSuccess(res, null, 'Password reset successfully');
  } catch (error) {
    logger.error('Reset user password error:', error);
    sendError(res, 'Failed to reset password', 500);
  }
};