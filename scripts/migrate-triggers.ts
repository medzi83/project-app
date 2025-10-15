/**
 * Migrationsskript: DATE_FIELD_SET → CONDITION_MET
 *
 * Dieses Script konvertiert alle bestehenden DATE_FIELD_SET Trigger
 * zu CONDITION_MET mit Operator "SET"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting trigger migration...");

  // Find all DATE_FIELD_SET triggers
  const triggersToMigrate = await prisma.emailTrigger.findMany({
    where: {
      triggerType: "DATE_FIELD_SET",
    },
  });

  console.log(`Found ${triggersToMigrate.length} triggers to migrate`);

  for (const trigger of triggersToMigrate) {
    const conditions = trigger.conditions as Record<string, unknown>;

    // Update trigger type and ensure operator is SET
    await prisma.emailTrigger.update({
      where: { id: trigger.id },
      data: {
        triggerType: "CONDITION_MET",
        conditions: {
          ...conditions,
          operator: "SET",
        },
      },
    });

    console.log(`✓ Migrated trigger: ${trigger.name}`);
  }

  console.log("Migration completed!");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
