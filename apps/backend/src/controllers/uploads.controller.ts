import { randomUUID } from 'crypto';
import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds, ADMIN_ROLES } from '../middleware/projectScope';
import { UPLOAD_ROOT } from '../utils/uploadPaths';

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, module, category } = req.body;
    const file = req.file;
    if (!file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    // Project-scoped uploads (Expenses, Truck Entries, etc.) still enforce
    // the PM/Admin rule. Project-less uploads (standalone documents on this
    // page) have nothing to scope against, so any authenticated user may
    // create them.
    if (projectId) {
      const allowedProjectIds = await getUserProjectIds(req);
      if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
        fs.unlink(file.path, () => {}); // clean up the file multer already wrote before rejecting
        sendError(res, 'You do not have access to this project', 403);
        return;
      }
    }

    const relativePath = path.relative(UPLOAD_ROOT, file.path);

    const record = await prisma.upload.create({
      data: {
        id: randomUUID(),
        projectId: projectId || null,
        module,
        category: category || null,
        fileName: file.filename,
        originalName: file.originalname,
        filePath: relativePath,
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
    // Project-less files have no project to scope against — any
    // authenticated user may view them.

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
      // PM sees: uploads on their assigned projects, PLUS project-less
      // uploads (those belong to everyone, not scoped to any project).
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

// Powers the Documents page's dynamic module filter chips — returns the
// distinct set of modules that actually have at least one upload, scoped
// to what this user can see. No hardcoded module list to maintain.
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

    const fullPath = path.join(UPLOAD_ROOT, record.filePath);
    fs.unlink(fullPath, () => {}); // best-effort — don't fail the request if the file's already gone

    await prisma.upload.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'File deleted successfully');
  } catch (error) {
    logger.error('Delete upload error:', error);
    sendError(res, 'Failed to delete file', 500);
  }
};

