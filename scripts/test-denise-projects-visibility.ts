import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Denise
  const denise = await prisma.user.findFirst({
    where: {
      name: 'Denise',
      role: 'AGENT',
    },
  });

  if (!denise) {
    console.log('Denise not found');
    return;
  }

  console.log(`Denise: ${denise.name} (ID: ${denise.id}, active: ${denise.active})\n`);

  // Count her projects by type
  const websiteProjects = await prisma.project.count({
    where: {
      agentId: denise.id,
      OR: [
        { type: 'WEBSITE' },
        { website: { isNot: null } }
      ],
    },
  });

  const filmProjects = await prisma.project.count({
    where: {
      type: 'FILM',
      film: {
        OR: [
          { filmerId: denise.id },
          { cutterId: denise.id },
        ],
      },
    },
  });

  const printProjects = await prisma.project.count({
    where: {
      type: 'PRINT_DESIGN',
      agentId: denise.id,
    },
  });

  console.log(`Website projects: ${websiteProjects}`);
  console.log(`Film projects: ${filmProjects}`);
  console.log(`Print & Design projects: ${printProjects}`);

  // Show sample of her website projects
  const sampleProjects = await prisma.project.findMany({
    where: {
      agentId: denise.id,
      type: 'WEBSITE',
    },
    include: {
      client: { select: { name: true, customerNo: true } },
    },
    take: 5,
  });

  console.log('\nSample of Denise\'s website projects:');
  sampleProjects.forEach(p => {
    console.log(`  - ${p.client.customerNo}: ${p.client.name}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
