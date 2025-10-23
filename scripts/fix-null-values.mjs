import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixNullValues() {
  console.log('Fixing null values in UserPreferences...');

  // Get all user preferences
  const preferences = await prisma.userPreferences.findMany();

  console.log(`Found ${preferences.length} user preferences`);

  for (const pref of preferences) {
    const updates = {};

    // Replace null with empty arrays for JSON fields
    if (pref.filmProjectsAgentFilter === null) {
      updates.filmProjectsAgentFilter = [];
    }
    if (pref.filmProjectsStatusFilter === null) {
      updates.filmProjectsStatusFilter = [];
    }
    if (pref.filmProjectsPStatusFilter === null) {
      updates.filmProjectsPStatusFilter = [];
    }
    if (pref.filmProjectsScopeFilter === null) {
      updates.filmProjectsScopeFilter = [];
    }

    if (Object.keys(updates).length > 0) {
      console.log(`Updating user preference ${pref.id}:`, updates);
      await prisma.userPreferences.update({
        where: { id: pref.id },
        data: updates,
      });
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

fixNullValues().catch(console.error);
