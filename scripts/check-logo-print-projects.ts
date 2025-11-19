import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.projectWebsite.findMany({
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

  console.log(`Found ${projects.length} projects with CMS 'LOGO' or 'PRINT':\n`);

  for (const pw of projects) {
    console.log(`- ${pw.project.client.name} (CMS: ${pw.cms}, Domain: ${pw.domain || 'none'})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
