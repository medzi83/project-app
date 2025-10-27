/**
 * Fix Film Project Dates - Timezone Offset Correction
 *
 * Problem: Film projects imported with old logic have timezone offsets
 * Example: 27.01.2022 → stored as 26.01.2022 23:00 UTC (CET offset)
 * Example: 26.05.2023 → stored as 25.05.2023 22:00 UTC (CEST offset)
 *
 * This script:
 * 1. Finds all film projects with date fields containing time components
 * 2. Adjusts dates to remove timezone offsets
 * 3. Stores dates in "naive" format (YYYY-MM-DDT00:00:00.000Z)
 */

import { prisma } from '../lib/prisma';

async function fixFilmProjectDates() {
  console.log('🔍 Analyzing film project dates...\n');

  // Find all film projects with dates
  const filmProjects = await prisma.projectFilm.findMany({
    where: {
      OR: [
        { contractStart: { not: null } },
        { scouting: { not: null } },
        { scriptToClient: { not: null } },
        { scriptApproved: { not: null } },
        { shootDate: { not: null } },
        { firstCutToClient: { not: null } },
        { finalToClient: { not: null } },
        { onlineDate: { not: null } },
        { lastContact: { not: null } },
        { reminderAt: { not: null } },
      ]
    },
    include: {
      project: {
        include: {
          client: true
        }
      }
    }
  });

  console.log(`Found ${filmProjects.length} film projects with dates\n`);

  let fixed = 0;
  let skipped = 0;

  for (const fp of filmProjects) {
    const updates: any = {};
    let hasChanges = false;

    const dateFields = [
      'contractStart',
      'scouting',
      'scriptToClient',
      'scriptApproved',
      'shootDate',
      'firstCutToClient',
      'finalToClient',
      'onlineDate',
      'lastContact',
      'reminderAt'
    ] as const;

    for (const field of dateFields) {
      const date = fp[field];
      if (!date) continue;

      const dateStr = date.toISOString();

      // Check if date has time component (not 00:00:00)
      if (!dateStr.includes('T00:00:00.000Z')) {
        // Date has timezone offset - needs fixing
        const localDate = new Date(date);

        // Get date in CET/CEST timezone (Europe/Berlin)
        const berlinDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));

        // Construct naive ISO string
        const year = berlinDate.getFullYear();
        const month = (berlinDate.getMonth() + 1).toString().padStart(2, '0');
        const day = berlinDate.getDate().toString().padStart(2, '0');
        const naiveISO = `${year}-${month}-${day}T00:00:00.000Z`;

        updates[field] = new Date(naiveISO);
        hasChanges = true;

        console.log(`  ${field}: ${dateStr} → ${naiveISO}`);
      }
    }

    if (hasChanges) {
      try {
        await prisma.projectFilm.update({
          where: { projectId: fp.projectId },
          data: updates
        });

        console.log(`✅ Fixed dates for project ${fp.project.client?.customerNo || fp.projectId}\n`);
        fixed++;
      } catch (error) {
        console.error(`❌ Error fixing project ${fp.projectId}:`, error);
      }
    } else {
      skipped++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Fixed: ${fixed} projects`);
  console.log(`  ⏭️  Skipped: ${skipped} projects (already correct)`);
}

// Run the script
fixFilmProjectDates()
  .then(() => {
    console.log('\n✅ Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
