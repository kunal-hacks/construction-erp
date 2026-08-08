import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  getTokenExpiry 
} from '../utils/jwt';
import { 
  sendSuccess, 
  sendError, 
  sendUnauthorized, 
  sendNotFound 
} from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// ==================== LOGIN ====================
export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return sendError(res, 'Invalid credentials', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Account is deactivated', 403);
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),        // Correct field name
      },
    });

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });

  } catch (error) {
    logger.error('Login error:', error);
    sendError(res, 'Login failed', 500);
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const refreshToken = req.headers['x-refresh-token'] as string;
    
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    logger.error('Logout error:', error);
    sendError(res, 'Logout failed', 500);
  }
};

export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      sendUnauthorized(res, 'Refresh token required');
      return;
    }

    const payload = verifyRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      sendUnauthorized(res, 'Invalid or expired refresh token');
      return;
    }

    const newAccessToken = generateAccessToken(storedToken.user);
    const newRefreshToken = generateRefreshToken(storedToken.user);

    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: refreshToken } }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: storedToken.user.id,
          expiresAt: getTokenExpiry('7d'),
        },
      }),
    ]);

    sendSuccess(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    logger.error('Refresh token error:', error);
    sendUnauthorized(res, 'Invalid refresh token');
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        ProjectMember: {
          include: {
            Project: { select: { id: true, name: true, projectCode: true, status: true } },
          },
        },
      },
    });

    if (!user) {
      sendNotFound(res, 'User not found');
      return;
    }

    // Normalize for frontend: lastLogin → lastLoginAt, ProjectMember → projects
    sendSuccess(res, {
      ...user,
      lastLoginAt: user.lastLogin,
      projects: user.ProjectMember.map((pm) => ({
        project: pm.Project,
        role: pm.role,
      })),
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    sendError(res, 'Failed to fetch profile', 500);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { firstName, lastName, phone },
      select: {
        id: true, 
        email: true, 
        firstName: true, 
        lastName: true, 
        phone: true, 
        role: true, 
        avatar: true
      },
    });

    sendSuccess(res, user, 'Profile updated successfully');
  } catch (error) {
    logger.error('Update profile error:', error);
    sendError(res, 'Failed to update profile', 500);
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { password: true },
    });

    if (!user) {
      sendNotFound(res, 'User not found');
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      sendError(res, 'Current password is incorrect', 400);
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.id } });

    sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    logger.error('Change password error:', error);
    sendError(res, 'Failed to change password', 500);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      sendSuccess(res, null, 'If an account exists, a reset email has been sent');
      return;
    }

    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    logger.info(`Password reset token generated for ${user.email}`);
    sendSuccess(res, null, 'If an account exists, a reset email has been sent');
  } catch (error) {
    logger.error('Forgot password error:', error);
    sendError(res, 'Failed to process request', 500);
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      sendError(res, 'Invalid or expired reset token', 400);
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    sendSuccess(res, null, 'Password reset successfully');
  } catch (error) {
    logger.error('Reset password error:', error);
    sendError(res, 'Failed to reset password', 500);
  }
};