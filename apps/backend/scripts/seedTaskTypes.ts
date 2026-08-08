// Run with: npx tsx scripts/seedTaskTypes.ts
import { prisma } from '../src/config/database';

async function seed() {
  const brick = await prisma.material.findFirst({ where: { name: { contains: 'brick', mode: 'insensitive' } } });

  const taskTypes = [
    {
      name: 'Brickwork — Foundation/Plinth',
      trade: 'Brickwork',
      unit: 'cum',
      hasStandard: true,
      outputPerDay: 1.39,          // CPWD DAR 2023, Vol.1, Item 6.1.1 — 0.72 combined mason-days/cum
      helperRatio: 1.90,           // coolie-days per mason-day
      sourceCitation: 'CPWD DAR 2023, Vol.1, Item 6.1.1',
      materials: brick ? [{ materialId: brick.id, qtyPerUnit: 500 }] : [], // VSSUT lecture notes
    },
    // {
    //   name: 'Brickwork — Superstructure (Floor 1–5)',
    //   trade: 'Brickwork',
    //   unit: 'cum',
    //   hasStandard: true,
    //   outputPerDay: 1.06,          // CPWD DAR 2023, Vol.1, Item 6.3.1 — includes material-lifting time
    //   helperRatio: 3.12,
    //   sourceCitation: 'CPWD DAR 2023, Vol.1, Item 6.3.1',
    //   materials: brick ? [{ materialId: brick.id, qtyPerUnit: 500 }] : [],
    // },
    {
      name: 'Plastering — 12mm (1:4)',
      trade: 'Plastering',
      unit: 'sqm',
      hasStandard: true,
      outputPerDay: 14.93,         // CPWD DAR 2021, Vol.2, Item 13.1.1
      helperRatio: 1.12,
      sourceCitation: 'CPWD DAR 2021, Vol.2, Item 13.1.1',
      materials: [], // cement/sand coefficients: add via Admin page once finalized
    },
    {
      name: 'Electrical',
      trade: 'Electrical',
      unit: 'point',
      hasStandard: false,          // manual-only — no source book covers this
      materials: [],
    },
  ];

  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) { console.error('No SUPER_ADMIN found — create one first.'); process.exit(1); }

  for (const tt of taskTypes) {
    const existing = await prisma.taskType.findFirst({ where: { name: tt.name } });
    if (existing) { console.log(`Skipping "${tt.name}" — already exists`); continue; }

    await prisma.taskType.create({
      data: {
        id: crypto.randomUUID(),
        name: tt.name,
        trade: tt.trade,
        unit: tt.unit,
        hasStandard: tt.hasStandard,
        outputPerDay: tt.outputPerDay ?? null,
        helperRatio: tt.helperRatio ?? null,
        sourceCitation: tt.sourceCitation ?? null,
        MaterialCoefficient: { create: tt.materials.map((m) => ({ id: crypto.randomUUID(), ...m })) },
      },
    });
    console.log(`Created "${tt.name}"`);
  }

  console.log('Done. NOTE: cement/sand coefficients for both Brickwork tiers and Plastering are intentionally left for you to add via the Admin Task Types page — only the confidently-sourced numbers (labour output, bricks/cum) were seeded automatically.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });