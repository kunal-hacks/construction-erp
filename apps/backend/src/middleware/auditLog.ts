import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export const auditLog = (module: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.json.bind(res);
    const oldBody = req.body;

    res.json = function (body: unknown) {
      // Only log successful mutations
      if ((res.statusCode >= 200 && res.statusCode < 300) && 
          ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        setImmediate(async () => {
          try {
            await prisma.auditLog.create({
              data: {
                userId: req.user?.id,
                action,
                module,
                recordId: req.params.id || null,
                oldData: req.method === 'PUT' || req.method === 'PATCH' ? oldBody : null,
                newData: req.method !== 'DELETE' ? (body as { data?: unknown })?.data || null : null,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
              },
            });
          } catch (error) {
            logger.error('Audit log error:', error);
          }
        });
      }
      return originalSend(body);
    };

    next();
  };
};
