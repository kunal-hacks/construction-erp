// scripts/mergeMaterials.ts
// Run with: npx tsx scripts/mergeMaterials.ts <keepId> <removeId1> <removeId2> ...
import { prisma } from '../src/config/database';

async function mergeMaterials(keepId: string, removeIds: string[]) {
  const keep = await prisma.material.findUnique({ where: { id: keepId } });
  if (!keep) throw new Error(`Keep material ${keepId} not found`);

  console.log(`Keeping: "${keep.name}" (${keep.unit}) — id ${keepId}`);

  await prisma.$transaction(async (tx) => {
    for (const removeId of removeIds) {
      const remove = await tx.material.findUnique({ where: { id: removeId } });
      if (!remove) { console.log(`  Skipping ${removeId} — not found`); continue; }
      console.log(`  Merging away: "${remove.name}" (${remove.unit}) — id ${removeId}`);

      // Merge InventoryItem rows — for each project that had stock under the
      // old material, fold that quantity into the kept material's row for
      // the same project (creating one if it doesn't exist yet).
      const oldItems = await tx.inventoryItem.findMany({ where: { materialId: removeId } });
      for (const item of oldItems) {
        const existing = await tx.inventoryItem.findUnique({
          where: { projectId_materialId: { projectId: item.projectId, materialId: keepId } },
        });
        if (existing) {
          const newQty = existing.quantity + item.quantity;
          const newValue = existing.quantity * existing.unitPrice + item.quantity * item.unitPrice;
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: { quantity: newQty, unitPrice: newQty > 0 ? newValue / newQty : existing.unitPrice, updatedAt: new Date() },
          });
          // Re-point this old item's stock movements to the surviving inventory row
          await tx.stockMovement.updateMany({ where: { inventoryItemId: item.id }, data: { inventoryItemId: existing.id } });
          await tx.inventoryItem.delete({ where: { id: item.id } });
        } else {
          // No existing row for kept material in this project — just re-point this one
          await tx.inventoryItem.update({ where: { id: item.id }, data: { materialId: keepId } });
        }
      }

      // Re-point everything else that references the old material by ID
      await tx.materialCoefficient.updateMany({ where: { materialId: removeId }, data: { materialId: keepId } });
      await tx.dailyReportMaterial.updateMany({ where: { materialId: removeId }, data: { materialId: keepId } });
      await tx.quotationItem.updateMany({ where: { materialId: removeId }, data: { materialId: keepId } });
      // POItem left untouched — Purchase Orders were removed from the app,
      // but the table/rows may still exist historically; safe to leave as-is.

      await tx.material.delete({ where: { id: removeId } });
      console.log(`    ✓ Merged and removed.`);
    }
  });

  console.log('Done.');
}

const [keepId, ...removeIds] = process.argv.slice(2);
if (!keepId || removeIds.length === 0) {
  console.error('Usage: npx tsx scripts/mergeMaterials.ts <keepId> <removeId1> [removeId2 ...]');
  process.exit(1);
}

mergeMaterials(keepId, removeIds)
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });