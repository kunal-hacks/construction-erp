import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getTaskTypes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { trade } = req.query;
    const taskTypes = await prisma.taskType.findMany({
      where: { isActive: true, ...(trade ? { trade: trade as string } : {}) },
      include: { MaterialCoefficient: { include: { Material: { select: { id: true, name: true, unit: true } } } } },
      orderBy: [{ trade: 'asc' }, { name: 'asc' }],
    });
    sendSuccess(res, taskTypes);
  } catch (error) {
    logger.error('Get task types error:', error);
    sendError(res, 'Failed to fetch task types', 500);
  }
};

export const getTaskTypeById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskType = await prisma.taskType.findUnique({
      where: { id: req.params.id },
      include: { MaterialCoefficient: { include: { Material: true } } },
    });
    if (!taskType) { sendNotFound(res, 'Task type not found'); return; }
    sendSuccess(res, taskType);
  } catch (error) {
    logger.error('Get task type error:', error);
    sendError(res, 'Failed to fetch task type', 500);
  }
};

// Admin-only — this is the reference standards library, not something
// every PM should be able to edit.
export const createTaskType = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name, trade, unit, hasStandard, outputPerDay,
      efficiencyFactor, helperRatio, sourceCitation, materials,
    } = req.body;

    if (!name || !trade || !unit) {
      sendError(res, 'name, trade and unit are required', 400);
      return;
    }
    if (hasStandard && !outputPerDay) {
      sendError(res, 'outputPerDay is required when hasStandard is true', 400);
      return;
    }

    const taskType = await prisma.taskType.create({
      data: {
        id: randomUUID(),
        name,
        trade,
        unit,
        hasStandard: hasStandard ?? true,
        outputPerDay: hasStandard ? Number(outputPerDay) : null,
        efficiencyFactor: efficiencyFactor !== undefined ? Number(efficiencyFactor) : 0.85,
        helperRatio: helperRatio !== undefined && helperRatio !== '' ? Number(helperRatio) : null,
        sourceCitation: sourceCitation || null,
        MaterialCoefficient: {
          create: (materials || []).map((m: { materialId: string; qtyPerUnit: number }) => ({
            id: randomUUID(),
            materialId: m.materialId,
            qtyPerUnit: Number(m.qtyPerUnit),
          })),
        },
      },
      include: { MaterialCoefficient: { include: { Material: true } } },
    });

    sendCreated(res, taskType, 'Task type created successfully');
  } catch (error) {
    logger.error('Create task type error:', error);
    sendError(res, 'Failed to create task type', 500);
  }
};

export const updateTaskType = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.taskType.findUnique({ where: { id: req.params.id } });
    if (!existing) { sendNotFound(res, 'Task type not found'); return; }

    const {
      name, unit, hasStandard, outputPerDay,
      efficiencyFactor, helperRatio, sourceCitation, isActive,
    } = req.body;

    const updated = await prisma.taskType.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(unit && { unit }),
        ...(hasStandard !== undefined && { hasStandard }),
        ...(outputPerDay !== undefined && { outputPerDay: outputPerDay !== '' ? Number(outputPerDay) : null }),
        ...(efficiencyFactor !== undefined && { efficiencyFactor: Number(efficiencyFactor) }),
        ...(helperRatio !== undefined && { helperRatio: helperRatio !== '' ? Number(helperRatio) : null }),
        ...(sourceCitation !== undefined && { sourceCitation }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    sendSuccess(res, updated, 'Task type updated successfully');
  } catch (error) {
    logger.error('Update task type error:', error);
    sendError(res, 'Failed to update task type', 500);
  }
};

// Adds/updates a single material coefficient without needing to resend the
// whole TaskType — used by the Admin page's "+ Add Material" row.
export const upsertMaterialCoefficient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: taskTypeId } = req.params;
    const { materialId, qtyPerUnit } = req.body;

    const taskType = await prisma.taskType.findUnique({ where: { id: taskTypeId } });
    if (!taskType) { sendNotFound(res, 'Task type not found'); return; }

    const existing = await prisma.materialCoefficient.findFirst({ where: { taskTypeId, materialId } });

    const result = existing
      ? await prisma.materialCoefficient.update({
          where: { id: existing.id },
          data: { qtyPerUnit: Number(qtyPerUnit) },
        })
      : await prisma.materialCoefficient.create({
          data: { id: randomUUID(), taskTypeId, materialId, qtyPerUnit: Number(qtyPerUnit) },
        });

    sendSuccess(res, result, 'Material coefficient saved');
  } catch (error) {
    logger.error('Upsert material coefficient error:', error);
    sendError(res, 'Failed to save material coefficient', 500);
  }
};

export const deleteMaterialCoefficient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.materialCoefficient.delete({ where: { id: req.params.coefficientId } });
    sendSuccess(res, null, 'Material coefficient removed');
  } catch (error) {
    logger.error('Delete material coefficient error:', error);
    sendError(res, 'Failed to remove material coefficient', 500);
  }
};

