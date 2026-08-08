// Run with: npx tsx scripts/seedDocumentCategories.ts
import { prisma } from '../src/config/database';

// Predefined Expense categories, aligned with the pages that auto-create
// expenses (Inventory receives → "Inventory", Truck Entries transfer →
// "Truck Entries", Machinery transfer → "Machinery") plus manual-entry ones.
const DEFAULT_EXPENSE_CATEGORIES = [
  'Inventory', 'Machinery', 'Truck Entries', 'Labour', 'Salary', 'Others',
];

async function seed() {
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
    console.error('No SUPER_ADMIN user found — create one first, then re-run this script.');
    process.exit(1);
  }

  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    const existing = await prisma.documentCategory.findFirst({
      where: { module: 'expenses', name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      console.log(`Skipping "${name}" — already exists`);
      continue;
    }
    await prisma.documentCategory.create({
      data: { id: crypto.randomUUID(), module: 'expenses', name, createdBy: admin.id },
    });
    console.log(`Created "${name}"`);
  }

  console.log('Done.');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});