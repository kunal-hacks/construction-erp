import { prisma } from '../config/database';
import crypto from 'crypto';

type TransferModule = 'truck-entries' | 'machinery' | 'salary';

export async function createCostTransfer(params: {
  projectId: string;
  module: TransferModule;
  amount: number;
  userId: string;
  projectName: string;
  date?: string;
  workerId?: string;
  workerName?: string;   
  expenseTitle?: string;
  expenseCategory?: string;
}) {
  const { projectId, module, amount, userId, projectName, date, workerId, workerName, expenseTitle, expenseCategory } = params;
  const moduleLabel = module === 'truck-entries' ? 'Truck Entries' : module === 'machinery' ? 'Machinery' : 'Salary';
  const expenseDate = date ? new Date(date) : new Date();

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        id: crypto.randomUUID(),
        projectId,
        userId,
        title: expenseTitle || `${moduleLabel} Payment — ${projectName}`,
        description: `Transferred from ${moduleLabel} running total`,
        expenseDate,
        amount,
        category: expenseCategory || moduleLabel,
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const transfer = await tx.costTransfer.create({
      data: {
        id: crypto.randomUUID(),
        projectId,
        module,
        workerId: workerId || null,
        workerName: workerName || null,
        amount,
        expenseId: expense.id,
        createdBy: userId,
      },
    });

    return { expense, transfer };
  });
}

export async function getTransferredTotal(projectId: string, module: 'truck-entries' | 'machinery') {
  const result = await prisma.costTransfer.aggregate({ where: { projectId, module }, _sum: { amount: true } });
  return result._sum.amount || 0;
}

export async function getTransferredTotalScoped(allowedProjectIds: string[] | undefined, module: 'truck-entries' | 'machinery') {
  const where: Record<string, unknown> = { module };
  if (allowedProjectIds) where.projectId = { in: allowedProjectIds };
  const result = await prisma.costTransfer.aggregate({ where, _sum: { amount: true } });
  return result._sum.amount || 0;
}

// Sum already paid to a specific worker — global (all projects) if no
// projectId given, or scoped to just one project if it is.
export async function getWorkerPaidTotal(workerId: string, projectId?: string) {
  const where: Record<string, unknown> = { module: 'salary', workerId };
  if (projectId) where.projectId = projectId;
  const result = await prisma.costTransfer.aggregate({ where, _sum: { amount: true } });
  return result._sum.amount || 0;
}

// Same as getWorkerPaidTotal but for name-based (temp) workers.
export async function getTempWorkerPaidTotal(workerName: string, projectId: string) {
  const result = await prisma.costTransfer.aggregate({
    where: { module: 'salary', workerName, projectId },
    _sum: { amount: true },
  });
  return result._sum.amount || 0;
}