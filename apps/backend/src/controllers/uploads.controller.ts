import { randomUUID } from 'crypto';
import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds, ADMIN_ROLES } from '../middleware/projectScope';
import { UPLOAD_ROOT } from '../utils/uploadPaths';
import { uploadBufferToCloudinary, deleteFromCloudinary, getCloudinaryResourceType } from '../utils/cloudinaryUpload';

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, module, category } = req.body;
    const file = req.file;
    if (!file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    if (projectId) {
      const allowedProjectIds = await getUserProjectIds(req);
      if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
        sendError(res, 'You do not have access to this project', 403);
        return;
      }
    }

    const resourceType = getCloudinaryResourceType(file.mimetype);
    const cloudinaryResult = await uploadBufferToCloudinary(file.buffer, {
      folder: `planning-earth/${module || 'general'}`,
      resourceType,
    });

    const record = await prisma.upload.create({
      data: {
        id: randomUUID(),
        projectId: projectId || null,
        module,
        category: category || null,
        fileName: cloudinaryResult.publicId,
        originalName: file.originalname,
        filePath: cloudinaryResult.secureUrl,
        cloudinaryId: cloudinaryResult.publicId,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: req.user!.id,
      },
    });

    sendCreated(res, record, 'File uploaded successfully');
  } catch (error) {
    logger.error('Upload file error:', error);
    sendError(res, 'Failed to upload file', 500);
  }
};

export const getFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const record = await prisma.upload.findUnique({ where: { id: req.params.id } });
    if (!record) {
      sendNotFound(res, 'File not found');
      return;
    }

    if (record.projectId) {
      const allowedProjectIds = await getUserProjectIds(req);
      if (allowedProjectIds && !allowedProjectIds.includes(record.projectId)) {
        sendError(res, 'You do not have access to this file', 403);
        return;
      }
    }

    // New uploads: filePath is a full Cloudinary URL — redirect straight to it.
    if (record.filePath.startsWith('http')) {
      res.redirect(record.filePath);
      return;
    }

    // Old uploads (pre-Cloudinary): filePath is still a relative local path —
    // keep serving these from disk so existing files don't break.
    const fullPath = path.join(UPLOAD_ROOT, record.filePath);
    if (!fs.existsSync(fullPath)) {
      sendNotFound(res, 'File missing on server');
      return;
    }
    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${record.originalName}"`);
    res.sendFile(fullPath);
  } catch (error) {
    logger.error('Get file error:', error);
    sendError(res, 'Failed to fetch file', 500);
  }
};

export const listUploads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, module, category } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      where.OR = [
        { projectId: { in: allowedProjectIds } },
        { projectId: null },
      ];
      if (projectId) {
        where.OR = allowedProjectIds.includes(projectId as string)
          ? [{ projectId: projectId as string }]
          : [{ projectId: '__none__' }];
      }
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (module) where.module = module as string;
    if (category) where.category = category as string;

    const uploads = await prisma.upload.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        Project: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    sendSuccess(res, uploads);
  } catch (error) {
    logger.error('List uploads error:', error);
    sendError(res, 'Failed to list uploads', 500);
  }
};

export const getUploadModules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedProjectIds = await getUserProjectIds(req);
    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      where.OR = [{ projectId: { in: allowedProjectIds } }, { projectId: null }];
    }

    const rows = await prisma.upload.findMany({
      where,
      select: { module: true },
      distinct: ['module'],
    });
    sendSuccess(res, rows.map((r) => r.module));
  } catch (error) {
    logger.error('Get upload modules error:', error);
    sendError(res, 'Failed to fetch modules', 500);
  }
};

export const deleteUpload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const record = await prisma.upload.findUnique({ where: { id: req.params.id } });
    if (!record) {
      sendNotFound(res, 'File not found');
      return;
    }

    const isAdmin = ADMIN_ROLES.includes(req.user!.role);
    const isOwner = record.uploadedBy === req.user!.id;

    if (!isAdmin && !isOwner) {
      const allowedProjectIds = await getUserProjectIds(req);
      const hasProjectAccess = record.projectId && allowedProjectIds?.includes(record.projectId);
      if (!hasProjectAccess) {
        sendError(res, 'You do not have permission to delete this file', 403);
        return;
      }
    }

    if (record.cloudinaryId) {
      await deleteFromCloudinary(record.cloudinaryId, getCloudinaryResourceType(record.mimeType));
    } else {
      // Old local file — best-effort disk cleanup, same as before
      const fullPath = path.join(UPLOAD_ROOT, record.filePath);
      fs.unlink(fullPath, () => {});
    }

    await prisma.upload.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'File deleted successfully');
  } catch (error) {
    logger.error('Delete upload error:', error);
    sendError(res, 'Failed to delete file', 500);
  }
};