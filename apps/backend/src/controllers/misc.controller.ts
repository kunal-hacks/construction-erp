import { Response } from 'express';
// import { DocumentType } from '@prisma/client';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import * as minio from '../config/minio';
import { logger } from '../utils/logger';
// ==================== DOCUMENTS ====================

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, type, search } = req.query;

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId as string;
    if (type) where.type = type;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const [docs, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          projectId: true,
          title: true,
          type: true,
          url: true,
          size: true,
          mimeType: true,
          tags: true,
          uploadedById: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count({ where }),
    ]);

    sendPaginatedSuccess(res, docs, total, page, pageSize);
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

    const { projectId, title, type, tags } = req.body;

    const objectName = await minio.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'documents'
    );

    const doc = await prisma.document.create({
      // cast data to any to satisfy potential mismatches be
      //  runtime schema and generated TS types
      data: {
        projectId: projectId || null,
        title,
        type: type ,
        url: objectName,
        size: req.file.size,
        mimeType: req.file.mimetype,
        tags: tags ? JSON.parse(tags) : [],
        uploadedBy: req.user!.id,
      } as any,
    });

    sendCreated(res, doc, 'Document uploaded');
  } catch (error) {
    logger.error('Upload document error:', error);
    sendError(res, 'Failed to upload document', 500);
  }
};

export const getDocumentUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) {
      sendNotFound(res, 'Document not found');
      return;
    }

    const url = await (minio.getFileUrl ?? minio.default)(doc.url, 3600);
    sendSuccess(res, { url, expiresIn: 3600 });
  } catch (error) {
    sendError(res, 'Failed to get document URL', 500);
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) {
      sendNotFound(res, 'Document not found');
      return;
    }

    await (minio.deleteFile ?? minio.default)(doc.url);
    await prisma.document.delete({ where: { id: req.params.id } });

    sendSuccess(res, null, 'Document deleted');
  } catch (error) {
    sendError(res, 'Failed to delete document', 500);
  }
};

// ==================== NOTIFICATIONS ====================

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
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
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    sendError(res, 'Failed to fetch notifications', 500);
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id, userId: req.user!.id },
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

// ==================== CLIENTS ====================

export const getClients = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { search } = req.query;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { projects: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.client.count({ where }),
    ]);

    sendPaginatedSuccess(res, clients, total, page, pageSize);
  } catch (error) {
    sendError(res, 'Failed to fetch clients', 500);
  }
};

export const createClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client = await prisma.client.create({ data: req.body });
    sendCreated(res, client, 'Client created');
  } catch (error) {
    sendError(res, 'Failed to create client', 500);
  }
};

export const updateClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: req.body,
    });
    sendSuccess(res, client, 'Client updated');
  } catch (error) {
    sendError(res, 'Failed to update client', 500);
  }
};

// ==================== LABOUR ====================

export const getLabour = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { search, contractorId } = req.query;

    const where: Record<string, unknown> = { isActive: true };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (contractorId) where.contractorId = contractorId as string;

    const [labour, total] = await Promise.all([
      prisma.labour.findMany({
        where,
        skip,
        take,
        include: { contractor: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.labour.count({ where }),
    ]);

    sendPaginatedSuccess(res, labour, total, page, pageSize);
  } catch (error) {
    sendError(res, 'Failed to fetch labour', 500);
  }
};

export const createLabour = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const labour = await prisma.labour.create({ data: req.body });
    sendCreated(res, labour, 'Labour record created');
  } catch (error) {
    sendError(res, 'Failed to create labour', 500);
  }
};

export const recordAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { labourId, date, status, projectId } = req.body;

    const attendance = await prisma.attendance.upsert({
      where: { labourId_date: { labourId, date: new Date(date) } },
      update: { status, projectId },
      create: { labourId, date: new Date(date), status, projectId },
    });

    sendSuccess(res, attendance, 'Attendance recorded');
  } catch (error) {
    sendError(res, 'Failed to record attendance', 500);
  }
};

