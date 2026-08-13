import { randomUUID } from 'crypto';
import { Response } from 'express';
import { MovementType } from '@prisma/client';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds } from '../middleware/projectScope';

// ── Materials ──────────────────────────────────────────────────────────────
// Materials are a fixed, closed catalog seeded once (scripts/seedMaterials.ts)
// and wired into Task Type calculations. There is intentionally no create
// endpoint — adding a material that isn't wired into a calculation formula
// creates clutter without any automatic benefit, so new materials are added
// by a developer via the seed script, never through the UI.

export const getMaterials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { search, category } = req.query;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category as string;

    const [materials, total] = await Promise.all([
      prisma.material.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.material.count({ where }),
    ]);

    sendPaginatedSuccess(res, materials, total, page, pageSize);
  } catch (error) {
    logger.error('Get materials error:', error);
    sendError(res, 'Failed to fetch materials', 500);
  }
};

// Kept, Super Admin only — this fixes a typo or corrects a unit mismatch on
// an EXISTING material (e.g. if Cement was accidentally seeded as KG instead
// of Bags). It cannot create a new material and does not change `name` in a
// way that would let someone rename their way into a duplicate — name stays
// locked to prevent that.
export const updateMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material) { sendNotFound(res, 'Material not found'); return; }

    const { category, unit, description } = req.body;

    const updated = await prisma.material.update({
      where: { id: req.params.id },
      data: {
        ...(category && { category }),
        ...(unit && { unit }),
        ...(description !== undefined && { description }),
      },
    });

    sendSuccess(res, updated, 'Material updated successfully');
  } catch (error) {
    logger.error('Update material error:', error);
    sendError(res, 'Failed to update material', 500);
  }
};

// ── Inventory ──────────────────────────────────────────────────────────────

export const getProjectInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { page, pageSize, skip, take } = getPagination(req.query);

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, 'You do not have access to this project', 403);
      return;
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { projectId },
        skip,
        take,
        include: {
          Material: { select: { id: true, name: true, unit: true, category: true } },
        },
        orderBy: { Material: { name: 'asc' } },
      }),
      prisma.inventoryItem.count({ where: { projectId } }),
    ]);

    const normalized = items.map((item) => ({
      ...item,
      material: {
        ...item.Material,
        category: { name: item.Material.category },
        minStockLevel: item.minStock,
      },
      currentStock: item.quantity,
      avgRate: item.unitPrice,
      totalValue: (item.quantity * item.unitPrice).toFixed(2),
    }));

    sendPaginatedSuccess(res, normalized, total, page, pageSize);
  } catch (error) {
    logger.error('Get inventory error:', error);
    sendError(res, 'Failed to fetch inventory', 500);
  }
};

// ── Inventory (all projects, optionally filtered) ──────────────────────────

export const getAllInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, search } = req.query;

    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};

    if (allowedProjectIds) {
      where.projectId = projectId && allowedProjectIds.includes(projectId as string)
        ? projectId as string
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }

    if (search) {
      where.Material = { name: { contains: search as string, mode: 'insensitive' } };
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take,
        include: {
          Material: { select: { id: true, name: true, unit: true, category: true } },
          Project: { select: { id: true, name: true, projectCode: true } },
        },
        orderBy: [{ Project: { name: 'asc' } }, { Material: { name: 'asc' } }],
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    const normalized = items.map((item) => ({
      ...item,
      material: {
        ...item.Material,
        category: { name: item.Material.category },
        minStockLevel: item.minStock,
      },
      project: item.Project,
      currentStock: item.quantity,
      avgRate: item.unitPrice,
      totalValue: (item.quantity * item.unitPrice).toFixed(2),
    }));

    sendPaginatedSuccess(res, normalized, total, page, pageSize);
  } catch (error) {
    logger.error('Get all inventory error:', error);
    sendError(res, 'Failed to fetch inventory', 500);
  }
};

// ── Stock In ───────────────────────────────────────────────────────────────
// Receiving stock IS a purchase — so every stock-in also creates a matching
// Expense record automatically, in the same DB transaction, so the two can
// never drift out of sync (both succeed or both fail together).

