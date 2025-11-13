/**
 * Migration Script: Client Server Relations
 *
 * Migrates existing serverId assignments to the new ClientServer many-to-many table.
 *
 * Run after: npx prisma migrate dev --name add_client_server_many_to_many
 * Execute with: npx tsx scripts/migrate-client-servers.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL + '?pgbouncer=true&connect_timeout=15',
});

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`🚀 Starting Client-Server migration (${isDryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log('');

  try {
    // Find all clients that have a serverId set
    const clientsWithServer = await prisma.client.findMany({
      where: {
        serverId: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        serverId: true,
        customerNo: true,
        server: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`📊 Found ${clientsWithServer.length} clients with server assignments`);
    console.log('');

    if (clientsWithServer.length === 0) {
      console.log('✅ No clients to migrate.');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const client of clientsWithServer) {
      try {
        // Check if ClientServer entry already exists
        const existing = await prisma.clientServer.findUnique({
          where: {
            clientId_serverId: {
              clientId: client.id,
              serverId: client.serverId!,
            },
          },
        });

        if (existing) {
          console.log(`⏭️  Skipped: ${client.name} → ${client.server?.name} (already exists)`);
          skippedCount++;
          continue;
        }

        if (isDryRun) {
          console.log(`Would create: ${client.name} → ${client.server?.name}${client.customerNo ? ` (KD: ${client.customerNo})` : ''}`);
          migratedCount++;
        } else {
          await prisma.clientServer.create({
            data: {
              clientId: client.id,
              serverId: client.serverId!,
              customerNo: client.customerNo,
            },
          });
          console.log(`✅ Migrated: ${client.name} → ${client.server?.name}${client.customerNo ? ` (KD: ${client.customerNo})` : ''}`);
          migratedCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating ${client.name}:`, error instanceof Error ? error.message : error);
        errorCount++;
      }
    }

    console.log('');
    console.log('📈 Migration Summary:');
    console.log(`   Migrated: ${migratedCount}`);
    console.log(`   Skipped:  ${skippedCount}`);
    console.log(`   Errors:   ${errorCount}`);
    console.log('');

    if (isDryRun) {
      console.log('ℹ️  This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to apply changes.');
    } else {
      console.log('✨ Migration complete!');
      console.log('');
      console.log('⚠️  Note: The old serverId field is kept for backwards compatibility.');
      console.log('   After verifying everything works, you can remove it in a future migration.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
