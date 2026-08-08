import { prisma } from '../config/database';

// NEW single deduction path — used by Daily Reports for every material
// actually used, whether pre-filled from a standard suggestion (then
// edited) or entered manually. Creates the inventory record if it doesn't
// exist yet (material used but never logged in Stock-In) and allows the
// resulting quantity to go negative — negative is the visible flag that
// something was used without ever being formally received, instead of the
// deduction being silently dropped.
export async function deductMaterial(params: {
  tx: any;
  projectId: string;
  materialId: string;
  quantity: number;
  reference: string;
}) {
  const { tx, projectId, materialId, quantity, reference } = params;
  if (quantity <= 0) return null;

  let inventoryItem = await tx.inventoryItem.findUnique({
    where: { projectId_materialId: { projectId, materialId } },
  });

  const priorQty = inventoryItem?.quantity ?? 0;
  const shortfall = Math.max(0, quantity - priorQty);

  if (inventoryItem) {
    inventoryItem = await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { quantity: priorQty - quantity, updatedAt: new Date() },
    });
  } else {
    inventoryItem = await tx.inventoryItem.create({
      data: {
        id: crypto.randomUUID(),
        projectId,
        materialId,
        quantity: -quantity,
        unitPrice: 0,
        minStock: 0,
        updatedAt: new Date(),
      },
    });
  }

  await tx.stockMovement.create({
    data: {
      id: crypto.randomUUID(),
      inventoryItemId: inventoryItem.id,
      movementType: 'OUT',
      quantity,
      reference,
    },
  });

  return { inventoryItem, shortfall };
}

// LEGACY — kept only because controllers/taskDailyLogs.controller.ts (the
// review-approval endpoint) still imports it. Not called by the current
// Daily Report flow anymore.
export async function deductMaterialsForIncrement(params: {
  tx: any;
  taskId: string;
  projectId: string;
  percentIncrement: number;
  createdBy: string;
}) {
  const { tx, taskId, projectId, percentIncrement } = params;
  const warnings: string[] = [];

  const task = await tx.task.findUnique({
    where: { id: taskId },
    include: { TaskType: { include: { MaterialCoefficient: { include: { Material: true } } } } },
  });
  if (!task?.TaskType?.hasStandard || !task.computedQuantity) return warnings;

  for (const mc of task.TaskType.MaterialCoefficient) {
    const qtyToDeduct = task.computedQuantity * mc.qtyPerUnit * percentIncrement;
    if (qtyToDeduct <= 0) continue;
    const result = await deductMaterial({
      tx, projectId, materialId: mc.materialId, quantity: qtyToDeduct,
      reference: `Task: ${task.title}`,
    });
    if (result && result.shortfall > 0) {
      warnings.push(`Low stock: ${mc.Material.name} — short by ${result.shortfall.toFixed(1)} ${mc.Material.unit}`);
    }
  }
  return warnings;
}

// Read-only — powers the material-check endpoint AND pre-fills the
// editable materials list on the Daily Report form. Never touches
// inventory.
export async function previewMaterialsForIncrement(params: {
  taskId: string;
  percentIncrement: number;
}) {
  const { taskId, percentIncrement } = params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { TaskType: { include: { MaterialCoefficient: { include: { Material: true } } } } },
  });
  if (!task?.TaskType?.hasStandard || !task.computedQuantity) return [];

  const results: { materialId: string; materialName: string; unit: string; qtyNeeded: number; available: number; shortfall: number }[] = [];

  for (const mc of task.TaskType.MaterialCoefficient) {
    const qtyNeeded = task.computedQuantity * mc.qtyPerUnit * percentIncrement;
    if (qtyNeeded <= 0) continue;

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { projectId_materialId: { projectId: task.projectId, materialId: mc.materialId } },
    });
    const available = inventoryItem?.quantity ?? 0;

    results.push({
      materialId: mc.materialId,
      materialName: mc.Material.name,
      unit: mc.Material.unit,
      qtyNeeded,
      available,
      shortfall: Math.max(0, qtyNeeded - available),
    });
  }
  return results;
}