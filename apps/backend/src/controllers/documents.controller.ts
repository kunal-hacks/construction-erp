import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import * as path from 'path';
import * as fs from 'fs';
import { getUserProjectIds } from '../middleware/projectScope';
import { uploadBufferToCloudinary, deleteFromCloudinary, getCloudinaryResourceType } from '../utils/cloudinaryUpload';

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, type, search } = req.query;

    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (type) where.category = type as string;
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    const [docs, total] = await Promise.all([
      prisma.document.findMany({
        where, skip, take,
        include: {
          User: { select: { firstName: true, lastName: true } },
          Project: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count({ where }),
    ]);

    const normalized = docs.map((doc) => ({
      ...doc,
      title: doc.name,
      type: doc.category,
      size: doc.fileSize,
      mimeType: doc.fileType,
      uploader: doc.User,
      project: doc.Project,
    }));

    sendPaginatedSuccess(res, normalized, total, page, pageSize);
  } catch (error) {
    sendError(res, 'Failed to fetch documents', 500);
  }
};

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    const { projectId, title, type } = req.body;

    const resourceType = getCloudinaryResourceType(req.file.mimetype);
    const cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: 'planning-earth/documents',
      resourceType,
    });

    const doc = await prisma.document.create({
      data: {
        id: randomUUID(),
        name: title || req.file.originalname,
        fileUrl: cloudinaryResult.secureUrl,
        cloudinaryId: cloudinaryResult.publicId,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        category: type || 'OTHER',
        description: null,
        projectId: projectId || null,
        uploadedBy: req.user!.id,
      },
    });

    sendCreated(res, {
      ...doc,
      title: doc.name,
      type: doc.category,
      size: doc.fileSize,
      mimeType: doc.fileType,
    }, 'Document uploaded');
  } catch (error) {
    console.error('Upload error:', error);
    sendError(res, 'Failed to upload document', 500);
  }
};

export const getDocumentUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) { sendNotFound(res, 'Document not found'); return; }

    // New docs: fileUrl is already a full Cloudinary URL.
    if (doc.fileUrl.startsWith('http')) {
      sendSuccess(res, { url: doc.fileUrl, expiresIn: 3600 });
      return;
    }

    // Old local docs — build full URL against this server, same as before.
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}${doc.fileUrl}`;
    sendSuccess(res, { url, expiresIn: 3600 });
  } catch (error) {
    sendError(res, 'Failed to get document URL', 500);
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) { sendNotFound(res, 'Document not found'); return; }

    if (doc.cloudinaryId) {
      await deleteFromCloudinary(doc.cloudinaryId, getCloudinaryResourceType(doc.fileType));
    } else if (doc.fileUrl.startsWith('/uploads/')) {
      // Old local file — clean up from disk, same as before
      const filePath = path.join(process.cwd(), doc.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.document.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Document deleted');
  } catch (error) {
    sendError(res, 'Failed to delete document', 500);
  }
};