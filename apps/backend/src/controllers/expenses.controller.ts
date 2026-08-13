import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds } from '../middleware/projectScope';

export const getExpenses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, category, startDate, endDate, search } = req.query;

    // Scope to user's projects if not admin
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};

    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (category) where.category = category as string;
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (startDate || endDate) {
      where.expenseDate = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take,
        include: {
          Project: { select: { id: true, name: true, projectCode: true } },
          User: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { expenseDate: 'desc' },
      }),
      prisma.expense.count({ where }),
    ]);

    sendPaginatedSuccess(res, expenses, total, page, pageSize);
  } catch (error) {
    logger.error('Get expenses error:', error);
    sendError(res, 'Failed to fetch expenses', 500);
  }
};

export const getExpenseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        Project: { select: { id: true, name: true, projectCode: true } },
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!expense) {
      sendNotFound(res, 'Expense not found');
      return;
    }

    sendSuccess(res, expense);
  } catch (error) {
    logger.error('Get expense error:', error);
    sendError(res, 'Failed to fetch expense', 500);
  }
};

export const createExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, title, description, expenseDate, amount, category, vendorName, invoiceNo, receiptUrl } = req.body;

    const expense = await prisma.expense.create({
      data: {
        id: randomUUID(),
        projectId,
        userId: req.user!.id,
        title,
        description: description || null,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        amount: Number(amount),
        category: category as string,
        vendorName: vendorName || null,
        invoiceNo: invoiceNo || null,
        receiptUrl: receiptUrl || null,
        status: 'APPROVED',        // auto-approved
        approvedBy: req.user!.id,  // approved by the creator
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        Project: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    sendCreated(res, expense, 'Expense created successfully');
  } catch (error) {
    logger.error('Create expense error:', error);
    sendError(res, 'Failed to create expense', 500);
  }
};

export const updateExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) {
      sendNotFound(res, 'Expense not found');
      return;
    }

    const { title, description, expenseDate, amount, category, vendorName, invoiceNo, receiptUrl } = req.body;

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(expenseDate && { expenseDate: new Date(expenseDate) }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(category && { category: category as string }),
        ...(vendorName !== undefined && { vendorName: vendorName || null }),
        ...(invoiceNo !== undefined && { invoiceNo: invoiceNo || null }),
        ...(receiptUrl !== undefined && { receiptUrl }),
        updatedAt: new Date(),
      },
    });

    sendSuccess(res, updated, 'Expense updated successfully');
  } catch (error) {
    logger.error('Update expense error:', error);
    sendError(res, 'Failed to update expense', 500);
  }
};

export const deleteExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) {
      sendNotFound(res, 'Expense not found');
      return;
    }

    await prisma.expense.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Expense deleted successfully');
  } catch (error) {
    logger.error('Delete expense error:', error);
    sendError(res, 'Failed to delete expense', 500);
  }
};

export const getExpenseSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, year, month } = req.query;

    const where: Record<string, unknown> = { status: 'APPROVED' };
    if (projectId) where.projectId = projectId as string;
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      if (month) {
        startDate.setMonth(parseInt(month as string) - 1);
        endDate.setMonth(parseInt(month as string));
        endDate.setDate(0);
      }
      where.expenseDate = { gte: startDate, lte: endDate };
    }

    const [byCategory, byProject, total] = await Promise.all([
      prisma.expense.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.groupBy({
        by: ['projectId'],
        where,
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    sendSuccess(res, { byCategory, byProject, total });
  } catch (error) {
    logger.error('Get expense summary error:', error);
    sendError(res, 'Failed to fetch summary', 500);
  }
};

