/**
 * Script to sync all website project statuses
 * Run with: npx tsx scripts/sync-project-status.ts
 */

import { PrismaClient } from "@prisma/client";
import { deriveProjectStatus } from "../lib/project-status";

const prisma = new PrismaClient();

async function syncProjectStatuses() {
  console.log("🔄 Syncing project statuses...\n");

  const projects = await prisma.project.findMany({
    where: {
      type: "WEBSITE",
      website: { isNot: null },
    },
    include: {
      website: {
        select: {
          pStatus: true,
          webDate: true,
          demoDate: true,
          onlineDate: true,
          materialStatus: true,
        },
      },
    },
  });

  console.log(`Found ${projects.length} website projects\n`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const project of projects) {
    try {
      const derivedStatus = deriveProjectStatus({
        pStatus: project.website?.pStatus,
        webDate: project.website?.webDate,
        demoDate: project.website?.demoDate,
        onlineDate: project.website?.onlineDate,
        materialStatus: project.website?.materialStatus,
      });

      if (project.status !== derivedStatus) {
        console.log(
          `📝 Updating project ${project.id}: ${project.status} → ${derivedStatus}`
        );

        await prisma.project.update({
          where: { id: project.id },
          data: { status: derivedStatus },
        });

        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ Error updating project ${project.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Unchanged: ${projects.length - updatedCount - errorCount}`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount}`);
  }
}

syncProjectStatuses()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
