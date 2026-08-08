import { prisma } from './src/config/database';

prisma.user.findMany({
  select: { email: true, role: true, isActive: true },
}).then((users) => {
  console.table(users);
  process.exit(0);
});