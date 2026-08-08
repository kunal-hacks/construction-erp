import { Response } from 'express';
import { SalaryStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { getUserProjectIds } from '../middleware/projectScope';
import { logger } from '../utils/logger';
import { createCostTransfer, getWorkerPaidTotal, getTempWorkerPaidTotal  } from '../utils/costTransfer';

const normalize = (s: any) => ({
  ...s,
  user: s.User || null,
  labour: s.Worker ? { name: s.Worker.name, skill: s.Worker.skill } : null,
  project: s.Project || null,
  allowances: s.overtime || 0,
});

// ── Existing manual flow — staff (User) salaries only ──────────────────
export const getSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { month, year, status, projectId } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = { userId: { not: null } }; // staff only now
    if (month) where.month = parseInt(month as string);
    if (year) where.year = parseInt(year as string);
    if (status) where.status = status as SalaryStatus;

    if (allowedProjectIds) {
      where.projectId = projectId && allowedProjectIds.includes(projectId as string) ? projectId : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }

    const [salaries, total] = await Promise.all([
      prisma.salary.findMany({
        where, skip, take,
        include: {
          User: { select: { firstName: true, lastName: true, role: true } },
          Project: { select: { name: true, projectCode: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salary.count({ where }),
    ]);

    sendPaginatedSuccess(res, salaries.map(normalize), total, page, pageSize);
  } catch (error) {
    logger.error('Get salaries error:', error);
    sendError(res, 'Failed to fetch salaries', 500);
  }
};

export const generateSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, projectId, entries } = req.body;
    const allowedProjectIds = await getUserProjectIds(req);

    if (!projectId) { sendError(res, 'projectId is required', 400); return; }
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, "You can't generate salary for a project you're not assigned to", 403);
      return;
    }

    const salaries = await prisma.$transaction(
      entries.map((entry: { userId?: string; basicSalary: number; allowances?: number; deductions?: number }) => {
        const overtime = Number(entry.allowances || 0);
        const deductions = Number(entry.deductions || 0);
        const basicSalary = Number(entry.basicSalary || 0);
        const netSalary = basicSalary + overtime - deductions;

        return prisma.salary.create({
          data: {
            id: crypto.randomUUID(),
            userId: entry.userId || null,
            projectId,
            month: Number(month),
            year: Number(year),
            basicSalary, overtime, deductions, netSalary,
            status: SalaryStatus.PENDING,
          },
        });
      })
    );

    sendCreated(res, salaries.map(normalize), `${salaries.length} salary records generated`);
  } catch (error) {
    logger.error('Generate salary error:', error);
    sendError(res, 'Failed to generate salaries', 500);
  }
};

export const processSalaryPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentMode } = req.body;
    const allowedProjectIds = await getUserProjectIds(req);

    const salary = await prisma.salary.findUnique({ where: { id: req.params.id } });
    if (!salary) { sendError(res, 'Salary record not found', 404); return; }
    if (allowedProjectIds && (!salary.projectId || !allowedProjectIds.includes(salary.projectId))) {
      sendError(res, "You can't process a payment outside your assigned projects", 403);
      return;
    }

    const updated = await prisma.salary.update({
      where: { id: req.params.id },
      data: { status: SalaryStatus.PAID, paidAt: new Date(), notes: paymentMode ? `Payment via ${paymentMode}` : null },
      include: {
        User: { select: { firstName: true, lastName: true, role: true } },
        Project: { select: { name: true, projectCode: true } },
      },
    });

    sendSuccess(res, normalize(updated), 'Salary payment processed');
  } catch (error) {
    logger.error('Process salary payment error:', error);
    sendError(res, 'Failed to process payment', 500);
  }
};

// ── NEW automatic worker ledger — driven by real Attendance ─────────────

// Per-worker earned/paid/pending. Global (all their projects combined) when
// no projectId filter, or scoped to one project.
export const getWorkerSalarySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const workerWhere: Record<string, unknown> = { isActive: true };
    if (projectId) {
      workerWhere.OR = [
        { projectId: projectId as string },
        { WorkerProject: { some: { projectId: projectId as string } } },
      ];
    } else if (allowedProjectIds) {
      workerWhere.OR = [
        { projectId: { in: allowedProjectIds } },
        { WorkerProject: { some: { projectId: { in: allowedProjectIds } } } },
      ];
    }

    const workers = await prisma.worker.findMany({
      where: workerWhere,
      include: { Project: { select: { id: true, name: true } } },
    });

    const summaries = await Promise.all(workers.map(async (w) => {
      const attWhere: Record<string, unknown> = { workerId: w.id, present: true };
      if (projectId) attWhere.projectId = projectId as string;
      else if (allowedProjectIds) attWhere.projectId = { in: allowedProjectIds };

      const earned = await prisma.attendance.aggregate({ where: attWhere, _sum: { wageForDay: true } });
      const totalEarned = earned._sum.wageForDay || 0;
      const totalPaid = await getWorkerPaidTotal(w.id, projectId as string | undefined);

      return {
        workerId: w.id,
        name: w.name,
        skill: w.skill,
        dailyWage: w.dailyWage,
        project: w.Project,
        totalEarned,
        totalPaid,
        pending: totalEarned - totalPaid,
      };
    }));

    sendSuccess(res, summaries.filter((s) => s.totalEarned > 0 || s.pending !== 0));
  } catch (error) {
    logger.error('Get worker salary summary error:', error);
    sendError(res, 'Failed to fetch worker salary summary', 500);
  }
};

export const payWorkerSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { workerId, projectId, amount, date } = req.body;
    if (!workerId || !projectId || !amount || Number(amount) <= 0) {
      sendError(res, 'workerId, projectId and a positive amount are required', 400);
      return;
    }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, "You can't pay against a project you're not assigned to", 403);
      return;
    }

    const [worker, project] = await Promise.all([
      prisma.worker.findUnique({ where: { id: workerId } }),
      prisma.project.findUnique({ where: { id: projectId } }),
    ]);
    if (!worker) { sendError(res, 'Worker not found', 404); return; }
    if (!project) { sendError(res, 'Project not found', 404); return; }

    const earned = await prisma.attendance.aggregate({
      where: { workerId, projectId, present: true },
      _sum: { wageForDay: true },
    });
    const totalEarned = earned._sum.wageForDay || 0;
    const totalPaid = await getWorkerPaidTotal(workerId, projectId);
    const pending = totalEarned - totalPaid;

    if (Number(amount) > pending) {
      sendError(res, `Amount exceeds this worker's pending balance of ₹${pending.toFixed(2)} on this project`, 400);
      return;
    }

    const result = await createCostTransfer({
      projectId,
      module: 'salary',
      workerId,
      amount: Number(amount),
      userId: req.user!.id,
      projectName: project.name,
      date,
      expenseTitle: `Salary — ${worker.name}`,
      expenseCategory: 'Salary',
    });

    sendCreated(res, result, 'Salary payment recorded');
  } catch (error) {
    logger.error('Pay worker salary error:', error);
    sendError(res, 'Failed to record salary payment', 500);
  }
};

export const getTempWorkerSalarySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const projectWhere: Record<string, unknown> = {};
    if (projectId) {
      if (allowedProjectIds && !allowedProjectIds.includes(projectId as string)) {
        sendError(res, "You don't have access to this project", 403);
        return;
      }
      projectWhere.projectId = projectId as string;
    } else if (allowedProjectIds) {
      projectWhere.projectId = { in: allowedProjectIds };
    }

    const rows = await prisma.dailyReportWorker.findMany({
      where: { workerId: null, DailyReport: projectWhere },
      include: { DailyReport: { select: { projectId: true, Project: { select: { id: true, name: true } } } } },
    });

    // Group by (name + project) — the same temp name on two different
    // projects is tracked as two separate pending balances.
    const grouped = new Map<string, { name: string; projectId: string; projectName: string; totalEarned: number }>();
    for (const r of rows) {
      const key = `${r.name.toLowerCase()}::${r.DailyReport.projectId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.totalEarned += r.wageForDay;
      } else {
        grouped.set(key, {
          name: r.name,
          projectId: r.DailyReport.projectId,
          projectName: r.DailyReport.Project.name,
          totalEarned: r.wageForDay,
        });
      }
    }

    const summaries = await Promise.all(
      Array.from(grouped.values()).map(async (g) => {
        const totalPaid = await getTempWorkerPaidTotal(g.name, g.projectId);
        return { ...g, totalPaid, pending: g.totalEarned - totalPaid };
      })
    );

    sendSuccess(res, summaries.filter((s) => s.totalEarned > 0 || s.pending !== 0));
  } catch (error) {
    logger.error('Get temp worker salary summary error:', error);
    sendError(res, 'Failed to fetch temp worker salary summary', 500);
  }
};

export const payTempWorkerSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { workerName, projectId, amount, date } = req.body;
    if (!workerName || !projectId || !amount || Number(amount) <= 0) {
      sendError(res, 'workerName, projectId and a positive amount are required', 400);
      return;
    }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, "You can't pay against a project you're not assigned to", 403);
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) { sendError(res, 'Project not found', 404); return; }

    const rows = await prisma.dailyReportWorker.findMany({
      where: { workerId: null, name: { equals: workerName, mode: 'insensitive' }, DailyReport: { projectId } },
      select: { wageForDay: true },
    });
    const totalEarned = rows.reduce((sum, r) => sum + r.wageForDay, 0);
    const totalPaid = await getTempWorkerPaidTotal(workerName, projectId);
    const pending = totalEarned - totalPaid;

    if (Number(amount) > pending) {
      sendError(res, `Amount exceeds this worker's pending balance of ₹${pending.toFixed(2)} on this project`, 400);
      return;
    }

    const result = await createCostTransfer({
      projectId,
      module: 'salary',
      workerName,
      amount: Number(amount),
      userId: req.user!.id,
      projectName: project.name,
      date,
      expenseTitle: `Salary — ${workerName} (temp)`,
      expenseCategory: 'Salary',
    });

    sendCreated(res, result, 'Salary payment recorded');
  } catch (error) {
    logger.error('Pay temp worker salary error:', error);
    sendError(res, 'Failed to record salary payment', 500);
  }
};