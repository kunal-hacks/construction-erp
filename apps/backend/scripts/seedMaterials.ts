// Run with: npx tsx scripts/seedMaterials.ts
// This is the closed, fixed material catalog. There is no "add material"
// feature anywhere in the app on purpose — every material here already has
// (or will have) a Task Type coefficient wired to it. Adding a new material
// is a deliberate developer change: add it here, then wire it into whatever
// Task Type actually needs it.
import { prisma } from '../src/config/database';

const MATERIALS = [
  { name: 'Cement', category: 'Cement', unit: 'Bags', description: 'OPC 53 Grade, 50kg bags' },
  { name: 'Sand', category: 'Aggregates', unit: 'CuM', description: 'River sand / M-sand for concrete & mortar' },
  { name: 'Aggregate', category: 'Aggregates', unit: 'CuM', description: '20mm coarse aggregate' },
  { name: 'Brick', category: 'Masonry', unit: 'Nos', description: 'Standard 230x115x75mm clay brick' },
  { name: 'Steel', category: 'Reinforcement', unit: 'KG', description: 'TMT reinforcement bars, all diameters' },
  { name: 'Morram', category: 'Fill Material', unit: 'CuM', description: 'Murram / earth fill for backfilling' },
  { name: 'Quarry Waste', category: 'Fill Material', unit: 'CuM', description: 'Quarry dust / waste for backfilling' },
];

async function seed() {
  for (const m of MATERIALS) {
    const existing = await prisma.material.findFirst({
      where: { name: { equals: m.name, mode: 'insensitive' } },
    });
    if (existing) {
      console.log(`Skipping "${m.name}" — already exists`);
      continue;
    }
    await prisma.material.create({
      data: { id: crypto.randomUUID(), ...m },
    });
    console.log(`Created "${m.name}" (${m.unit})`);
  }

  console.log('\nDone. This is the complete, closed material list — nothing else should be added through the app.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });