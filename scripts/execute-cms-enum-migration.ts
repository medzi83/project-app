import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Removing LOGO and PRINT from CMS enum...\n');

  try {
    // Execute the migration SQL
    await prisma.$executeRawUnsafe(`
      -- Verify no projects are using these values
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "ProjectWebsite" WHERE cms IN ('LOGO', 'PRINT')) THEN
          RAISE EXCEPTION 'Cannot remove LOGO/PRINT from CMS enum: Projects still using these values';
        END IF;
      END $$;
    `);

    console.log('✓ Verification passed: No projects using LOGO or PRINT\n');

    await prisma.$executeRawUnsafe(`
      -- Remove the enum values
      ALTER TYPE "CMS" RENAME TO "CMS_old";
    `);

    console.log('✓ Renamed old CMS enum\n');

    await prisma.$executeRawUnsafe(`
      CREATE TYPE "CMS" AS ENUM ('SHOPWARE', 'WORDPRESS', 'JOOMLA', 'CUSTOM', 'OTHER');
    `);

    console.log('✓ Created new CMS enum without LOGO and PRINT\n');

    // Drop default constraint first
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProjectWebsite"
        ALTER COLUMN cms DROP DEFAULT;
    `);

    console.log('✓ Dropped default constraint\n');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProjectWebsite"
        ALTER COLUMN cms TYPE "CMS" USING cms::text::"CMS";
    `);

    console.log('✓ Updated ProjectWebsite table\n');

    // Re-add default constraint
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProjectWebsite"
        ALTER COLUMN cms SET DEFAULT 'JOOMLA'::"CMS";
    `);

    console.log('✓ Re-added default constraint\n');

    await prisma.$executeRawUnsafe(`
      DROP TYPE "CMS_old";
    `);

    console.log('✓ Dropped old CMS enum\n');

    console.log('=== Migration completed successfully! ===');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
