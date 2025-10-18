/**
 * Script to assign customers with customer number starting with "2" to Eventomaxx agency
 * Run with: npx tsx scripts/assign-eventomaxx-customers.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function assignEventomaxxCustomers() {
  console.log("🔄 Assigning customers with number starting with '2' to Eventomaxx GmbH...\n");

  // First, find or create Eventomaxx GmbH agency
  let eventomaxxAgency = await prisma.agency.findFirst({
    where: { name: "Eventomaxx GmbH" },
  });

  if (!eventomaxxAgency) {
    console.log("⚠️  Eventomaxx GmbH agency not found. Creating...");
    eventomaxxAgency = await prisma.agency.create({
      data: {
        name: "Eventomaxx GmbH",
        contactEmail: "info@eventomaxx.de",
        contactPhone: "",
      },
    });
    console.log(`✅ Eventomaxx GmbH agency created with ID: ${eventomaxxAgency.id}\n`);
  } else {
    console.log(`✅ Found Eventomaxx GmbH agency with ID: ${eventomaxxAgency.id}\n`);
  }

  // Find all clients with customer number starting with "2"
  const clients = await prisma.client.findMany({
    where: {
      customerNo: {
        startsWith: "2",
      },
    },
    select: {
      id: true,
      customerNo: true,
      name: true,
      agencyId: true,
      agency: {
        select: {
          name: true,
        },
      },
    },
  });

  console.log(`Found ${clients.length} clients with customer number starting with '2'\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const client of clients) {
    if (client.agencyId === eventomaxxAgency.id) {
      console.log(
        `⏭️  Skipping ${client.customerNo} (${client.name}) - already assigned to Eventomaxx GmbH`
      );
      skippedCount++;
      continue;
    }

    const oldAgency = client.agency?.name || "keine Agentur";

    console.log(
      `📝 Updating ${client.customerNo} (${client.name}): ${oldAgency} → Eventomaxx GmbH`
    );

    await prisma.client.update({
      where: { id: client.id },
      data: { agencyId: eventomaxxAgency.id },
    });

    updatedCount++;
  }

  console.log(`\n✅ Assignment complete!`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Already correct: ${skippedCount}`);
  console.log(`   Total: ${clients.length}`);
}

assignEventomaxxCustomers()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
