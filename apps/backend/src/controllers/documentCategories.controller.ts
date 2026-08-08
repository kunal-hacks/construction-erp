import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getDocumentCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { module } = req.query;
    const categories = await prisma.documentCategory.findMany({
      where: module ? { module: module as string } : undefined,
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, categories);
  } catch (error) {
    logger.error('Get document categories error:', error);
    sendError(res, 'Failed to fetch categories', 500);
  }
};

export const createDocumentCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { module, name } = req.body;
    if (!module || !name) {
      sendError(res, 'Module and name are required', 400);
      return;
    }

    // If it already exists (case-insensitive), just return it instead of
    // erroring — same forgiving behavior as picking an existing vendor.
    const existing = await prisma.documentCategory.findFirst({
      where: { module, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      sendSuccess(res, existing, 'Category already exists');
      return;
    }

    const category = await prisma.documentCategory.create({
      data: { id: crypto.randomUUID(), module, name, createdBy: req.user!.id },
    });
    sendCreated(res, category, 'Category created successfully');
  } catch (error) {
    logger.error('Create document category error:', error);
    sendError(res, 'Failed to create category', 500);
  }
};