import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendPaginatedSuccess, getPagination } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getUserProjectIds } from '../middleware/projectScope';
import { createCostTransfer, getTransferredTotal, getTransferredTotalScoped } from '../utils/costTransfer';

export const getTruckEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, skip, take } = getPagination(req.query);
    const { projectId, vehicleNo, startDate, endDate } = req.query;

    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};

    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (vehicleNo) where.vehicleNo = { contains: vehicleNo as string, mode: 'insensitive' };
    if (startDate || endDate) {
      where.entryTime = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [entries, total] = await Promise.all([
      prisma.truckEntry.findMany({
        where,
        skip,
        take,
        include: {
          Project: { select: { id: true, name: true } },
          Vendor: { select: { id: true, name: true } },
        },
        orderBy: { entryTime: 'desc' },
      }),
      prisma.truckEntry.count({ where }),
    ]);

    sendPaginatedSuccess(res, entries, total, page, pageSize);
  } catch (error) {
    logger.error('Get truck entries error:', error);
    sendError(res, 'Failed to fetch truck entries', 500);
  }
};

export const createTruckEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      projectId, vehicleNo, driverName, material,
      netWeight, slipNo, slipUrl,
      entryTime, exitTime, vendorId, notes, ratePerTrip,
    } = req.body;

    // Only project, material, and net weight are truly required now —
    // vehicleNo and driverName default to 'N/A' when left blank, matching
    // how the import flow already treats missing driver names.
    if (!projectId || !material || !netWeight) {
      sendError(res, 'Missing required fields', 400);
      return;
    }

    const parsedEntryTime = entryTime ? new Date(entryTime) : new Date();
    if (parsedEntryTime > new Date()) {
      sendError(res, 'Entry time cannot be in the future', 400);
      return;
    }
    if (exitTime && new Date(exitTime) > new Date()) {
      sendError(res, 'Exit time cannot be in the future', 400);
      return;
    }

    const entry = await prisma.truckEntry.create({
      data: {
        id: randomUUID(),
        projectId,
        vehicleNo: vehicleNo ? String(vehicleNo).toUpperCase() : 'N/A',
        driverName: driverName || 'N/A',
        material,
        netWeight: Number(netWeight),
        slipNo: slipNo || null,
        slipUrl: slipUrl || null,
        entryTime: parsedEntryTime,
        exitTime: exitTime ? new Date(exitTime) : null,
        vendorId: vendorId || null,
        notes: notes || null,
        ratePerTrip: ratePerTrip !== undefined && ratePerTrip !== '' ? Number(ratePerTrip) : null,
      },
      include: {
        Project: { select: { name: true } },
        Vendor: { select: { name: true } },
      },
    });

    sendCreated(res, entry, 'Truck entry created successfully');
  } catch (error: any) {
    logger.error('Create truck entry error:', error);
    sendError(res, error.message || 'Failed to create truck entry', 500);
  }
};

export const updateTruckEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      vehicleNo, driverName, material, netWeight,
      slipNo, slipUrl, entryTime, exitTime, vendorId, notes, ratePerTrip,
    } = req.body;

    const existing = await prisma.truckEntry.findUnique({ where: { id } });
    if (!existing) {
      sendNotFound(res, 'Truck entry not found');
      return;
    }

    if (entryTime && new Date(entryTime) > new Date()) {
      sendError(res, 'Entry time cannot be in the future', 400);
      return;
    }
    if (exitTime && new Date(exitTime) > new Date()) {
      sendError(res, 'Exit time cannot be in the future', 400);
      return;
    }

    const updated = await prisma.truckEntry.update({
      where: { id },
      data: {
        ...(vehicleNo !== undefined && { vehicleNo: vehicleNo ? String(vehicleNo).toUpperCase() : 'N/A' }),
        ...(driverName !== undefined && { driverName: driverName || 'N/A' }),
        ...(material && { material }),
        ...(netWeight !== undefined && { netWeight: Number(netWeight) }),
        ...(slipNo !== undefined && { slipNo: slipNo || null }),
        ...(slipUrl !== undefined && { slipUrl: slipUrl || null }),
        ...(entryTime && { entryTime: new Date(entryTime) }),
        ...(exitTime !== undefined && { exitTime: exitTime ? new Date(exitTime) : null }),
        ...(vendorId !== undefined && { vendorId: vendorId || null }),
        ...(notes !== undefined && { notes }),
        ...(ratePerTrip !== undefined && { ratePerTrip: ratePerTrip !== '' ? Number(ratePerTrip) : null }),
      },
      include: {
        Project: { select: { name: true } },
        Vendor: { select: { name: true } },
      },
    });

    sendSuccess(res, updated, 'Truck entry updated successfully');
  } catch (error: any) {
    logger.error('Update truck entry error:', error);
    sendError(res, error.message || 'Failed to update truck entry', 500);
  }
};

