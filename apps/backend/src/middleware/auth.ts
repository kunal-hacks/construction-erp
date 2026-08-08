import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../utils/jwt';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { Role } from '@prisma/client';
import { prisma } from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    firstName: string;
    lastName: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      sendUnauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    if (!payload || !payload.id) {
  sendUnauthorized(res, 'Invalid token payload');
  return;
}


    // Verify user still exists and is active

const user = await prisma.user.findUnique({
  where: { id: payload.id },
  select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
});

if (!user || !user.isActive) {
  sendUnauthorized(res, 'User account is deactivated or not found');
  return;
}

req.user = {
  id: user.id,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
};

    next();
  } catch (error) {
    sendUnauthorized(res, 'Invalid or expired token');
    
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendForbidden(res, `Access denied. Required roles: ${roles.join(', ')}`);
      return;
    }

    next();
  };
};

export const authorizeOrViewer = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }
    // Allow if user has required role or is SUPER_ADMIN
    if (roles.includes(req.user.role) || req.user.role === Role.SUPER_ADMIN) {
      next();
      return;
    }
    sendForbidden(res, `Access denied. Required roles: ${roles.join(', ')}`);
  };
};

// Role hierarchy check
export const canAccess = (userRole: Role, requiredRoles: Role[]): boolean => {
  if (userRole === Role.SUPER_ADMIN) return true;
  return requiredRoles.includes(userRole);
};
