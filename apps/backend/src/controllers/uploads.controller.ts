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
    const { projectId, module, category, relatedType, relatedId } = req.body;
    const file = req.file;
    if (!file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    // Uploading still requires access to the project it belongs to — this
    // is about WHO CAN CREATE, separate from who can later SEE it.
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
        relatedType: relatedType || null,
        relatedId: relatedId || null,
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

    // Admin: unrestricted access to every file, always.
    // Non-admin: strictly their own uploads — not project-mates', not
    // anyone else's, regardless of which project it's attached to.
    const isAdmin = ADMIN_ROLES.includes(req.user!.role);
    if (!isAdmin && record.uploadedBy !== req.user!.id) {
      sendError(res, 'You do not have access to this file', 403);
      return;
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
    const { projectId, module, category, relatedType, relatedId } = req.query;
    const isAdmin = ADMIN_ROLES.includes(req.user!.role);

    const where: Record<string, unknown> = {};

    if (isAdmin) {
      // Admin sees everything — full visibility, no ownership filter.
      if (projectId) where.projectId = projectId as string;
    } else {
      // Non-admin: only their own uploads. Project/module/category are
      // optional narrowing filters on top of that, never a way to see
      // someone else's files.
      where.uploadedBy = req.user!.id;
      if (projectId) where.projectId = projectId as string;
    }
    if (module) where.module = module as string;
    if (category) where.category = category as string;
    if (relatedType) where.relatedType = relatedType as string;
    if (relatedId) where.relatedId = relatedId as string;

    const uploads = await prisma.upload.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        Project: { select: { id: true, name: true } },
        // Admin uses this to see exactly who uploaded what and when
        // (User + createdAt together give the full audit picture).
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
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
    const isAdmin = ADMIN_ROLES.includes(req.user!.role);
    const where: Record<string, unknown> = isAdmin ? {} : { uploadedBy: req.user!.id };

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

    // Admin can delete anything. Everyone else can delete only what
    // they themselves uploaded — project membership no longer grants
    // delete rights over a project-mate's file.
    if (!isAdmin && !isOwner) {
      sendError(res, 'You do not have permission to delete this file', 403);
      return;
    }

    const cloudinaryId = (record as { cloudinaryId?: string | null }).cloudinaryId;

    if (cloudinaryId) {
      await deleteFromCloudinary(cloudinaryId, getCloudinaryResourceType(record.mimeType));
    } else {
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