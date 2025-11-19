import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for projects with archived agents...\n');

  // Website projects
  const websiteProjects = await prisma.project.findMany({
    where: {
      type: 'WEBSITE',
      agent: {
        active: false,
      },
    },
    include: {
      agent: { select: { id: true, name: true, active: true } },
      client: { select: { name: true, customerNo: true } },
    },
  });

  console.log(`Website projects with archived agents: ${websiteProjects.length}`);
  websiteProjects.slice(0, 5).forEach((p) => {
    console.log(`  - ${p.client.customerNo}: ${p.client.name} | Agent: ${p.agent?.name} (active: ${p.agent?.active})`);
  });

  // Film projects
  const filmProjects = await prisma.project.findMany({
    where: {
      type: 'FILM',
      film: {
        isNot: null,
        OR: [
          { filmer: { active: false } },
          { cutter: { active: false } },
        ],
      },
    },
    include: {
      film: {
        include: {
          filmer: { select: { id: true, name: true, active: true } },
          cutter: { select: { id: true, name: true, active: true } },
        },
      },
      client: { select: { name: true, customerNo: true } },
    },
  });

  console.log(`\nFilm projects with archived filmer/cutter: ${filmProjects.length}`);
  filmProjects.slice(0, 5).forEach((p) => {
    console.log(`  - ${p.client.customerNo}: ${p.client.name}`);
    if (p.film?.filmer && !p.film.filmer.active) {
      console.log(`      Filmer: ${p.film.filmer.name} (archived)`);
    }
    if (p.film?.cutter && !p.film.cutter.active) {
      console.log(`      Cutter: ${p.film.cutter.name} (archived)`);
    }
  });

  // Print Design projects
  const printProjects = await prisma.project.findMany({
    where: {
      type: 'PRINT_DESIGN',
      agent: {
        active: false,
      },
    },
    include: {
      agent: { select: { id: true, name: true, active: true } },
      client: { select: { name: true, customerNo: true } },
    },
  });

  console.log(`\nPrint & Design projects with archived agents: ${printProjects.length}`);
  printProjects.slice(0, 5).forEach((p) => {
    console.log(`  - ${p.client.customerNo}: ${p.client.name} | Agent: ${p.agent?.name} (active: ${p.agent?.active})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
