import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: Convert LOGO/PRINT projects to Print & Design...\n');

  // Find all projects with CMS LOGO or PRINT
  const websiteProjects = await prisma.projectWebsite.findMany({
    where: {
      OR: [
        { cms: 'LOGO' },
        { cms: 'PRINT' },
      ],
    },
    include: {
      project: {
        include: {
          client: true,
        },
      },
    },
  });

  console.log(`Found ${websiteProjects.length} projects to migrate\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const websiteProject of websiteProjects) {
    const { project, cms, pStatus, webDate } = websiteProject;

    try {
      // Determine PrintDesignType based on CMS value
      const projectType = cms === 'LOGO' ? 'LOGO' : 'SONSTIGES';

      console.log(`Migrating: ${project.client.name} (CMS: ${cms} → Type: ${projectType})`);

      await prisma.$transaction(async (tx) => {
        // 1. Create ProjectPrintDesign entry
        await tx.projectPrintDesign.create({
          data: {
            projectId: project.id,
            projectType: projectType,
            pStatus: pStatus,
            webtermin: webDate,
            // Leave other fields null/default
          },
        });

        // 2. Update Project type to PRINT_DESIGN
        await tx.project.update({
          where: { id: project.id },
          data: { type: 'PRINT_DESIGN' },
        });

        // 3. Delete the ProjectWebsite entry
        await tx.projectWebsite.delete({
          where: { projectId: project.id },
        });
      });

      successCount++;
      console.log(`  ✓ Successfully migrated\n`);
    } catch (error) {
      errorCount++;
      console.error(`  ✗ Error migrating project ${project.id}:`, error);
      console.log();
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Total projects: ${websiteProjects.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
