// cleanup-stray-users.ts
import { prisma } from './src/config/database';

const STRAY_EMAILS = ['engineer@erp.com', 'accountant@erp.com', 'store@erp.com'];

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: STRAY_EMAILS } },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log('No matching users found — already cleaned up.');
    return;
  }

  const userIds = users.map((u) => u.id);

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.notification.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);

  console.log(`Deleted ${users.length} stray accounts:`, users.map((u) => u.email));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });