import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

declare const process: {
  exit(code?: number): never;
};

const prisma = new PrismaClient();

const id = () => randomUUID();

async function main() {
  console.log('🌱 Starting production seed...');

  // Clean existing data in correct order (respects FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.taskDailyLogMaterial.deleteMany();
  await prisma.taskDailyLogWorker.deleteMany();
  await prisma.taskDailyLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.materialCoefficient.deleteMany();
  await prisma.taskType.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.labourEntry.deleteMany();
  await prisma.dailyReportWorker.deleteMany();
  await prisma.dailyReportMaterial.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.costTransfer.deleteMany();
  await prisma.workerProject.deleteMany();
  await prisma.salary.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.correctionRequest.deleteMany();
  await prisma.truckEntry.deleteMany();
  await prisma.machineryLog.deleteMany();
  await prisma.projectMachinery.deleteMany();
  await prisma.machinery.deleteMany();
  await prisma.pOItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.documentCategory.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.material.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.contractor.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleaned all existing data');

  // ─── PRODUCTION LOGIN ACCOUNTS ONLY ───────────────────────────
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const pmHash = await bcrypt.hash('12345678', 12);

  await prisma.user.create({
    data: {
      id: id(),
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@erp.com',
      password: adminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.user.create({
    data: {
      id: id(),
      firstName: 'Yash',
      lastName: 'PM',
      email: 'yash@erp.com',
      password: pmHash,
      role: 'PROJECT_MANAGER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('✅ Production login accounts created');

  console.log('\n🎉 Production seed completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Login credentials:');
  console.log('  Super Admin     → admin@erp.com / Admin@123');
  console.log('  Project Manager → yash@erp.com / 12345678');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Database is otherwise empty — no demo projects,');
  console.log('  materials, vendors, workers, or transactions.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());