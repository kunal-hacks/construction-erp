// scripts/listTaskTypes.ts
// Run with: npx tsx scripts/listTaskTypes.ts
import { prisma } from '../src/config/database';

async function run() {
  const taskTypes = await prisma.taskType.findMany({
    include: { _count: { select: { Task: true, MaterialCoefficient: true } } },
    orderBy: [{ trade: 'asc' }, { name: 'asc' }],
  });

  console.log(`\nTotal task types: ${taskTypes.length}\n`);
  console.log('ID'.padEnd(38), 'Name'.padEnd(40), 'Trade'.padEnd(15), 'UsedByTasks', 'Materials');
  console.log('-'.repeat(115));

  for (const tt of taskTypes) {
    console.log(
      tt.id.padEnd(38),
      tt.name.padEnd(40),
      tt.trade.padEnd(15),
      String(tt._count.Task).padEnd(11),
      String(tt._count.MaterialCoefficient)
    );
  }

  console.log('\n⚠️  UNUSED (0 tasks reference them — safe candidates to delete):\n');
  for (const tt of taskTypes) {
    if (tt._count.Task === 0) console.log(`   - ${tt.name} — id: ${tt.id}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });