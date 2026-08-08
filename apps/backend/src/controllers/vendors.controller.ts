import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { getUserProjectIds } from '../middleware/projectScope';
import { logger } from '../utils/logger';

// A vendor has no direct projectId — it's linked to projects only through the
// PurchaseOrders, TruckEntries, and Expenses (by vendorName) that reference it.
// For a PM, "vendors relevant to me" = vendors that appear in at least one of
// their assigned projects through one of those three paths.
const getRelevantVendorFilter = async (allowedProjectIds: string[]) => {
  const [poVendorIds, truckVendorIds, expenseVendorNames] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { projectId: { in: allowedProjectIds } },
      select: { vendorId: true },
      distinct: ['vendorId'],
    }),
    prisma.truckEntry.findMany({
      where: { projectId: { in: allowedProjectIds }, vendorId: { not: null } },
      select: { vendorId: true },
      distinct: ['vendorId'],
    }),
    prisma.expense.findMany({
      where: { projectId: { in: allowedProjectIds }, vendorName: { not: null } },
      select: { vendorName: true },
      distinct: ['vendorName'],
    }),
  ]);

  const vendorIds = [
    ...poVendorIds.map((p) => p.vendorId),
    ...truckVendorIds.map((t) => t.vendorId),
  ].filter(Boolean) as string[];
  const vendorNames = expenseVendorNames.map((e) => e.vendorName).filter(Boolean) as string[];

  return { vendorIds, vendorNames };
};

export const getVendors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { search, isActive } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { gstNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive === 'true';

    if (allowedProjectIds) {
      // PM: only vendors that actually have business on one of their projects
      const { vendorIds, vendorNames } = await getRelevantVendorFilter(allowedProjectIds);
      where.AND = [
        {
          OR: [
            { id: { in: vendorIds.length ? vendorIds : ['__none__'] } },
            { name: { in: vendorNames.length ? vendorNames : ['__none__'] } },
          ],
        },
      ];
    }

    const [vendorsRaw, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        skip,
        take,
        include: {
          // schema relations: PurchaseOrder, Quotation, TruckEntry — count these instead of invalid `_count: true`
          _count: { select: { PurchaseOrder: true, Quotation: true, TruckEntry: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.vendor.count({ where }),
    ]);

    // For a PM, the _count above is company-wide across every project — that would leak
    // how much business this vendor does elsewhere. Recompute counts scoped to their projects.
    const vendors = allowedProjectIds
      ? await Promise.all(
          vendorsRaw.map(async (v) => {
            const [poCount, truckCount, quoteCount] = await Promise.all([
              prisma.purchaseOrder.count({ where: { vendorId: v.id, projectId: { in: allowedProjectIds } } }),
              prisma.truckEntry.count({ where: { vendorId: v.id, projectId: { in: allowedProjectIds } } }),
              prisma.quotation.count({ where: { vendorId: v.id, projectId: { in: allowedProjectIds } } }),
            ]);
            return { ...v, _count: { PurchaseOrder: poCount, TruckEntry: truckCount, Quotation: quoteCount } };
          })
        )
      : vendorsRaw;

    sendPaginatedSuccess(res, vendors, total, page, pageSize);
  } catch (error) {
    logger.error('Get vendors error:', error);
    sendError(res, 'Failed to fetch vendors', 500);
  }
};

export const getVendorById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedProjectIds = await getUserProjectIds(req);

    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
    });

    if (!vendor) {
      sendNotFound(res, 'Vendor not found');
      return;
    }

    // For a PM: refuse outright if this vendor has no business at all on any of
    // their assigned projects — no reason for them to see this vendor's detail page.
    if (allowedProjectIds) {
      const { vendorIds, vendorNames } = await getRelevantVendorFilter(allowedProjectIds);
      const isRelevant = vendorIds.includes(vendor.id) || vendorNames.includes(vendor.name);
      if (!isRelevant) {
        sendNotFound(res, 'Vendor not found');
        return;
      }
    }

    const projectScope = allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {};

    // Expense has no vendorId FK — match by vendorName string instead
    const [recentExpenses, recentPurchaseOrders, recentQuotations, recentTruckEntries, totalSpend] = await Promise.all([
      prisma.expense.findMany({
        where: { vendorName: vendor.name, ...projectScope },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { Project: { select: { name: true } } },
      }),
      prisma.purchaseOrder.findMany({
        where: { vendorId: req.params.id, ...projectScope },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { Project: { select: { name: true } } },
      }),
      prisma.quotation.findMany({
        where: { vendorId: req.params.id, ...projectScope },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.truckEntry.findMany({
        where: { vendorId: req.params.id, ...projectScope },
        take: 10,
        orderBy: { entryTime: 'desc' },
        include: { Project: { select: { name: true } } },
      }),
      prisma.expense.aggregate({
        where: {
          vendorName: vendor.name,
          status: 'APPROVED',   // schema: status (not approvalStatus)
          ...projectScope,
        },
        _sum: { amount: true },
      }),
    ]);

    const totalSpendAmount = totalSpend._sum?.amount || 0;
    sendSuccess(res, {
      ...vendor,
      expenses: recentExpenses,
      purchaseOrders: recentPurchaseOrders,
      quotations: recentQuotations,
      truckEntries: recentTruckEntries,
      totalSpend: totalSpendAmount,
    });
  } catch (error) {
    logger.error('Get vendor error:', error);
    sendError(res, 'Failed to fetch vendor', 500);
  }
};

export const createVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, email, address, gstNumber, panNumber, bankName, bankAccount, ifscCode, category } = req.body;

    if (!name || name.trim() === '') {
      sendError(res, 'Vendor name is required', 400);
      return;
    }

    const vendor = await prisma.vendor.create({
      data: {
        id: randomUUID(),
        name,
        phone: phone || '',
        email: email || null,
        address: address || null,
        gstNumber: gstNumber || null,
        panNumber: panNumber || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        ifscCode: ifscCode || null,
        category: category || null,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    sendCreated(res, vendor, 'Vendor created successfully');
  } catch (error: any) {
    logger.error('Create vendor error:', error);
    sendError(res, error.message || 'Failed to create vendor', 500);
  }
};

export const updateVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) {
      sendNotFound(res, 'Vendor not found');
      return;
    }

    const { name, phone, email, address, gstNumber, panNumber, bankName, bankAccount, ifscCode, category, rating, isActive } = req.body;

    const updated = await prisma.vendor.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(gstNumber !== undefined && { gstNumber }),
        ...(panNumber !== undefined && { panNumber }),
        ...(bankName !== undefined && { bankName }),
        ...(bankAccount !== undefined && { bankAccount }),
        ...(ifscCode !== undefined && { ifscCode }),
        ...(category !== undefined && { category }),
        ...(rating !== undefined && { rating: Number(rating) }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
    });

    sendSuccess(res, updated, 'Vendor updated successfully');
  } catch (error) {
    logger.error('Update vendor error:', error);
    sendError(res, 'Failed to update vendor', 500);
  }
};

export const deleteVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.vendor.update({
      where: { id: req.params.id },
      data: { isActive: false, updatedAt: new Date() },
    });
    sendSuccess(res, null, 'Vendor deactivated');
  } catch (error) {
    sendError(res, 'Failed to delete vendor', 500);
  }
};