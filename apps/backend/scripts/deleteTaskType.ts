// scripts/deleteTaskType.ts
// Run with: npx tsx scripts/deleteTaskType.ts <taskTypeId>
import { prisma } from '../src/config/database';

const id = process.argv[2];
if (!id) { console.error('Usage: npx tsx scripts/deleteTaskType.ts <taskTypeId>'); process.exit(1); }

prisma.$transaction(async (tx) => {
  await tx.materialCoefficient.deleteMany({ where: { taskTypeId: id } });
  const tt = await tx.taskType.delete({ where: { id } });
  console.log(`Deleted: ${tt.name}`);
})
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });