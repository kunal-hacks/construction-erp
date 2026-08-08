import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { getUserProjectIds } from '../middleware/projectScope';
import { logger } from '../utils/logger';

export const getAdminDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // undefined = admin, no filter. array (possibly empty) = PM, restrict to these project ids.
    const allowedProjectIds = await getUserProjectIds(req);
    const projectFilter = allowedProjectIds ? { id: { in: allowedProjectIds } } : {};
    const scopedProjectId = allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {};

    const [
      totalProjects,
      activeProjects,
      totalExpenses,
      pendingExpenses,
      inventoryValue,
      pendingPurchaseOrders,
      recentActivity,
      projectsByStatus,
    ] = await Promise.all([
      prisma.project.count({ where: projectFilter }),
      prisma.project.count({ where: { ...projectFilter, status: 'ACTIVE' } }),
      prisma.expense.aggregate({
        where: { status: 'APPROVED', ...scopedProjectId },
        _sum: { amount: true },
      }),
      prisma.expense.count({ where: { status: 'PENDING', ...scopedProjectId } }),
      prisma.inventoryItem.aggregate({
        where: scopedProjectId,
        _sum: { quantity: true },              // currentStock → quantity
      }),
      prisma.purchaseOrder.count({ where: { status: 'SUBMITTED', ...scopedProjectId } }),
      prisma.auditLog.findMany({
        take: 10,
        // AuditLog has no projectId — a PM has no business seeing system-wide activity,
        // so scope it to actions they themselves performed.
        where: allowedProjectIds ? { userId: req.user!.id } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          User: { select: { firstName: true, lastName: true } },  // user → User
        },
      }),
      prisma.project.groupBy({
        by: ['status'],
        where: projectFilter,
        _count: { status: true },
      }),
    ]);

    const pendingApprovals = pendingExpenses + pendingPurchaseOrders;

    // Monthly expense trend
    const currentYear = new Date().getFullYear();
    const expenses = await prisma.expense.findMany({
      where: {
        status: 'APPROVED',                   // approvalStatus → status
        ...scopedProjectId,
        expenseDate: {                        // date → expenseDate
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`),
        },
      },
      select: {
        expenseDate: true,                    // date → expenseDate
        amount: true,
      },
    });

    const monthlyMap = new Map<number, number>();
    expenses.forEach((e) => {
      const month = new Date(e.expenseDate).getMonth() + 1;
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + Number(e.amount));
    });

    const monthlyExpenses = Array.from(monthlyMap.entries()).map(([month, total]) => ({
      month,
      total,
    }));

        const projectsForBudget = await prisma.project.findMany({
      where: projectFilter,
      select: { budget: true },
    });
    const totalBudgetValue = projectsForBudget.reduce(
      (sum, p) => sum + (Number(p.budget) || 0),
      0
    );

    sendSuccess(res, {
      overview: {
        totalProjects,
        activeProjects,
        totalExpenses: totalExpenses._sum.amount || 0,
        pendingApprovals: pendingExpenses,
        totalBudget: totalBudgetValue,
        budgetUtilization: totalBudgetValue
          ? ((Number(totalExpenses._sum.amount || 0) / totalBudgetValue) * 100).toFixed(2)
          : '0',
      },
      projectsByStatus,
      monthlyExpenses,
      recentActivity,
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    sendError(res, 'Failed to fetch dashboard', 500);
  }
};

export const getExpenseAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedProjectIds = await getUserProjectIds(req);
    const { projectId, year } = req.query;
    const currentYear = year ? parseInt(year as string) : new Date().getFullYear();

    // Resolve the effective project filter: a PM can narrow to one of THEIR projects
    // via ?projectId=, but can never use it to reach into a project they're not on.
    const resolveProjectFilter = (): Record<string, unknown> => {
      if (!allowedProjectIds) {
        // admin — free to filter by any single project, or see all
        return projectId ? { projectId: projectId as string } : {};
      }
      if (projectId && allowedProjectIds.includes(projectId as string)) {
        return { projectId: projectId as string };
      }
      return { projectId: { in: allowedProjectIds } };
    };

    const where: Record<string, unknown> = { status: 'APPROVED', ...resolveProjectFilter() };  // approvalStatus → status

    // By category
    const byCategory = await prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    // By month for the year
    const monthlyWhere: Record<string, unknown> = {
      status: 'APPROVED',                     // approvalStatus → status
      ...resolveProjectFilter(),
      expenseDate: {                          // date → expenseDate
        gte: new Date(`${currentYear}-01-01`),
        lte: new Date(`${currentYear}-12-31`),
      },
    };

    const byMonth = await prisma.expense.groupBy({
      by: ['category'],
      where: monthlyWhere,
      _sum: { amount: true },
    });

    // Top vendors by spend (vendorName, not vendorId — schema mein vendorId nahi hai)
    const topVendors = await prisma.expense.groupBy({
      by: ['vendorName'],
      where: { ...where, vendorName: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    sendSuccess(res, { byCategory, byMonth, topVendors });
  } catch (error) {
    logger.error('Expense analytics error:', error);
    sendError(res, 'Failed to fetch analytics', 500);
  }
};

export const getInventoryAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedProjectIds = await getUserProjectIds(req);
    const { projectId } = req.query;

    const where: Record<string, unknown> = {};
    if (!allowedProjectIds) {
      if (projectId) where.projectId = projectId as string;
    } else if (projectId && allowedProjectIds.includes(projectId as string)) {
      where.projectId = projectId as string;
    } else {
      where.projectId = { in: allowedProjectIds };
    }

    const [totalItems, recentMovements, inventoryItems] = await Promise.all([
      prisma.inventoryItem.count({ where }),
      prisma.stockMovement.findMany({
        take: 20,
        orderBy: { movedAt: 'desc' },         // date → movedAt
        where: { InventoryItem: where },      // reach the same project scope through the relation
        include: {
          InventoryItem: {                    // material → InventoryItem (schema relation)
            include: {
              Material: { select: { name: true, unit: true } },
            },
          },
        },
      }),
      prisma.inventoryItem.findMany({
        where,
        select: {
          quantity: true,                     // currentStock → quantity
          minStock: true,                     // material.minStockLevel → minStock (direct field)
        },
      }),
    ]);

    const lowStockItems = inventoryItems.filter(
      (item) => item.quantity <= item.minStock
    ).length;

    // Consumption by material from stock movements
    const consumptionByMaterial = await prisma.stockMovement.groupBy({
      by: ['inventoryItemId'],
      where: { movementType: 'OUT', InventoryItem: where },  // type: 'CONSUMPTION' → movementType: 'OUT'
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    sendSuccess(res, { totalItems, lowStockItems, recentMovements, consumptionByMaterial });
  } catch (error) {
    logger.error('Inventory analytics error:', error);
    sendError(res, 'Failed to fetch analytics', 500);
  }
};

export const getBudgetAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedProjectIds = await getUserProjectIds(req);

    const projects = await prisma.project.findMany({
      where: {
        status: { in: ['ACTIVE', 'COMPLETED'] },
        ...(allowedProjectIds ? { id: { in: allowedProjectIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        projectCode: true,                    // code → projectCode
        budget: true,
        status: true,
        _count: { select: { Expense: true } }, // expenses → Expense
      },
    });

    const projectsWithSpend = await Promise.all(
      projects.map(async (p) => {
        const spend = await prisma.expense.aggregate({
          where: { projectId: p.id, status: 'APPROVED' },  // approvalStatus → status
          _sum: { amount: true },
        });
        const spent = Number(spend._sum.amount || 0);
        const budget = Number(p.budget);
        return {
          ...p,
          spent,
          remaining: budget - spent,
          utilizationPct: budget > 0 ? ((spent / budget) * 100).toFixed(2) : '0',
          isOverBudget: spent > budget,
        };
      })
    );

    sendSuccess(res, projectsWithSpend);
  } catch (error) {
    logger.error('Budget analysis error:', error);
    sendError(res, 'Failed to fetch budget analysis', 500);
  }
};

export const getMachineryAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Not project-scoped: MachineryLog has no projectId in the schema — machinery is a
    // shared, rented-by-the-hour fleet across all projects, not owned by one project.
    // Every user (admin or PM) sees the same fleet-wide numbers here on purpose.
    const { projectId, startDate, endDate } = req.query;

    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.logDate = {                       // date → logDate
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    // MachineryLog schema fields: hoursUsed, fuelUsed (not runningHours/fuelConsumed)
    const [utilization, fuelConsumption] = await Promise.all([
      prisma.machineryLog.aggregate({
        where,
        _sum: { hoursUsed: true, fuelUsed: true },  // runningHours → hoursUsed, fuelConsumed → fuelUsed
        _count: { id: true },
      }),
      prisma.machineryLog.groupBy({
        by: ['machineryId'],
        where,
        _sum: { hoursUsed: true, fuelUsed: true },
        orderBy: { _sum: { fuelUsed: 'desc' } },
        take: 10,
      }),
    ]);

    const byMachinery = await prisma.machinery.findMany({
      include: {
        MachineryLog: true,                   // logs → MachineryLog
        ProjectMachinery: true,               // maintenanceRecords nahi hai schema mein
      },
    });

    sendSuccess(res, { utilization, fuelConsumption, byMachinery });
  } catch (error) {
    sendError(res, 'Failed to fetch machinery analytics', 500);
  }
};