import { Response } from 'express';
import { ProjectStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { getUserProjectIds, ADMIN_ROLES } from '../middleware/projectScope';
import { logger } from '../utils/logger';
import { UPLOAD_ROOT, ensureDir, sanitizeSegment } from '../utils/uploadPaths';
import path from 'path';

// Throws-free helper: returns true if this user is allowed to touch this project
const canAccessProject = (allowedProjectIds: string[] | undefined, projectId: string) =>
  !allowedProjectIds || allowedProjectIds.includes(projectId);

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { search, status } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};

    if (allowedProjectIds) {
      where.id = { in: allowedProjectIds };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { projectCode: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status as ProjectStatus;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take,
        include: {
          ProjectMember: {
            include: {
              User: { select: { id: true, firstName: true, lastName: true, role: true } },
            },
          },
          _count: {
            select: { Task: true, DailyReport: true, Expense: true },
          },
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
    const allowedProjectIds = await getUserProjectIds(req);

    // Block before ever hitting the DB for the real record — a PM asking about
    // a project they're not on should get exactly the same response as a
    // project that doesn't exist at all. Don't leak existence.
    if (!canAccessProject(allowedProjectIds, req.params.id)) {
      sendNotFound(res, 'Project not found');
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        ProjectMember: {
          include: {
            User: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true },
            },
          },
        },
        _count: {
          select: {
            Task: true,
            DailyReport: true,
            Expense: true,
            TruckEntry: true,
            Document: true,
          },
        },
      },
    });

    if (!project) {
      sendNotFound(res, 'Project not found');
      return;
    }

    const totalExpenses = await prisma.expense.aggregate({
      where: { projectId: req.params.id, status: 'APPROVED' },
      _sum: { amount: true },
    });

    const projectWithStats = {
      ...project,
      budgetUtilization: totalExpenses._sum.amount
        ? (Number(totalExpenses._sum.amount) / Number(project.budget) * 100).toFixed(2)
        : '0.00',
    };

    sendSuccess(res, projectWithStats);
  } catch (error) {
    logger.error('Get project error:', error);
    sendError(res, 'Failed to fetch project', 500);
  }
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Only admins create projects from scratch — a PM being "assigned" a new
    // project still goes through an admin creating it, per the user-creation flow.
    if (!ADMIN_ROLES.includes(req.user!.role)) {
      sendError(res, 'Only admins can create projects', 403);
      return;
    }

    const {
      name, clientName, clientEmail, clientPhone,
      location, budget, startDate, endDate,
      description, memberIds,
    } = req.body;

    const count = await prisma.project.count();
    const projectCode = `PROJ-${String(count + 1).padStart(4, '0')}`;

    const project = await prisma.project.create({
      data: {
        id: crypto.randomUUID(),
        name,
        projectCode,
        clientName,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        location: location || null,
        budget,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        description: description || null,
        progress: 0,
        updatedAt: new Date(),
        ProjectMember: {
          create: memberIds?.map((userId: string) => ({
            id: crypto.randomUUID(),
            userId,
            role: 'VIEWER',
          })) || [],
        },
      },
      include: {
        ProjectMember: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
    });

    // Auto-create this project's upload folder (uploads/{projectCode}/) —
    // module/category subfolders (expenses/, Materials/, etc.) get created
    // lazily on first actual upload, so we don't need to pre-create every
    // possible combination here.
    ensureDir(path.join(UPLOAD_ROOT, sanitizeSegment(project.projectCode)));

    sendCreated(res, project, 'Project created successfully');
  } catch (error) {
    logger.error('Create project error:', error);
    sendError(res, 'Failed to create project', 500);
  }
};

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedProjectIds = await getUserProjectIds(req);
    if (!canAccessProject(allowedProjectIds, req.params.id)) {
      sendNotFound(res, 'Project not found');
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      sendNotFound(res, 'Project not found');
      return;
    }

    const {
      name, location, budget, startDate, endDate,
      status, description, progress,
      clientName, clientEmail, clientPhone,
    } = req.body;

    // A PM can update day-to-day fields (progress, description) on their own
    // project, but shouldn't be able to change budget, dates, status, or
    // client info — those are admin decisions.
    const isAdmin = ADMIN_ROLES.includes(req.user!.role);

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(isAdmin && name && { name }),
        ...(isAdmin && location !== undefined && { location }),
        ...(isAdmin && clientName && { clientName }),
        ...(isAdmin && clientEmail !== undefined && { clientEmail }),
        ...(isAdmin && clientPhone !== undefined && { clientPhone }),
        ...(isAdmin && budget && { budget }),
        ...(isAdmin && startDate && { startDate: new Date(startDate) }),
        ...(isAdmin && endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isAdmin && status && { status: status as ProjectStatus }),
        ...(description !== undefined && { description }),
        ...(progress !== undefined && { progress }),
        updatedAt: new Date(),
      },
    });

    sendSuccess(res, updated, 'Project updated successfully');
  } catch (error) {
    logger.error('Update project error:', error);
    sendError(res, 'Failed to update project', 500);
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Cancelling a project is an admin-only action, full stop.
    if (!ADMIN_ROLES.includes(req.user!.role)) {
      sendError(res, 'Only admins can cancel projects', 403);
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      sendNotFound(res, 'Project not found');
      return;
    }

    await prisma.project.update({
      where: { id: req.params.id },
      data: { status: ProjectStatus.CANCELLED, updatedAt: new Date() },
    });

    sendSuccess(res, null, 'Project cancelled successfully');
  } catch (error) {
    logger.error('Delete project error:', error);
    sendError(res, 'Failed to cancel project', 500);
  }
};

