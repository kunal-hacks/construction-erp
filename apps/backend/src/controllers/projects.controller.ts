import { Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { search, status } = req.query;
    const user = req.user!;
    const where: any = {};

    if (!['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(user.role)) {
      where.ProjectMember = { some: { userId: user.id } };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { projectCode: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where, skip, take,
        include: {
          ProjectMember: {
            include: {
              User: { select: { id: true, firstName: true, lastName: true, role: true } },
            },
          },
          _count: { select: { Task: true, DailyReport: true, Expense: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    sendPaginatedSuccess(res, projects, total, page, pageSize);
  } catch (error) {
    logger.error('Get projects error:', error);
    sendError(res, 'Failed to fetch projects', 500);
  }
};

export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        ProjectMember: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
          },
        },
        _count: { select: { Task: true, DailyReport: true, Expense: true } },
      },
    });
    if (!project) { sendNotFound(res, 'Project not found'); return; }
    sendSuccess(res, project);
  } catch (error) {
    logger.error('Get project error:', error);
    sendError(res, 'Failed to fetch project', 500);
  }
};

export const getProjectDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) { sendNotFound(res, 'Project not found'); return; }

    const [totalExpenses, approvedExpenses, pendingTasks, completedTasks, recentReports] = await Promise.all([
      prisma.expense.aggregate({ where: { projectId: id }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { projectId: id, status: 'APPROVED' }, _sum: { amount: true } }),
      prisma.task.count({ where: { projectId: id, status: { not: 'DONE' } } }),
      prisma.task.count({ where: { projectId: id, status: 'DONE' } }),
      prisma.dailyReport.findMany({ where: { projectId: id }, orderBy: { reportDate: 'desc' }, take: 5 }),
    ]);

    const budget = Number(project.budget) || 0;
    const approved = Number(approvedExpenses._sum.amount || 0);
    const budgetUsed = budget > 0 ? ((approved / budget) * 100).toFixed(1) : '0';

    sendSuccess(res, {
      project,
      stats: {
        totalExpenses: Number(totalExpenses._sum.amount || 0),
        approvedExpenses: approved,
        budgetUsed: parseFloat(budgetUsed),
        budgetRemaining: budget - approved,
        pendingTasks,
        completedTasks,
      },
      recentReports,
    });
  } catch (error) {
    logger.error('Get project dashboard error:', error);
    sendError(res, 'Failed to fetch dashboard', 500);
  }
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name, description, clientName, clientEmail, clientPhone,
      location, budget, startDate, endDate, status
    } = req.body;

    if (!name) { sendError(res, 'Project name is required', 400); return; }
    if (!clientName) { sendError(res, 'Client name is required', 400); return; }
    if (!startDate) { sendError(res, 'Start date is required', 400); return; }

    // Remove null bytes that PostgreSQL rejects
    const clean = (val: any) =>
      typeof val === 'string' ? val.replace(/\0/g, '').trim() || null : val ?? null;

    const count = await prisma.project.count();
    const projectCode = `PROJ-${String(count + 1).padStart(4, '0')}`;

    const project = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: clean(name)!,
        description: clean(description),
        clientName: clean(clientName)!,
        clientEmail: clean(clientEmail),
        clientPhone: clean(clientPhone),
        location: clean(location),
        budget: budget ? parseFloat(String(budget)) : 0,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'PLANNING',
        projectCode,
        progress: 0,
        updatedAt: new Date(),
        ProjectMember: {
          create: {
            id: randomUUID(),
            userId: req.user!.id,
            role: 'Project Director',
          },
        },
      },
      include: {
        ProjectMember: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    sendCreated(res, project, 'Project created successfully');
  } catch (error: any) {
    logger.error('Create project error:', error);
    sendError(res, error.message || 'Failed to create project', 500);
  }
};

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name, description, clientName, clientEmail, clientPhone,
      location, budget, startDate, endDate, status, progress
    } = req.body;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(clientName && { clientName }),
        ...(clientEmail !== undefined && { clientEmail }),
        ...(clientPhone !== undefined && { clientPhone }),
        ...(location !== undefined && { location }),
        ...(budget !== undefined && { budget: parseFloat(String(budget)) }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(status && { status }),
        ...(progress !== undefined && { progress: parseFloat(String(progress)) }),
        updatedAt: new Date(),
      },
    });
    sendSuccess(res, project, 'Project updated successfully');
  } catch (error: any) {
    logger.error('Update project error:', error);
    sendError(res, 'Failed to update project', 500);
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.project.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', updatedAt: new Date() },
    });
    sendSuccess(res, null, 'Project cancelled');
  } catch (error) {
    logger.error('Delete project error:', error);
    sendError(res, 'Failed to delete project', 500);
  }
};

export const addProjectMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.body;
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId } },
    });
    if (existing) {
      const updated = await prisma.projectMember.update({
        where: { projectId_userId: { projectId: req.params.id, userId } },
        data: { role },
      });
      sendSuccess(res, updated, 'Member role updated');
      return;
    }
    const member = await prisma.projectMember.create({
      data: { id: randomUUID(), projectId: req.params.id, userId, role },
    });
    sendCreated(res, member, 'Member added');
  } catch (error) {
    logger.error('Add member error:', error);
    sendError(res, 'Failed to add member', 500);
  }
};

export const removeProjectMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    });
    sendSuccess(res, null, 'Member removed');
  } catch (error) {
    logger.error('Remove member error:', error);
    sendError(res, 'Failed to remove member', 500);
  }
};