export const getContractors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contractors = await prisma.contractor.findMany({
      where: { isActive: true },
      include: { _count: { select: { labours: true } } },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, contractors);
  } catch (error) {
    sendError(res, 'Failed to fetch contractors', 500);
  }
};

export const createContractor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contractor = await prisma.contractor.create({ data: req.body });
    sendCreated(res, contractor, 'Contractor created');
  } catch (error) {
    sendError(res, 'Failed to create contractor', 500);
  }
};

// ==================== SALARY ====================

export const getSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { month, year, status } = req.query;

    const where: Record<string, unknown> = {};
    if (month) where.month = parseInt(month as string);
    if (year) where.year = parseInt(year as string);
    if (status) where.status = status;

    const [salaries, total] = await Promise.all([
      prisma.salary.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
          labour: { select: { name: true, skill: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salary.count({ where }),
    ]);

    sendPaginatedSuccess(res, salaries, total, page, pageSize);
  } catch (error) {
    sendError(res, 'Failed to fetch salaries', 500);
  }
};

export const generateSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, entries } = req.body;

    const salaries = await prisma.$transaction(
      entries.map((entry: {
        userId?: string;
        labourId?: string;
        basicSalary: number;
        allowances?: number;
        deductions?: number;
      }) => {
        const netSalary = entry.basicSalary + (entry.allowances || 0) - (entry.deductions || 0);
        return prisma.salary.create({
          data: {
            userId: entry.userId || null,
            labourId: entry.labourId || null,
            month,
            year,
            basicSalary: entry.basicSalary,
            allowances: entry.allowances || 0,
            deductions: entry.deductions || 0,
            netSalary,
          },
        });
      })
    );

    sendCreated(res, salaries, `${salaries.length} salary records generated`);
  } catch (error) {
    logger.error('Generate salary error:', error);
    sendError(res, 'Failed to generate salaries', 500);
  }
};

export const processSalaryPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentMode } = req.body;

    const salary = await prisma.salary.update({
      where: { id: req.params.id },
      data: { status: 'PAID', paidAt: new Date(), paymentMode },
    });

    sendSuccess(res, salary, 'Salary payment processed');
  } catch (error) {
    sendError(res, 'Failed to process payment', 500);
  }
};

// ==================== AUDIT LOGS ====================

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { userId, module, startDate, endDate } = req.query;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId as string;
    if (module) where.module = module as string;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    sendPaginatedSuccess(res, logs, total, page, pageSize);
  } catch (error) {
    sendError(res, 'Failed to fetch audit logs', 500);
  }
};

// ==================== QUOTATIONS ====================

export const getQuotations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { vendorId, status } = req.query;

    const where: Record<string, unknown> = {};
    if (vendorId) where.vendorId = vendorId as string;
    if (status) where.status = status;

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take,
        include: {
          vendor: { select: { name: true } },
          items: { include: { material: { select: { name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quotation.count({ where }),
    ]);

    sendPaginatedSuccess(res, quotations, total, page, pageSize);
  } catch (error) {
    sendError(res, 'Failed to fetch quotations', 500);
  }
};

export const createQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vendorId, projectId, validUntil, notes, items } = req.body;

    const count = await prisma.quotation.count();
    const quotationNo = `QUO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const totalAmount = items.reduce((sum: number, item: { quantity: number; rate: number }) =>
      sum + item.quantity * item.rate, 0);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        vendorId,
        projectId: projectId || null,
        validUntil: new Date(validUntil),
        notes,
        totalAmount,
        createdBy: req.user?.id,
        items: {
          create: items.map((item: {
            materialId: string;
            quantity: number;
            unit: string;
            rate: number;
            notes?: string;
          }) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            totalAmount: item.quantity * item.rate,
            notes: item.notes,
          })),
        },
      },
      include: {
        vendor: true,
        items: { include: { material: true } },
      },
    });

    sendCreated(res, quotation, 'Quotation created');
  } catch (error) {
    logger.error('Create quotation error:', error);
    sendError(res, 'Failed to create quotation', 500);
  }
};
