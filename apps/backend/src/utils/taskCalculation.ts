import { prisma } from '../config/database';
import { computeQuantityFromComponents, ComponentInput } from './unitConversion';

export async function calculateTaskEstimate(taskTypeId: string, components: ComponentInput[]) {
  const taskType = await prisma.taskType.findUnique({
    where: { id: taskTypeId },
    include: { MaterialCoefficient: { include: { Material: true } } },
  });
  if (!taskType) throw new Error('Task type not found');

  const computedQuantity = computeQuantityFromComponents(components);

  let totalPersonDays: number | null = null;
  let helperDays: number | null = null;
  if (taskType.hasStandard && taskType.outputPerDay) {
    totalPersonDays = computedQuantity / (taskType.outputPerDay * taskType.efficiencyFactor);
    if (taskType.helperRatio) {
      helperDays = totalPersonDays * taskType.helperRatio;
    }
  }

  const materials = taskType.MaterialCoefficient.map((mc) => ({
    materialId: mc.materialId,
    materialName: mc.Material.name,
    unit: mc.Material.unit,
    qtyNeeded: computedQuantity * mc.qtyPerUnit,
  }));

  return {
    taskType: { id: taskType.id, name: taskType.name, unit: taskType.unit, hasStandard: taskType.hasStandard },
    computedQuantity,
    totalPersonDays,
    helperDays,
    materials,
  };
}