/**
 * Script to assign customers with customer number starting with "3" to Vendoweb agency
 * Run with: npx tsx scripts/assign-vendoweb-customers.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function assignVendowebCustomers() {
  console.log("🔄 Assigning customers with number starting with '3' to Vendoweb GmbH...\n");

  // First, find or create Vendoweb GmbH agency
  let vendowebAgency = await prisma.agency.findFirst({
    where: { name: "Vendoweb GmbH" },
  });

  if (!vendowebAgency) {
    console.log("⚠️  Vendoweb GmbH agency not found. Creating...");
    vendowebAgency = await prisma.agency.create({
      data: {
        name: "Vendoweb GmbH",
        contactEmail: "info@vendoweb.de",
        contactPhone: "",
      },
    });
    console.log(`✅ Vendoweb GmbH agency created with ID: ${vendowebAgency.id}\n`);
  } else {
    console.log(`✅ Found Vendoweb GmbH agency with ID: ${vendowebAgency.id}\n`);
  }

  // Find all clients with customer number starting with "3"
  const clients = await prisma.client.findMany({
    where: {
      customerNo: {
        startsWith: "3",
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

  console.log(`Found ${clients.length} clients with customer number starting with '3'\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const client of clients) {
    if (client.agencyId === vendowebAgency.id) {
      console.log(
        `⏭️  Skipping ${client.customerNo} (${client.name}) - already assigned to Vendoweb GmbH`
      );
      skippedCount++;
      continue;
    }

    const oldAgency = client.agency?.name || "keine Agentur";

    console.log(
      `📝 Updating ${client.customerNo} (${client.name}): ${oldAgency} → Vendoweb GmbH`
    );

    await prisma.client.update({
      where: { id: client.id },
      data: { agencyId: vendowebAgency.id },
    });

    updatedCount++;
  }

  console.log(`\n✅ Assignment complete!`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Already correct: ${skippedCount}`);
  console.log(`   Total: ${clients.length}`);
}

assignVendowebCustomers()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