export const deleteTruckEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.truckEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      sendNotFound(res, 'Truck entry not found');
      return;
    }

    await prisma.truckEntry.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Truck entry deleted successfully');
  } catch (error) {
    logger.error('Delete truck entry error:', error);
    sendError(res, 'Failed to delete truck entry', 500);
  }
};

export const getTruckEntrySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, startDate, endDate } = req.query;

    const allowedProjectIds = await getUserProjectIds(req);

    const where: Record<string, unknown> = {};

    if (allowedProjectIds) {
      where.projectId = projectId
        ? (allowedProjectIds.includes(projectId as string) ? projectId as string : '__none__')
        : { in: allowedProjectIds };
    } else if (projectId) {
      where.projectId = projectId as string;
    }
    if (startDate || endDate) {
      where.entryTime = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [summary, entriesForCost, byMaterial] = await Promise.all([
      prisma.truckEntry.aggregate({
        where,
        _sum: { netWeight: true },
        _count: { id: true },
      }),
      prisma.truckEntry.findMany({ where, select: { ratePerTrip: true } }),
      prisma.truckEntry.groupBy({
        by: ['material'],
        where,
        _sum: { netWeight: true },
        _count: { id: true },
      }),
    ]);

    const totalCost = entriesForCost.reduce((sum, e) => sum + Number(e.ratePerTrip || 0), 0);

    const transferred = projectId && typeof projectId === 'string'
      ? await getTransferredTotal(projectId, 'truck-entries')
      : await getTransferredTotalScoped(allowedProjectIds, 'truck-entries');

    const costInfo = { totalCost, transferred, pending: totalCost - transferred };

    sendSuccess(res, { summary, byMaterial, costInfo });
  } catch (error) {
    logger.error('Get truck entry summary error:', error);
    sendError(res, 'Failed to fetch summary', 500);
  }
};

