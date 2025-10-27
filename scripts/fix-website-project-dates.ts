/**
 * Fix Website Project Dates - Timezone Offset Correction
 *
 * Problem: Website projects imported with old logic have timezone offsets
 * Example: 06.12.2024 → stored as 05.12.2024 23:00 UTC (CET offset)
 *
 * This script:
 * 1. Finds all website projects with date fields containing time components
 * 2. Adjusts dates to remove timezone offsets
 * 3. Stores dates in "naive" format (YYYY-MM-DDT00:00:00.000Z)
 */

import { prisma } from '../lib/prisma';

async function fixWebsiteProjectDates() {
  console.log('🔍 Analyzing website project dates...\n');

  // Find all website projects with dates
  const websiteProjects = await prisma.projectWebsite.findMany({
    where: {
      OR: [
        { webDate: { not: null } },
        { demoDate: { not: null } },
        { onlineDate: { not: null } },
        { lastMaterialAt: { not: null } },
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

  console.log(`Found ${websiteProjects.length} website projects with dates\n`);

  let fixed = 0;
  let skipped = 0;

  for (const wp of websiteProjects) {
    const updates: any = {};
    let hasChanges = false;

    const dateFields = [
      'webDate',
      'demoDate',
      'onlineDate',
      'lastMaterialAt'
    ] as const;

    for (const field of dateFields) {
      const date = wp[field];
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
        await prisma.projectWebsite.update({
          where: { projectId: wp.projectId },
          data: updates
        });

        console.log(`✅ Fixed dates for project ${wp.project.client?.customerNo || wp.projectId}\n`);
        fixed++;
      } catch (error) {
        console.error(`❌ Error fixing project ${wp.projectId}:`, error);
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
fixWebsiteProjectDates()
  .then(() => {
    console.log('\n✅ Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
