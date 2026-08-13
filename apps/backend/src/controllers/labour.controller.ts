import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { getUserProjectIds } from '../middleware/projectScope';

export const getLabour = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { search, projectId } = req.query;
    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = { isActive: true };
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    // A worker "belongs to" a project if it's their home project OR they've
    // been additionally assigned to it via WorkerProject (the rare
    // two-project case).
    if (projectId) {
      where.OR = [
        { projectId: projectId as string },
        { WorkerProject: { some: { projectId: projectId as string } } },
      ];
    } else if (allowedProjectIds) {
      where.OR = [
        { projectId: { in: allowedProjectIds } },
        { WorkerProject: { some: { projectId: { in: allowedProjectIds } } } },
      ];
    }

    const [workers, total] = await Promise.all([
      prisma.worker.findMany({
        where, skip, take,
        include: {
          contractor: { select: { id: true, name: true } },
          Project: { select: { id: true, name: true, projectCode: true } },
          WorkerProject: { include: { Project: { select: { id: true, name: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.worker.count({ where }),
    ]);

    const normalized = workers.map((w) => ({
      ...w,
      contractor: w.contractor,
      project: w.Project,
      additionalProjects: (w.WorkerProject as { Project: { id: string; name: string } }[]).map((wp) => wp.Project),
    }));

    sendPaginatedSuccess(res, normalized, total, page, pageSize);
  } catch (error) {
    sendError(res, 'Failed to fetch workers', 500);
  }
};

export const createLabour = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, aadharNumber, skill, dailyWage, address, contractorId, projectId } = req.body;
    const allowedProjectIds = await getUserProjectIds(req);

    if (!projectId) {
      sendError(res, 'A project must be selected — workers belong to a specific project', 400);
      return;
    }
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, "You can't add a worker to a project you're not assigned to", 403);
      return;
    }

    const worker = await prisma.worker.create({
      data: {
        id: randomUUID(),
        name,
        phone: phone || null,
        aadharNo: aadharNumber || null,
        skill: skill || 'Helper',
        dailyWage: Number(dailyWage),
        address: address || null,
        contractorId: contractorId || null,
        projectId,
        isActive: true,
        joinDate: new Date(),
      },
      include: {
        contractor: { select: { id: true, name: true } },
        Project: { select: { id: true, name: true } },
      },
    });

    sendCreated(res, { ...worker, project: worker.Project }, 'Worker added successfully');
  } catch (error) {
    sendError(res, 'Failed to create worker', 500);
  }
};

// Assigns a worker to an ADDITIONAL project — for the rare case of two
// projects needing the same worker (e.g. same city). Home projectId is
// unaffected; this is purely additive.
export const assignWorkerToProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;
    const allowedProjectIds = await getUserProjectIds(req);

    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, "You can't assign a worker to a project you're not assigned to", 403);
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id } });
    if (!worker) { sendError(res, 'Worker not found', 404); return; }
    if (worker.projectId === projectId) {
      sendError(res, 'This is already the worker\'s home project', 400);
      return;
    }

    const existing = await prisma.workerProject.findUnique({ where: { workerId_projectId: { workerId: id, projectId } } });
    if (existing) { sendError(res, 'Worker is already assigned to this project', 409); return; }

    const link = await prisma.workerProject.create({
      data: { id: randomUUID(), workerId: id, projectId },
      include: { Project: { select: { id: true, name: true } } },
    });

    sendCreated(res, link, 'Worker assigned to project');
  } catch (error) {
    sendError(res, 'Failed to assign worker to project', 500);
  }
};

export const unassignWorkerFromProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, projectId } = req.params;
    await prisma.workerProject.delete({ where: { workerId_projectId: { workerId: id, projectId } } });
    sendSuccess(res, null, 'Worker removed from project');
  } catch (error) {
    sendError(res, 'Failed to remove worker from project', 500);
  }
};

// Now records projectId + wageForDay on every attendance row, so Salary can
// aggregate real pay owed per worker per project.
export const recordAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { labourId, date, status, projectId, hoursWorked, notes } = req.body;
    const allowedProjectIds = await getUserProjectIds(req);

    const worker = await prisma.worker.findUnique({ where: { id: labourId }, include: { WorkerProject: true } });
    if (!worker) { sendError(res, 'Worker not found', 404); return; }

    const workerProjectIds = [worker.projectId, ...worker.WorkerProject.map((wp) => wp.projectId)].filter(Boolean) as string[];
    const effectiveProjectId = projectId || worker.projectId;

    if (!effectiveProjectId || !workerProjectIds.includes(effectiveProjectId)) {
      sendError(res, 'This worker is not assigned to that project', 400);
      return;
    }
    if (allowedProjectIds && !allowedProjectIds.includes(effectiveProjectId)) {
      sendError(res, "You can't record attendance outside your assigned projects", 403);
      return;
    }

    const present = status === 'PRESENT' || status === 'HALF_DAY';
    const hours = status === 'HALF_DAY' ? 4 : (hoursWorked ? Number(hoursWorked) : 8);
    const wageForDay = present ? (status === 'HALF_DAY' ? worker.dailyWage / 2 : worker.dailyWage) : 0;

    const attendance = await prisma.attendance.create({
      data: {
        id: randomUUID(),
        workerId: labourId,
        projectId: effectiveProjectId,
        date: new Date(date),
        present,
        hoursWorked: hours,
        wageForDay,
        overtime: 0,
        notes: notes || (status === 'ABSENT' ? 'Absent' : status === 'ON_LEAVE' ? 'On Leave' : null),
      },
    });

    sendSuccess(res, attendance, 'Attendance recorded');
  } catch (error) {
    sendError(res, 'Failed to record attendance', 500);
  }
};

export const getContractors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedProjectIds = await getUserProjectIds(req);

    if (!allowedProjectIds) {
      const contractors = await prisma.contractor.findMany({
        where: { isActive: true },
        include: { _count: { select: { Attendance: true, Worker: true } } },
        orderBy: { name: 'asc' },
      });
      sendSuccess(res, contractors.map((c) => ({ ...c, _count: { labours: c._count.Worker } })));
      return;
    }

    const relevantWorkers = await prisma.worker.findMany({
      where: { projectId: { in: allowedProjectIds }, contractorId: { not: null } },
      select: { contractorId: true },
      distinct: ['contractorId'],
    });
    const contractorIds = relevantWorkers.map((w) => w.contractorId).filter(Boolean) as string[];

    const contractors = await prisma.contractor.findMany({
      where: { id: { in: contractorIds.length ? contractorIds : ['__none__'] }, isActive: true },
      orderBy: { name: 'asc' },
    });

    const normalized = await Promise.all(
      contractors.map(async (c) => {
        const workerCount = await prisma.worker.count({ where: { contractorId: c.id, projectId: { in: allowedProjectIds } } });
        return { ...c, _count: { labours: workerCount } };
      })
    );

    sendSuccess(res, normalized);
  } catch (error) {
    sendError(res, 'Failed to fetch contractors', 500);
  }
};

export const createContractor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, gstNumber, address, email, specialty } = req.body;
    const contractor = await prisma.contractor.create({
      data: {
        id: randomUUID(), name, phone, email: email || null,
        gstNumber: gstNumber || null, specialty: specialty || null, company: null, isActive: true,
      },
    });
    sendCreated(res, contractor, 'Contractor added successfully');
  } catch (error) {
    sendError(res, 'Failed to create contractor', 500);
  }
};

