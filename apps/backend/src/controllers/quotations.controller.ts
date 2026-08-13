import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

const normalizeQuotation = (q: any) => ({
  ...q,
  vendor: q.Vendor,
  project: q.Project,
  items: (q.QuotationItem || []).map((item: any) => ({
    ...item,
    material: item.Material,
    rate: item.unitPrice,
    totalAmount: item.totalPrice,
  })),
});

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
          Vendor: { select: { id: true, name: true } },
          Project: { select: { id: true, name: true } },
          QuotationItem: {
            include: { Material: { select: { id: true, name: true, unit: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quotation.count({ where }),
    ]);

    sendPaginatedSuccess(res, quotations.map(normalizeQuotation), total, page, pageSize);
  } catch (error) {
    console.error('Get quotations error:', error);
    sendError(res, 'Failed to fetch quotations', 500);
  }
};

export const createQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vendorId, projectId, validUntil, notes, terms, items } = req.body;

    if (!vendorId) {
      sendError(res, 'vendorId is required', 400);
      return;
    }
    if (!projectId) {
      sendError(res, 'projectId is required', 400);
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      sendError(res, 'At least one quotation item is required', 400);
      return;
    }

    // Reject incomplete lines early
    for (const item of items) {
      if (!item.materialId) {
        sendError(res, 'Each item must have a materialId', 400);
        return;
      }
      if (Number(item.quantity) <= 0) {
        sendError(res, 'Each item must have quantity > 0', 400);
        return;
      }
    }

    const count = await prisma.quotation.count();
    const quotationNo = `QUO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const totalAmount = items.reduce(
      (sum: number, item: { quantity: number; rate?: number; unitPrice?: number }) => {
        const rate = Number(item.rate ?? item.unitPrice ?? 0);
        return sum + Number(item.quantity || 0) * rate;
      },
      0
    );

    const quotation = await prisma.quotation.create({
      data: {
        id: randomUUID(),
        quotationNo,
        vendorId,
        projectId, // always set — required FK
        validUntil: validUntil ? new Date(validUntil) : null,
        notes: notes || null,
        terms: terms || null,
        totalAmount,
        // Do NOT set updatedAt if the schema has @updatedAt
        // If schema has plain `updatedAt DateTime` without @updatedAt, keep the line below:
        updatedAt: new Date(),
        QuotationItem: {
          create: items.map(
            (item: {
              materialId: string;
              quantity: number;
              rate?: number;
              unitPrice?: number;
              notes?: string;
            }) => {
              const rate = Number(item.rate ?? item.unitPrice ?? 0);
              const qty = Number(item.quantity);
              return {
                id: randomUUID(),
                materialId: item.materialId,
                quantity: qty,
                unitPrice: rate,
                totalPrice: qty * rate,
                notes: item.notes || null,
              };
            }
          ),
        },
      },
      include: {
        Vendor: { select: { id: true, name: true } },
        Project: { select: { id: true, name: true } },
        QuotationItem: {
          include: { Material: { select: { id: true, name: true, unit: true } } },
        },
      },
    });

    sendCreated(res, normalizeQuotation(quotation), 'Quotation created successfully');
  } catch (error: any) {
    console.error('Create quotation error:', error);
    // Surface real message in dev so you can see Prisma field mismatches
    sendError(res, error?.message || 'Failed to create quotation', 500);
  }
};

