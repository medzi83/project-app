import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Rolling back partial enum migration...\n');

  try {
    // Check if CMS_old exists
    const result = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname FROM pg_type WHERE typname IN ('CMS', 'CMS_old');
    `;

    console.log('Found types:', result.map(r => r.typname).join(', '));

    if (result.some(r => r.typname === 'CMS_old')) {
      console.log('\nRolling back to CMS_old...\n');

      // Drop the new CMS type
      await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "CMS";`);
      console.log('✓ Dropped new CMS type');

      // Rename CMS_old back to CMS
      await prisma.$executeRawUnsafe(`ALTER TYPE "CMS_old" RENAME TO "CMS";`);
      console.log('✓ Renamed CMS_old back to CMS');

      console.log('\n=== Rollback completed! ===');
    } else {
      console.log('\nNothing to rollback - CMS_old does not exist');
    }
  } catch (error) {
    console.error('Error during rollback:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