// Bulk import — expects { entries: [...] } where each entry already has a
// resolved projectId/vendorId (the frontend matches Project/Vendor *names*
// from the spreadsheet against its already-loaded dropdown lists before
// sending, so this endpoint deals with real IDs, not free-text names).
// netWeight is expected in tonnes already, same convention as createTruckEntry.
//
// Only projectId, material, and netWeight are truly required — vehicleNo
// and driverName default to 'N/A' when blank, exactly like manual entry.
//
// Duplicate rule: a row is skipped ONLY if every one of these fields
// exactly matches an existing entry already in the DB —
// projectId + vehicleNo + material + netWeight + entryTime + vendorId + ratePerTrip.
// Any single differing field means it's treated as a genuinely new entry.
export const importTruckEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { entries } = req.body as { entries: any[] };

    if (!Array.isArray(entries) || entries.length === 0) {
      sendError(res, 'No entries provided to import', 400);
      return;
    }
    if (entries.length > 500) {
      sendError(res, 'Import is limited to 500 rows per file', 400);
      return;
    }

    const allowedProjectIds = await getUserProjectIds(req);
    const now = new Date();

    const valid: any[] = [];
    const skipped: { row: number; reason: string }[] = [];

    entries.forEach((row, idx) => {
      const rowNum = idx + 2; // +2 accounts for the header row in the spreadsheet
      const { projectId, vehicleNo, driverName, material, netWeight, vendorId, entryTime, exitTime, slipNo, ratePerTrip, notes } = row || {};

      // Only these three are genuinely required now.
      if (!projectId || !material || !netWeight) {
        skipped.push({ row: rowNum, reason: 'Missing a required field (project, material, or net weight)' });
        return;
      }
      if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
        skipped.push({ row: rowNum, reason: 'You do not have access to this project' });
        return;
      }

      const parsedEntryTime = entryTime ? new Date(entryTime) : now;
      if (isNaN(parsedEntryTime.getTime())) {
        skipped.push({ row: rowNum, reason: 'Invalid entry time' });
        return;
      }
      if (parsedEntryTime > now) {
        skipped.push({ row: rowNum, reason: 'Entry time cannot be in the future' });
        return;
      }

      let parsedExitTime: Date | null = null;
      if (exitTime) {
        parsedExitTime = new Date(exitTime);
        if (isNaN(parsedExitTime.getTime()) || parsedExitTime > now) {
          skipped.push({ row: rowNum, reason: 'Invalid or future exit time' });
          return;
        }
      }

      const weight = Number(netWeight);
      if (isNaN(weight) || weight <= 0) {
        skipped.push({ row: rowNum, reason: 'Net weight must be a positive number' });
        return;
      }

      valid.push({
        id: randomUUID(),
        projectId,
        vehicleNo: vehicleNo ? String(vehicleNo).toUpperCase() : 'N/A',
        driverName: driverName ? String(driverName) : 'N/A',
        material: String(material),
        netWeight: weight,
        slipNo: slipNo || null,
        slipUrl: null,
        entryTime: parsedEntryTime,
        exitTime: parsedExitTime,
        vendorId: vendorId || null,
        notes: notes || null,
        ratePerTrip: ratePerTrip !== undefined && ratePerTrip !== null && ratePerTrip !== '' ? Number(ratePerTrip) : null,
        __rowNum: rowNum, // stripped before insert, kept only for dedup reporting
      });
    });

    // Dedup pass — check each candidate row against what's already in the
    // DB for its project (scoped, since a duplicate on Project A shouldn't
    // block a legitimately identical-looking row on Project B). A row is a
    // duplicate ONLY if every one of these fields matches exactly.
    const toInsert: any[] = [];
    const projectIdsInBatch = Array.from(new Set(valid.map((v) => v.projectId)));
    const existingByProject: Record<string, any[]> = {};

    for (const pid of projectIdsInBatch) {
      existingByProject[pid] = await prisma.truckEntry.findMany({
        where: { projectId: pid },
        select: { vehicleNo: true, material: true, netWeight: true, entryTime: true, vendorId: true, ratePerTrip: true },
      });
    }

    for (const row of valid) {
      const { __rowNum, ...data } = row;
      const isDuplicate = (existingByProject[row.projectId] || []).some((ex) =>
        ex.vehicleNo === row.vehicleNo &&
        ex.material === row.material &&
        Number(ex.netWeight) === Number(row.netWeight) &&
        new Date(ex.entryTime).getTime() === new Date(row.entryTime).getTime() &&
        (ex.vendorId || null) === (row.vendorId || null) &&
        (ex.ratePerTrip ?? null) === (row.ratePerTrip ?? null)
      );

      if (isDuplicate) {
        skipped.push({ row: __rowNum, reason: 'Duplicate of an existing entry (every field matched exactly)' });
        continue;
      }
      toInsert.push(data);
    }

    let createdCount = 0;
    if (toInsert.length > 0) {
      const result = await prisma.truckEntry.createMany({ data: toInsert });
      createdCount = result.count;
    }

    sendCreated(
      res,
      { created: createdCount, skipped },
      `Imported ${createdCount} of ${entries.length} rows`
    );
  } catch (error: any) {
    logger.error('Import truck entries error:', error);
    sendError(res, error.message || 'Failed to import truck entries', 500);
  }
};

export const transferTruckEntriesToExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, amount, date } = req.body;
    if (!projectId || !amount || Number(amount) <= 0) {
      sendError(res, 'projectId and a positive amount are required', 400);
      return;
    }

    if (date && new Date(date) > new Date()) {
      sendError(res, 'Payment date cannot be in the future', 400);
      return;
    }

    const allowedProjectIds = await getUserProjectIds(req);
    if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      sendError(res, 'You do not have access to this project', 403);
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      sendNotFound(res, 'Project not found');
      return;
    }

    const entries = await prisma.truckEntry.findMany({ where: { projectId }, select: { ratePerTrip: true } });
    const totalCost = entries.reduce((sum, e) => sum + Number(e.ratePerTrip || 0), 0);
    const transferred = await getTransferredTotal(projectId, 'truck-entries');
    const pending = totalCost - transferred;

    if (Number(amount) > pending) {
      sendError(res, `Amount exceeds pending balance of ₹${pending.toFixed(2)}`, 400);
      return;
    }

    const result = await createCostTransfer({
      projectId,
      module: 'truck-entries',
      amount: Number(amount),
      userId: req.user!.id,
      projectName: project.name,
      date,
    });

    sendCreated(res, result, 'Payment recorded successfully');
  } catch (error) {
    logger.error('Transfer truck entries error:', error);
    sendError(res, 'Failed to transfer to expenses', 500);
  }
};