export const stockIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, materialId, quantity, rate, notes, referenceNo, vendorName } = req.body;

    if (!projectId || !materialId || !quantity || !rate) {
      sendError(res, 'projectId, materialId, quantity and rate are required', 400);
      return;
    }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, 'You do not have access to this project', 403);
      return;
    }

    const [project, material] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.material.findUnique({ where: { id: materialId } }),
    ]);
    if (!project) { sendNotFound(res, 'Project not found'); return; }
    if (!material) { sendNotFound(res, 'Material not found'); return; }

    const totalAmount = Number(quantity) * Number(rate);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({
        where: { projectId_materialId: { projectId, materialId } },
      });

      let inventoryItem;

      if (existing) {
        const newQty = existing.quantity + Number(quantity);
        const totalValue = existing.quantity * existing.unitPrice + Number(quantity) * Number(rate);
        const newAvgPrice = totalValue / newQty;

        inventoryItem = await tx.inventoryItem.update({
          where: { projectId_materialId: { projectId, materialId } },
          data: { quantity: newQty, unitPrice: newAvgPrice, updatedAt: new Date() },
        });
      } else {
        inventoryItem = await tx.inventoryItem.create({
          data: {
            id: randomUUID(),
            projectId,
            materialId,
            quantity: Number(quantity),
            unitPrice: Number(rate),
            minStock: 0,
            updatedAt: new Date(),
          },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          id: randomUUID(),
          inventoryItemId: inventoryItem.id,
          movementType: MovementType.IN,
          quantity: Number(quantity),
          unitPrice: Number(rate),
          reference: referenceNo || null,
          notes: notes || null,
        },
      });

      const expense = await tx.expense.create({
        data: {
          id: randomUUID(),
          projectId,
          userId: req.user!.id,
          title: `Material Purchase — ${material.name}`,
          description: notes || `${quantity} ${material.unit} received${referenceNo ? ` (Ref: ${referenceNo})` : ''}`,
          amount: totalAmount,
          category: 'Inventory',
          vendorName: vendorName || null,
          invoiceNo: referenceNo || null,
          status: 'APPROVED',
          approvedBy: req.user!.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return { movement, inventoryItem, expense };
    });

    sendCreated(res, result, 'Stock received and expense recorded successfully');
  } catch (error) {
    logger.error('Stock in error:', error);
    sendError(res, 'Failed to record stock in', 500);
  }
};

// ── Stock Out ──────────────────────────────────────────────────────────────

export const stockOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, materialId, quantity, notes, referenceNo } = req.body;

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, 'You do not have access to this project', 403);
      return;
    }

    const inventory = await prisma.inventoryItem.findUnique({
      where: { projectId_materialId: { projectId, materialId } },
    });

    if (!inventory) { sendError(res, 'Material not found in inventory', 404); return; }
    if (inventory.quantity < Number(quantity)) {
      sendError(res, `Insufficient stock. Available: ${inventory.quantity}`, 400);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { projectId_materialId: { projectId, materialId } },
        data: { quantity: inventory.quantity - Number(quantity), updatedAt: new Date() },
      });

      return tx.stockMovement.create({
        data: {
          id: randomUUID(),
          inventoryItemId: inventory.id,
          movementType: MovementType.OUT,
          quantity: Number(quantity),
          unitPrice: inventory.unitPrice,
          reference: referenceNo || null,
          notes: notes || null,
        },
      });
    });

    sendCreated(res, result, 'Stock issued successfully');
  } catch (error) {
    logger.error('Stock out error:', error);
    sendError(res, 'Failed to record stock out', 500);
  }
};

// ── Stock Movements ────────────────────────────────────────────────────────

export const getStockMovements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, type } = req.query;

    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      const scopedProjectId = projectId && allowedProjectIds.includes(projectId as string) ? projectId as string : undefined;
      where.InventoryItem = scopedProjectId
        ? { projectId: scopedProjectId }
        : { projectId: { in: allowedProjectIds } };
    } else if (projectId) {
      where.InventoryItem = { projectId: projectId as string };
    }
    if (type) where.movementType = type as MovementType;

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take,
        include: {
          InventoryItem: {
            include: {
              Material: { select: { id: true, name: true, unit: true } },
              Project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { movedAt: 'desc' },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    const normalized = movements.map((m) => ({
      ...m,
      type: m.movementType,
      rate: m.unitPrice,
      totalValue: m.unitPrice ? m.quantity * m.unitPrice : null,
      referenceNo: m.reference,
      date: m.movedAt,
      material: m.InventoryItem.Material,
      project: m.InventoryItem.Project,
    }));

    sendPaginatedSuccess(res, normalized, total, page, pageSize);
  } catch (error) {
    logger.error('Get movements error:', error);
    sendError(res, 'Failed to fetch movements', 500);
  }
};

// ── Categories (derived from Material.category string field) ──────────────
// No create endpoint — categories exist only because a material has that
// category value; the fixed material seed defines the complete category set.

export const getMaterialCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.material.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    const result = categories.map((c) => ({
      id: c.category,
      name: c.category,
    }));

    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 'Failed to fetch categories', 500);
  }
};