export const addProjectMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Only admins assign people to projects — this is how PM assignment itself works,
    // so a PM granting themselves/others access here would be a privilege escalation.
    if (!ADMIN_ROLES.includes(req.user!.role)) {
      sendError(res, 'Only admins can add project members', 403);
      return;
    }

    const { userId, role } = req.body;
    const { id: projectId } = req.params;

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (existing) {
      sendError(res, 'User is already a member of this project', 409);
      return;
    }

    const member = await prisma.projectMember.create({
      data: {
        id: crypto.randomUUID(),
        projectId,
        userId,
        role: role as string,
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });

    sendCreated(res, member, 'Member added successfully');
  } catch (error) {
    logger.error('Add project member error:', error);
    sendError(res, 'Failed to add member', 500);
  }
};

export const removeProjectMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ADMIN_ROLES.includes(req.user!.role)) {
      sendError(res, 'Only admins can remove project members', 403);
      return;
    }

    const { id: projectId, userId } = req.params;

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });

    sendSuccess(res, null, 'Member removed successfully');
  } catch (error) {
    logger.error('Remove project member error:', error);
    sendError(res, 'Failed to remove member', 500);
  }
};

export const getProjectDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const allowedProjectIds = await getUserProjectIds(req);

    if (!canAccessProject(allowedProjectIds, id)) {
      sendNotFound(res, 'Project not found');
      return;
    }

    const [project, recentReportsRaw, recentExpenses, taskStats, inventory] = await Promise.all([
      prisma.project.findUnique({ where: { id } }),
      prisma.dailyReport.findMany({
        where: { projectId: id },
        take: 7,
        orderBy: { reportDate: 'desc' },
        include: { User: { select: { firstName: true, lastName: true } } },
      }),
      prisma.expense.findMany({
        where: { projectId: id, status: 'APPROVED' },
        take: 10,
        orderBy: { expenseDate: 'desc' },
      }),
      prisma.task.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: { status: true },
      }),
      prisma.inventoryItem.findMany({
        where: { projectId: id },
        include: { Material: true },
        take: 10,
      }),
    ]);

    if (!project) {
      sendNotFound(res, 'Project not found');
      return;
    }

    // The reports list endpoint (dailyReports.controller.ts) normalizes
    // progress → completionPct and User → submitter before returning data.
    // This dashboard endpoint queries the same DailyReport rows directly and
    // was skipping that step — the frontend read a field (`completionPct`)
    // that never existed on the raw response, producing NaN%. Apply the same
    // mapping here so both endpoints hand back the same shape.
    const recentReports = recentReportsRaw.map((r) => ({
      ...r,
      completionPct: r.progress,
      submitter: r.User,
    }));

    const totalExpenses = recentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const taskSummary = taskStats.reduce((acc, t) => {
      acc[t.status] = t._count.status;
      return acc;
    }, {} as Record<string, number>);

    sendSuccess(res, {
      project,
      stats: {
        totalExpenses,
        budgetUsed: (totalExpenses / Number(project.budget) * 100).toFixed(2),
        taskSummary,
        inventoryCount: inventory.length,
      },
      recentReports,
      recentExpenses,
      inventory,
    });
  } catch (error) {
    logger.error('Get project dashboard error:', error);
    sendError(res, 'Failed to fetch dashboard', 500);
  }
};