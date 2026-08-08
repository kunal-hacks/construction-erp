// scripts/listMaterials.ts
// Run with: npx tsx scripts/listMaterials.ts
import { prisma } from '../src/config/database';

async function run() {
  const materials = await prisma.material.findMany({
    include: {
      _count: { select: { InventoryItem: true, MaterialCoefficient: true, DailyReportMaterial: true } },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`\nTotal materials: ${materials.length}\n`);
  console.log('ID'.padEnd(38), 'Name'.padEnd(30), 'Unit'.padEnd(8), 'Category'.padEnd(15), 'InvRows', 'UsedByTaskType');
  console.log('-'.repeat(120));

  for (const m of materials) {
    console.log(
      m.id.padEnd(38),
      m.name.padEnd(30),
      m.unit.padEnd(8),
      (m.category || '').padEnd(15),
      String(m._count.InventoryItem).padEnd(8),
      m._count.MaterialCoefficient > 0 ? `YES (${m._count.MaterialCoefficient})` : ''
    );
  }

  // Flag likely duplicates — same normalized name (lowercase, no spaces/parens)
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const groups: Record<string, typeof materials> = {};
  for (const m of materials) {
    const key = normalize(m.name).replace(/kg|bags|bag|50/g, ''); // strip common unit-ish noise for grouping
    (groups[key] = groups[key] || []).push(m);
  }

  console.log('\n\n⚠️  POSSIBLE DUPLICATE GROUPS (review manually — this is a guess, not a decision):\n');
  for (const [key, group] of Object.entries(groups)) {
    if (group.length > 1) {
      console.log(`Group "${key}":`);
      group.forEach(m => console.log(`   - ${m.name} (${m.unit}) — id: ${m.id} — ${m._count.InventoryItem} inventory rows, referenced by ${m._count.MaterialCoefficient} standard(s)`));
      console.log('');
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });