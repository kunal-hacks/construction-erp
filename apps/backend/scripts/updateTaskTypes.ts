// Run with: npx tsx scripts/updateTaskTypes.ts
import { prisma } from '../src/config/database';

const updates = [
  // ── Brickwork ──────────────────────────────────────────────────────────
  {
    id: '42ef8712-a0c9-41fb-9140-11b9862737f5', // Blockwork / AAC Block Masonry
    outputPerDay: 8.0, helperRatio: 1.5,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
    sourceCitation: '⚠️ Industry estimate — AAC blocks are laid faster than brick due to larger unit size; no book source for this exact figure.',
  },
  {
    id: '2f13f287-ae2b-43d1-8135-cce98fd91ec5', // Brickwork — Foundation/Plinth
    outputPerDay: 1.39, helperRatio: 1.90,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
    sourceCitation: '✅ CPWD DAR 2023, Vol.1, Item 6.1.1',
  },
  // {
  //   id: '24ce7b5c-e29d-4118-987d-8d511efb502e', // Brickwork — Superstructure (Floor 1-5)
  //   outputPerDay: 1.06, helperRatio: 3.12,
  //   dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
  //   sourceCitation: '✅ CPWD DAR 2023, Vol.1, Item 6.3.1',
  // },
  {
    id: '4bb91982-c666-415f-8c16-575d6844a97f', // Brickwork (Full brick wall) — already in use by 1 task, leaving materials untouched
    outputPerDay: 1.06, helperRatio: 3.12,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
    sourceCitation: '✅ CPWD DAR 2023, Vol.1, Item 6.3.1 (same as Superstructure tier)',
  },
  // {
  //   id: '725084a5-3d73-424b-84e1-96fe9337c7c7', // Brickwork (Half brick / Partition wall)
  //   outputPerDay: 7.0, helperRatio: 1.0,
  //   dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
  //   sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 11 ("Half brick work in partition wall" = 7.00 Sqm/Mason)',
  // },

  // ── Concrete ──────────────────────────────────────────────────────────
  {
    id: '57cf744c-ed67-40bb-b77c-fb9304e8781c', // PCC
    outputPerDay: 4.0, helperRatio: 2.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 7 ("C.C." = 4.0 m³/Mason); helper ratio from the book\'s own note that a mason preparing concrete needs 2 mazdoors.',
  },

  // ── Earthwork ─────────────────────────────────────────────────────────
  {
    id: '503bb191-eb06-4637-8455-af52a6082acb', // Backfilling
    outputPerDay: 4.0, helperRatio: 0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Depth', defaultUnit: 'ft' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 4 ("Sand filling in plinth, consolidation and dressing" = 4.0 m³/Mazdoor). This is mazdoor-only work — no separate mason.',
  },
  {
    id: '8176fb9c-939a-4d92-91b7-bac7c3ba5d33', // Earthwork / Excavation
    outputPerDay: 2.75, helperRatio: 0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Depth', defaultUnit: 'ft' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 1 (ordinary soil, lead 50m, lift up to 1.5m). Excavation consumes no material — only mazdoor-days.',
  },

  // ── Electrical ────────────────────────────────────────────────────────
  {
    id: '29710379-1bd5-46c8-970f-4f9c996b9405', // Electrical
    hasStandard: true, // upgraded from manual-only, per your new reference document
    outputPerDay: 8.0, helperRatio: 0,
    dimensionFields: [{ label: 'Number of Points', defaultUnit: 'nos' }],
    sourceCitation: '⚠️ Industry estimate (~8 points/electrician/day, incl. conduit chasing) — none of the sourced books cover electrical estimation. No material coefficients set — add wire/conduit/switch as Materials first, then configure coefficients on this page.',
  },

  // ── Formwork ──────────────────────────────────────────────────────────
  {
    id: 'c111c74d-5f5f-43a9-8447-0fc463f453c5', // Formwork / Shuttering
    outputPerDay: 9.0, helperRatio: 1.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
    sourceCitation: '⚠️ Industry estimate (~9 sqm contact area/carpenter/day) — no book source. Uses Plywood (18mm) already in your Materials list; reuse-factor coefficient should be set on this page.',
  },

  // ── Plastering ────────────────────────────────────────────────────────
  {
    id: 'a2882281-8d05-4c66-9349-c19a6513957e', // Basic Cement Plaster (External)
    outputPerDay: 11.9, helperRatio: 1.12,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
    sourceCitation: '📘 Derived from CPWD DAR 2021 Vol.2 Item 13.1.1 (14.93 sqm/mason/day @ 12mm), scaled down for typical 15mm external coat thickness (14.93 × 12/15 ≈ 11.9).',
  },
  {
    id: 'fc7f5b14-e594-4110-93a8-80266e5da40b', // Basic Cement Plaster (Internal)
    outputPerDay: 14.93, helperRatio: 1.12,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
    sourceCitation: '✅ CPWD DAR 2021, Vol.2, Item 13.1.1 (12mm, 1:4)',
  },
  {
    id: 'e4d03646-f028-41f1-98b7-65ea9b4d162a', // Plastering — 12mm (1:4) — generic/original entry
    outputPerDay: 14.93, helperRatio: 1.12,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Height', defaultUnit: 'ft' }],
    sourceCitation: '✅ CPWD DAR 2021, Vol.2, Item 13.1.1. Duplicate of "Basic Cement Plaster (Internal)" — kept per your instruction not to delete; no materials configured yet, add via this page.',
  },

  // ── RCC (all use ESC-Notes' general RCC rate — books don't break this
  //    down per structural element, so the same base rate applies to all,
  //    with staircase adjusted down for its extra formwork complexity) ──
  {
    id: '4113f2f4-6b4f-4c67-a8b6-5c469a877165', // Coping / Parapet
    outputPerDay: 3.25, helperRatio: 2.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 8 ("R.C.C. (1:2:4)" = 3.25 m³/Mason) — general RCC rate, not element-specific in the source.',
  },
  {
    id: '9ea342b2-aab6-4064-bdef-7c75daf2243e', // RCC Beams
    outputPerDay: 3.25, helperRatio: 2.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'inch' }, { label: 'Depth', defaultUnit: 'inch' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 8 — general RCC rate.',
  },
  {
    id: '0d898d12-cc94-4655-9b33-627a35503292', // RCC Columns
    outputPerDay: 3.25, helperRatio: 2.0,
    dimensionFields: [{ label: 'Width', defaultUnit: 'inch' }, { label: 'Depth', defaultUnit: 'inch' }, { label: 'Height', defaultUnit: 'ft' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 8 — general RCC rate.',
  },
  {
    id: 'cb2c306b-56b2-4234-848b-487239dee6c3', // RCC Footings
    outputPerDay: 3.25, helperRatio: 2.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Depth', defaultUnit: 'inch' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 8 — general RCC rate.',
  },
  {
    id: 'db9c7e3f-9eb1-4c33-a0c7-b480a22cfe22', // RCC Lintels
    outputPerDay: 3.25, helperRatio: 2.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'inch' }, { label: 'Depth', defaultUnit: 'inch' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 8 — general RCC rate.',
  },
  {
    id: '5374d903-21df-4b9b-b00c-4cbd7705531b', // RCC Slabs
    outputPerDay: 3.25, helperRatio: 2.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 8 — general RCC rate.',
  },
  {
    id: 'd6b039ea-a034-41ad-80d1-9e220ff280d7', // RCC Staircase
    outputPerDay: 2.5, helperRatio: 2.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
    sourceCitation: '📘 Derived from ESC-Notes Item 8 (3.25 m³/mason), reduced ~23% for staircase\'s extra formwork/step complexity — ⚠️ the reduction factor itself is an estimate, not book-sourced.',
  },
  {
    id: '4221d0c1-ed3b-4c0a-9f62-017a93a5bf23', // Roof / Slab related structural items
    outputPerDay: 3.25, helperRatio: 2.0,
    dimensionFields: [{ label: 'Length', defaultUnit: 'ft' }, { label: 'Width', defaultUnit: 'ft' }, { label: 'Thickness', defaultUnit: 'inch' }],
    sourceCitation: '✅ ESC-Notes book, Task/Out-turn Table, Item 8 — general RCC rate. Duplicate of RCC Slabs; kept per your instruction.',
  },

  // ── Steel ─────────────────────────────────────────────────────────────
  {
    id: '13ff7baf-3dff-4e39-8c9c-01b96721a784', // Reinforcement Steel
    outputPerDay: 60, helperRatio: 0.5,
    dimensionFields: [{ label: 'Weight of Steel', defaultUnit: 'kg' }],
    sourceCitation: '⚠️ Industry estimate (~60 kg/fitter/day for cutting, bending, tying) — no book source for bar-bending productivity.',
  },
];

async function run() {
  for (const u of updates) {
    const { id, ...data } = u;
    const tt = await prisma.taskType.update({ where: { id }, data });
    console.log(`Updated: ${tt.name}`);
  }
  console.log('\nDone. See the summary in chat for which task types still need Material Coefficients added manually via the Admin Task Types page.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });