// Run with: npx tsx scripts/seedStructuralTaskTypes.ts
import { prisma } from '../src/config/database';

async function findMaterial(name: string) {
  return prisma.material.findFirst({ where: { name: { contains: name, mode: 'insensitive' } } });
}

async function seed() {
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) { console.error('No SUPER_ADMIN found.'); process.exit(1); }

  const cement = await findMaterial('cement');
  const sand = await findMaterial('sand');
  const aggregate = await findMaterial('aggregate');
  const brickFull = await findMaterial('brick');
  const steel = await findMaterial('steel') || await findMaterial('tmt');
  const morram = await findMaterial('morram');
  const quarryWaste = await findMaterial('quarry');

  if (!cement || !sand || !aggregate) {
    console.warn('WARNING: Cement/Sand/Aggregate not found in Material table — RCC/PCC/Brickwork/Plaster material coefficients will be skipped for missing ones. Add these materials first, then re-run.');
  }

  // ── RCC concrete recipe, shared across all "M20" structural elements ──
  // Dry volume factor 1.54, mix 1:1.5:3 (total 5.5 parts), wastage: cement 2.5%, aggregate/sand 5%
  const rccMaterials = [
    cement && { materialId: cement.id, qtyPerUnit: 8.26 },      // bags/cum, wastage-adjusted
    sand && { materialId: sand.id, qtyPerUnit: 0.441 },          // cum/cum
    aggregate && { materialId: aggregate.id, qtyPerUnit: 0.882 }, // cum/cum
  ].filter(Boolean) as { materialId: string; qtyPerUnit: number }[];

  const taskTypes = [
    {
      name: 'Earthwork / Excavation', trade: 'Earthwork', unit: 'cum', hasStandard: true,
      outputPerDay: 3.5, helperRatio: 3.5,
      sourceCitation: 'Structural QS standard — industry convention (1 mason + 3-4 mazdoor -> 3-4 cum/day)',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Depth', defaultUnit: 'ft' }],
      materials: [],
    },
    {
      name: 'Backfilling', trade: 'Earthwork', unit: 'cum', hasStandard: true,
      outputPerDay: 4, helperRatio: 3,
      sourceCitation: 'Loose volume factor 1.25 applied to compacted volume — labour rate estimated by analogy to Earthwork (not separately given in source)',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Depth', defaultUnit: 'ft' }],
      // Admin should pick ONE fill material when configuring — create a
      // second "Backfilling — Quarry Waste" type if the site uses both,
      // same pattern as Brickwork's two floor tiers.
      materials: morram ? [{ materialId: morram.id, qtyPerUnit: 1.25 }] : [],
    },
    {
      name: 'PCC (Plain Cement Concrete)', trade: 'Concrete', unit: 'cum', hasStandard: true,
      outputPerDay: 1.75, helperRatio: 4.5,
      sourceCitation: 'Mix 1:4:8, dry volume x1.54, wastage: cement 2.5%, aggregate 5%',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
      materials: [
        cement && { materialId: cement.id, qtyPerUnit: 3.49 },
        sand && { materialId: sand.id, qtyPerUnit: 0.4975 },
        aggregate && { materialId: aggregate.id, qtyPerUnit: 0.995 },
      ].filter(Boolean),
    },
    { name: 'RCC Footings', trade: 'RCC', unit: 'cum', hasStandard: true, outputPerDay: 1.75, helperRatio: 4.5,
      sourceCitation: 'M20 (1:1.5:3), dry vol x1.54 — verify grade with structural drawing before relying on this',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Depth', defaultUnit: 'ft' }],
      materials: rccMaterials },
    { name: 'RCC Columns', trade: 'RCC', unit: 'cum', hasStandard: true, outputPerDay: 1.75, helperRatio: 4.5,
      sourceCitation: 'M20 (1:1.5:3), dry vol x1.54 — verify grade with structural drawing before relying on this',
      dimensionFields: [{ label: 'Width', defaultUnit: 'inch' }, { label: 'Depth', defaultUnit: 'inch' }, { label: 'Height', defaultUnit: 'ft' }],
      materials: rccMaterials },
    { name: 'RCC Beams', trade: 'RCC', unit: 'cum', hasStandard: true, outputPerDay: 1.75, helperRatio: 4.5,
      sourceCitation: 'M20 (1:1.5:3), dry vol x1.54 — verify grade with structural drawing before relying on this',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'inch' }, { label: 'Depth', defaultUnit: 'inch' }],
      materials: rccMaterials },
    { name: 'RCC Slabs', trade: 'RCC', unit: 'cum', hasStandard: true, outputPerDay: 1.75, helperRatio: 4.5,
      sourceCitation: 'M20 (1:1.5:3), dry vol x1.54 — verify grade with structural drawing before relying on this',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
      materials: rccMaterials },
    { name: 'RCC Lintels', trade: 'RCC', unit: 'cum', hasStandard: true, outputPerDay: 1.75, helperRatio: 4.5,
      sourceCitation: 'M20 (1:1.5:3), dry vol x1.54 — verify grade with structural drawing before relying on this',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'inch' }, { label: 'Depth', defaultUnit: 'inch' }],
      materials: rccMaterials },
    { name: 'RCC Staircase', trade: 'RCC', unit: 'cum', hasStandard: true, outputPerDay: 1.75, helperRatio: 4.5,
      sourceCitation: 'M20 (1:1.5:3), dry vol x1.54 — verify grade with structural drawing before relying on this',
      dimensionFields: [{ label: 'Waist Slab Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
      materials: rccMaterials },
    {
      name: 'Formwork / Shuttering', trade: 'Formwork', unit: 'sqm', hasStandard: true,
      outputPerDay: 9, helperRatio: 1,
      sourceCitation: '1 carpenter + 1 helper -> 8-10 sqm/day. Material (ply/timber) not quantified by source — add manually via Admin page if needed.',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
      materials: [],
    },
    {
      name: 'Reinforcement Steel', trade: 'Steel', unit: 'kg', hasStandard: true,
      outputPerDay: 110, helperRatio: 1,
      sourceCitation: '1 bar bender + 1 helper -> 100-120 kg/day. Enter total designed steel weight (from BBS) directly.',
      dimensionFields: [{ label: 'Steel Weight', defaultUnit: 'kg' }],
      materials: steel ? [{ materialId: steel.id, qtyPerUnit: 1.04 }] : [], // 4% wastage for laps/chairs
    },
    {
      name: 'Brickwork (Full brick wall)', trade: 'Brickwork', unit: 'cum', hasStandard: true,
      outputPerDay: 1.125, helperRatio: 1.5,
      sourceCitation: '230mm wall, 500 bricks/cum, mortar 0.275 wet/cum (x1.33 dry), 1:6 mix assumed, brick wastage 6%',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
      materials: [
        brickFull && { materialId: brickFull.id, qtyPerUnit: 530 },
        cement && { materialId: cement.id, qtyPerUnit: 1.545 },
        sand && { materialId: sand.id, qtyPerUnit: 0.329 },
      ].filter(Boolean),
    },
    
    {
      name: 'Blockwork / AAC Block Masonry', trade: 'Brickwork', unit: 'sqm', hasStandard: false,
      sourceCitation: 'No formula given in source for this category — manual entry only until a real reference is available.',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
      materials: [],
    },
    {
      name: 'Basic Cement Plaster (Internal)', trade: 'Plastering', unit: 'sqm', hasStandard: true,
      outputPerDay: 9, helperRatio: 1,
      sourceCitation: '12mm thick, 1:6 mix, dry vol x1.33, wastage 11%',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
      materials: [
        cement && { materialId: cement.id, qtyPerUnit: 0.073 },
        sand && { materialId: sand.id, qtyPerUnit: 0.01519 },
      ].filter(Boolean),
    },
    {
      name: 'Basic Cement Plaster (External)', trade: 'Plastering', unit: 'sqm', hasStandard: true,
      outputPerDay: 9, helperRatio: 1,
      sourceCitation: '15mm thick, 1:6 mix, dry vol x1.33, wastage 11%. Labour rate reused from Internal — source does not distinguish.',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
      materials: [
        cement && { materialId: cement.id, qtyPerUnit: 0.0912 },
        sand && { materialId: sand.id, qtyPerUnit: 0.01898 },
      ].filter(Boolean),
    },
    {
      name: 'Coping / Parapet', trade: 'RCC', unit: 'cum', hasStandard: true,
      outputPerDay: 1.75, helperRatio: 4.5,
      sourceCitation: 'No dedicated formula given — reused RCC/Concrete mix + labour rate as a reasonable stand-in for this small element.',
      dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'inch' }, { label: 'Height', defaultUnit: 'inch' }],
      materials: rccMaterials,
    },
    {
      name: 'Roof / Slab related structural items', trade: 'RCC', unit: 'cum', hasStandard: false,
      sourceCitation: 'Category is ambiguous in source (overlaps with RCC Slabs) with no distinct formula given — manual entry only.',
      dimensionFields: [{ label: 'Quantity', defaultUnit: 'nos' }],
      materials: [],
    },
  ];

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
        outputPerDay: (tt as any).outputPerDay ?? null,
        helperRatio: (tt as any).helperRatio ?? null,
        sourceCitation: tt.sourceCitation,
        dimensionFields: tt.dimensionFields,
        MaterialCoefficient: { create: (tt.materials as any[]).map((m) => ({ id: crypto.randomUUID(), ...m })) },
      },
    });
    console.log(`Created "${tt.name}"${tt.hasStandard ? '' : ' (manual only)'}`);
  }

  console.log('\nDone. Review sourceCitation on each type in the Task Types admin page — several are flagged as derived/assumed rather than directly given in the source document.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });