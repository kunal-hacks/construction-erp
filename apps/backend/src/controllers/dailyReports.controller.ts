import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds } from '../middleware/projectScope';
import { deductMaterial } from '../utils/taskProgress';

const normalize = (r: Record<string, unknown>) => ({
  ...r,
  project: r.Project,
  submitter: r.User,
  task: r.Task || null,
  workers: (r.DailyReportWorker as any[] || []).map((w) => ({
    id: w.id, name: w.name, workerId: w.workerId, role: w.role, wageForDay: w.wageForDay,
  })),
  materialsUsed: (r.DailyReportMaterial as any[] || []).map((m) => ({
    id: m.id, materialId: m.materialId, quantityUsed: m.quantityUsed, material: m.Material,
  })),
  completionPct: r.progress,
  photos: [],
  isOffline: false,
  notes: r.issuesFound || r.safetyNotes || null,
});

export const getDailyReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, taskId, startDate, endDate } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};
    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (taskId) where.taskId = taskId as string;
    if (startDate || endDate) {
      where.reportDate = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [reports, total] = await Promise.all([
      prisma.dailyReport.findMany({
        where, skip, take,
        include: {
          Project: { select: { id: true, name: true, projectCode: true } },
          User: { select: { id: true, firstName: true, lastName: true } },
          Task: { select: { id: true, title: true } },
          DailyReportWorker: true,
          DailyReportMaterial: { include: { Material: { select: { id: true, name: true, unit: true } } } },
        },
        orderBy: { reportDate: 'desc' },
      }),
      prisma.dailyReport.count({ where }),
    ]);

    sendPaginatedSuccess(res, reports.map(r => normalize(r as unknown as Record<string, unknown>)), total, page, pageSize);
  } catch (error) {
    logger.error('Get reports error:', error);
    sendError(res, 'Failed to fetch reports', 500);
  }
};

export const getDailyReportById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await prisma.dailyReport.findUnique({
      where: { id: req.params.id },
      include: {
        Project: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true } },
        Task: { select: { id: true, title: true } },
        DailyReportWorker: true,
        DailyReportMaterial: { include: { Material: true } },
      },
    });
    if (!report) { sendNotFound(res, 'Report not found'); return; }
    sendSuccess(res, normalize(report as unknown as Record<string, unknown>));
  } catch (error) {
    logger.error('Get report error:', error);
    sendError(res, 'Failed to fetch report', 500);
  }
};

export const getWorkerOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    if (!projectId) { sendError(res, 'projectId is required', 400); return; }

    // Permanent workers — home project OR additionally assigned via WorkerProject.
    const existingWorkers = await prisma.worker.findMany({
      where: {
        isActive: true,
        OR: [
          { projectId: projectId as string },
          { WorkerProject: { some: { projectId: projectId as string } } },
        ],
      },
      select: { id: true, name: true, skill: true, dailyWage: true },
      orderBy: { name: 'asc' },
    });

    // Temp workers — anyone entered with no workerId on THIS project's
    // reports, used at least once in the last 10 days (rolling: any usage
    // within the window keeps them visible, not just their first mention).
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const recentTempRows = await prisma.dailyReportWorker.findMany({
      where: {
        workerId: null,
        DailyReport: { projectId: projectId as string, reportDate: { gte: tenDaysAgo } },
      },
      select: { name: true, role: true, wageForDay: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Dedup by name, keeping the most recent role/wage as the suggested default.
    const seen = new Set<string>();
    const tempWorkers: { name: string; role: string; wageForDay: number }[] = [];
    for (const row of recentTempRows) {
      const key = row.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tempWorkers.push({ name: row.name, role: row.role, wageForDay: row.wageForDay });
    }

    sendSuccess(res, { existingWorkers, tempWorkers });
  } catch (error) {
    logger.error('Get worker options error:', error);
    sendError(res, 'Failed to fetch worker options', 500);
  }
};

export const createDailyReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      projectId, taskId, reportDate, weather, workDone,
      completionPct, notes, workers, materialsUsed,
      temperature, summary, issuesFound, safetyNotes, imageUrls,
    } = req.body;

    if (!projectId || !reportDate || !weather || completionPct === undefined) {
      sendError(res, 'projectId, reportDate, weather and completionPct are required', 400);
      return;
    }
    if (new Date(reportDate) > new Date()) {
      sendError(res, 'Report date cannot be in the future', 400);
      return;
    }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, 'You do not have access to this project', 403);
      return;
    }

    const progress = Number(completionPct);
    let task: any = null;

    if (taskId) {
      task = await prisma.task.findUnique({ where: { id: taskId }, include: { TaskType: true } });
      if (!task) { sendNotFound(res, 'Task not found'); return; }
      if (progress < task.cumulativePercent) {
        sendError(res, `Completion % (${progress}) cannot be lower than the task's current progress (${task.cumulativePercent}%)`, 400);
        return;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.create({
        data: {
          id: crypto.randomUUID(),
          projectId,
          taskId: taskId || null,
          userId: req.user!.id,
          reportDate: new Date(reportDate),
          weather: weather as string,
          temperature: temperature || null,
          summary: summary || workDone || '',
          workDone,
          issuesFound: issuesFound || notes || null,
          safetyNotes: safetyNotes || null,
          labourCount: (workers || []).length,
          progress,
          imageUrls: imageUrls || [],
          updatedAt: new Date(),
          DailyReportWorker: (workers || []).length > 0 ? {
            create: workers.map((w: any) => ({
              id: crypto.randomUUID(),
              name: w.name,
              workerId: w.workerId || null,
              role: w.role,
              wageForDay: Number(w.wageForDay),
            })),
          } : undefined,
          DailyReportMaterial: materialsUsed && materialsUsed.length > 0 ? {
            create: materialsUsed.map((m: any) => ({
              id: crypto.randomUUID(),
              materialId: m.materialId,
              quantityUsed: Number(m.quantityUsed),
            })),
          } : undefined,
        },
        include: {
          Project: { select: { id: true, name: true } },
          User: { select: { id: true, firstName: true, lastName: true } },
          Task: { select: { id: true, title: true } },
          DailyReportWorker: true,
          DailyReportMaterial: { include: { Material: true } },
        },
      });

      // Attendance is now the single source of truth driving Salary — each
      // present worker gets a row with the actual project they worked on
      // AND what they're owed for that day (wageForDay, as entered on this
      // report). Salary later sums these per worker to compute pending pay.
      for (const w of workers || []) {
        if (w.workerId) {
          await tx.attendance.create({
            data: {
              id: crypto.randomUUID(),
              date: new Date(reportDate),
              present: true,
              hoursWorked: 8,
              wageForDay: Number(w.wageForDay) || 0,
              workerId: w.workerId,
              projectId,
            },
          });
        }
      }

      // Single deduction path for every material actually used — whether
      // it was pre-filled from a standard suggestion and edited, or
      // entered manually. Records that don't exist yet in inventory get
      // created going negative rather than silently skipped.
      const warnings: string[] = [];
      for (const m of materialsUsed || []) {
        if (!m.materialId || !m.quantityUsed) continue;
        const deductResult = await deductMaterial({
          tx, projectId, materialId: m.materialId, quantity: Number(m.quantityUsed),
          reference: task ? `Task: ${task.title} (${reportDate})` : `Daily report (${reportDate})`,
        });
        if (deductResult && deductResult.shortfall > 0) {
          const material = await tx.material.findUnique({ where: { id: m.materialId } });
          warnings.push(`${material?.name || 'Material'}: inventory is now short by ${deductResult.shortfall.toFixed(1)} — restock this project.`);
        }
      }

      if (taskId && task) {
        const newStatus = progress >= 100 ? 'REVIEW' : 'IN_PROGRESS';
        await tx.task.update({
          where: { id: taskId },
          data: { cumulativePercent: progress, status: newStatus, updatedAt: new Date() },
        });
      }

      await tx.project.update({ where: { id: projectId }, data: { progress, updatedAt: new Date() } });

      return { report, warnings };
    });

    sendCreated(res, { ...normalize(result.report as unknown as Record<string, unknown>), warnings: result.warnings }, 'Daily report submitted successfully');
  } catch (error: any) {
    logger.error('Create report error:', error);
    sendError(res, error.message || 'Failed to create report', 500);
  }
};

export const updateDailyReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await prisma.dailyReport.findUnique({ where: { id: req.params.id } });
    if (!report) { sendNotFound(res, 'Report not found'); return; }

    const { weather, temperature, summary, workDone, issuesFound, safetyNotes, imageUrls, notes } = req.body;

    const updated = await prisma.dailyReport.update({
      where: { id: req.params.id },
      data: {
        ...(weather && { weather: weather as string }),
        ...(temperature !== undefined && { temperature }),
        ...(summary && { summary }),
        ...(workDone && { workDone }),
        ...(issuesFound !== undefined && { issuesFound }),
        ...(notes !== undefined && { issuesFound: notes }),
        ...(safetyNotes !== undefined && { safetyNotes }),
        ...(imageUrls !== undefined && { imageUrls }),
        updatedAt: new Date(),
      },
      include: {
        Project: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true } },
        Task: { select: { id: true, title: true } },
        DailyReportWorker: true,
        DailyReportMaterial: { include: { Material: true } },
      },
    });

    sendSuccess(res, normalize(updated as unknown as Record<string, unknown>), 'Report updated successfully');
  } catch (error) {
    logger.error('Update report error:', error);
    sendError(res, 'Failed to update report', 500);
  }
};

export const deleteDailyReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await prisma.dailyReport.findUnique({ where: { id: req.params.id } });
    if (!report) { sendNotFound(res, 'Report not found'); return; }
    await prisma.dailyReport.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Report deleted successfully');
  } catch (error) {
    logger.error('Delete report error:', error);
    sendError(res, 'Failed to delete report', 500);
  }
};