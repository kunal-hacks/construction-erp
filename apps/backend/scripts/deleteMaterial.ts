// scripts/deleteMaterial.ts
// Run with: npx tsx scripts/deleteMaterial.ts <materialId>
import { prisma } from '../src/config/database';

const id = process.argv[2];
if (!id) { console.error('Usage: npx tsx scripts/deleteMaterial.ts <materialId>'); process.exit(1); }

prisma.material.delete({ where: { id } })
  .then((m) => { console.log(`Deleted: ${m.name}`); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });