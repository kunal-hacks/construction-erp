import { Response } from 'express';
import { POStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds } from '../middleware/projectScope';

export const getPurchaseOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, vendorId, status } = req.query;

    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};

    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (vendorId) where.vendorId = vendorId as string;
    if (status) where.status = status as POStatus;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        include: {
          Project: { select: { id: true, name: true, projectCode: true } },
          Vendor: { select: { id: true, name: true } },
          POItem: {
            include: {
              Material: { select: { name: true, unit: true } },
            },
          },
          _count: { select: { POItem: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    sendPaginatedSuccess(res, orders, total, page, pageSize);
  } catch (error) {
    logger.error('Get POs error:', error);
    sendError(res, 'Failed to fetch purchase orders', 500);
  }
};

export const getPurchaseOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        Project: true,
        Vendor: true,
        POItem: {
          include: {
            Material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });

    if (!po) {
      sendNotFound(res, 'Purchase order not found');
      return;
    }

    sendSuccess(res, po);
  } catch (error) {
    sendError(res, 'Failed to fetch purchase order', 500);
  }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, vendorId, items, deliveryDate, notes } = req.body;

    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const totalAmount = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + Number(item.quantity) * Number(item.unitPrice),
      0
    );

    const po = await prisma.purchaseOrder.create({
      data: {
        id: crypto.randomUUID(),
        poNumber,
        projectId,
        vendorId,
        totalAmount,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        notes: notes || null,
        updatedAt: new Date(),
        POItem: {
          create: items.map((item: {
            materialId: string;
            quantity: number;
            unitPrice: number;
            notes?: string;
          }) => ({
            id: crypto.randomUUID(),
            materialId: item.materialId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.quantity) * Number(item.unitPrice),
            receivedQty: 0,
            notes: item.notes || null,
          })),
        },
      },
      include: {
        POItem: { include: { Material: true } },
        Vendor: true,
        Project: true,
      },
    });

    sendCreated(res, po, 'Purchase order created');
  } catch (error) {
    logger.error('Create PO error:', error);
    sendError(res, 'Failed to create purchase order', 500);
  }
};

export const approvePurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });

    if (!po) {
      sendNotFound(res, 'Purchase order not found');
      return;
    }

    if (po.status !== POStatus.SUBMITTED) {
      sendError(res, 'Purchase order is not in submitted state', 400);
      return;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        status: status as POStatus,
        updatedAt: new Date(),
      },
    });

    sendSuccess(res, updated, `Purchase order ${status.toLowerCase()}`);
  } catch (error) {
    sendError(res, 'Failed to process purchase order', 500);
  }
};

export const submitPurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });

    if (!po) {
      sendNotFound(res, 'Purchase order not found');
      return;
    }

    if (po.status !== POStatus.DRAFT) {
      sendError(res, 'Only draft POs can be submitted', 400);
      return;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: { status: POStatus.SUBMITTED, updatedAt: new Date() },
    });

    sendSuccess(res, updated, 'Purchase order submitted for approval');
  } catch (error) {
    sendError(res, 'Failed to submit purchase order', 500);
  }
};

export const recordGoodsReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { notes, items } = req.body;
    const poId = req.params.id;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { POItem: true },
    });

    if (!po) {
      sendNotFound(res, 'Purchase order not found');
      return;
    }

    if (po.status !== POStatus.APPROVED) {
      sendError(res, 'Purchase order must be approved before receiving goods', 400);
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const poItem = po.POItem.find((i) => i.materialId === item.materialId);
        if (!poItem) continue;

        // Update received quantity on POItem
        await tx.pOItem.update({
          where: { id: poItem.id },
          data: { receivedQty: Number(poItem.receivedQty) + Number(item.quantity) },
        });

        // Find or create InventoryItem
        const existing = await tx.inventoryItem.findUnique({
          where: { projectId_materialId: { projectId: po.projectId, materialId: item.materialId } },
        });

        let inventoryItemId: string;

        if (existing) {
          const updated = await tx.inventoryItem.update({
            where: { projectId_materialId: { projectId: po.projectId, materialId: item.materialId } },
            data: {
              quantity: existing.quantity + Number(item.quantity),
              updatedAt: new Date(),
            },
          });
          inventoryItemId = updated.id;
        } else {
          const created = await tx.inventoryItem.create({
            data: {
              id: crypto.randomUUID(),
              projectId: po.projectId,
              materialId: item.materialId,
              quantity: Number(item.quantity),
              minStock: 0,
              unitPrice: poItem.unitPrice,
              updatedAt: new Date(),
            },
          });
          inventoryItemId = created.id;
        }

        // Create stock IN movement
        await tx.stockMovement.create({
          data: {
            id: crypto.randomUUID(),
            inventoryItemId,
            movementType: 'IN',
            quantity: Number(item.quantity),
            unitPrice: poItem.unitPrice,
            reference: po.poNumber,
            notes: notes || `Goods receipt from PO ${po.poNumber}`,
          },
        });
      }

      // Check if all items received
      const updatedPO = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: { POItem: true },
      });

      const allReceived = updatedPO!.POItem.every(
        (i) => Number(i.receivedQty) >= Number(i.quantity)
      );

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: allReceived ? POStatus.RECEIVED : POStatus.PARTIALLY_RECEIVED,
          receivedAt: allReceived ? new Date() : null,
          updatedAt: new Date(),
        },
      });
    });

    sendSuccess(res, null, 'Goods receipt recorded successfully');
  } catch (error) {
    logger.error('Goods receipt error:', error);
    sendError(res, 'Failed to record goods receipt', 500);
  }
};