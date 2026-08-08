// Run once with: npx tsx scripts/backfillMachineryLogProject.ts
import { prisma } from '../src/config/database';

async function backfill() {
  const logs = await prisma.machineryLog.findMany({ where: { projectId: null } });
  console.log(`Found ${logs.length} logs missing a project.`);

  for (const log of logs) {
    const links = await prisma.projectMachinery.findMany({
      where: { machineryId: log.machineryId },
      include: { Project: true },
    });

    if (links.length === 1) {
      await prisma.machineryLog.update({
        where: { id: log.id },
        data: { projectId: links[0].projectId },
      });
      console.log(`Log ${log.id} → assigned to project "${links[0].Project.name}"`);
    } else if (links.length === 0) {
      console.log(`Log ${log.id} → SKIPPED, machine has no project link at all. Needs manual fix.`);
    } else {
      console.log(`Log ${log.id} → SKIPPED, machine is linked to ${links.length} different projects — ambiguous, needs manual choice.`);
    }
  }

  console.log('Done. Check output above for any SKIPPED logs — those need manual assignment.');
  process.exit(0);
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});