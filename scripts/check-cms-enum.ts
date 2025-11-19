import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
    SELECT enumlabel
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CMS')
    ORDER BY enumsortorder;
  `;

  console.log('Current CMS enum values in database:');
  result.forEach((row) => console.log(`  - ${row.enumlabel}`));

  // Also check if there are any ProjectWebsite records with LOGO or PRINT
  const logoOrPrintProjects = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM "ProjectWebsite"
    WHERE cms IN ('LOGO', 'PRINT');
  `;

  console.log(`\nProjects with CMS LOGO or PRINT: ${logoOrPrintProjects[0].count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
