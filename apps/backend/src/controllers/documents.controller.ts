import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import * as path from 'path';
import * as fs from 'fs';
import { getUserProjectIds } from '../middleware/projectScope';

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, type, search } = req.query;

    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      // Documents not tied to any project (projectId null) stay hidden from PM unless explicitly project-scoped
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (type) where.category = type as string;       // schema: category (not type)
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    const [docs, total] = await Promise.all([
      prisma.document.findMany({
        where, skip, take,
        include: {
          User: { select: { firstName: true, lastName: true } },    // schema: User (not uploader)
          Project: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count({ where }),
    ]);

    // Normalize for frontend
    const normalized = docs.map((doc) => ({
      ...doc,
      title: doc.name,                      // frontend reads doc.title
      type: doc.category,                   // frontend reads doc.type
      size: doc.fileSize,                   // frontend reads doc.size
      mimeType: doc.fileType,               // frontend reads doc.mimeType
      uploader: doc.User,                   // frontend reads doc.uploader
      project: doc.Project,                 // frontend reads doc.project
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

    // Save file to uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `${randomUUID()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, req.file.buffer);

    const fileUrl = `/uploads/${fileName}`;

    const doc = await prisma.document.create({
      data: {
        id: randomUUID(),
        name: title || req.file.originalname,   // schema: name
        fileUrl,                                  // schema: fileUrl
        fileType: req.file.mimetype,              // schema: fileType
        fileSize: req.file.size,                  // schema: fileSize
        category: type || 'OTHER',                // schema: category
        description: null,
        projectId: projectId || null,
        uploadedBy: req.user!.id,                 // schema: uploadedBy
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

    // Return full URL — frontend opens it in new tab
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = doc.fileUrl.startsWith('http') ? doc.fileUrl : `${baseUrl}${doc.fileUrl}`;

    sendSuccess(res, { url, expiresIn: 3600 });
  } catch (error) {
    sendError(res, 'Failed to get document URL', 500);
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) { sendNotFound(res, 'Document not found'); return; }

    // Delete file from disk if local
    if (doc.fileUrl.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), doc.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.document.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Document deleted');
  } catch (error) {
    sendError(res, 'Failed to delete document', 500);
  }
};

