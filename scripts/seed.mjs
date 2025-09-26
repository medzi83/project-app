// scripts/seed.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

const hash = (s) => bcrypt.hashSync(s, 10);

async function main() {
  console.log("Seeding (idempotent)…");

  // 1) Client (Kunde) – per customerNo eindeutig
  const customerNo = "K10001";
  let demoClient = await prisma.client.findUnique({ where: { customerNo } });
  if (!demoClient) {
    // Falls dein alter Demo-Client ohne Kundennummer existiert, kannst du ihn auch nachträglich updaten:
    // const existingByName = await prisma.client.findFirst({ where: { name: "Demo GmbH" } });
    // if (existingByName && !existingByName.customerNo) {
    //   demoClient = await prisma.client.update({ where: { id: existingByName.id }, data: { customerNo } });
    // } else {
    demoClient = await prisma.client.create({
      data: {
        name: "Demo GmbH",
        customerNo,
        contact: "Max Mustermann",
        phone: "01234 56789",
      },
    });
    // }
  }

  // 2) Users – upsert per email
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      password: hash("admin123"),
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@example.com" },
    update: {},
    create: {
      email: "agent@example.com",
      name: "Agentin",
      role: "AGENT",
      password: hash("agent123"),
    },
  });

  await prisma.user.upsert({
    where: { email: "kunde@example.com" },
    update: {},
    create: {
      email: "kunde@example.com",
      name: "Kunde",
      role: "CUSTOMER",
      clientId: demoClient.id,
      password: hash("kunde123"),
    },
  });

  // 3) Projekt – „Website Relaunch“ einmalig je Client
  let project = await prisma.project.findFirst({
    where: { clientId: demoClient.id, title: "Website Relaunch", type: "WEBSITE" },
    include: { website: true },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        title: "Website Relaunch",
        type: "WEBSITE",
        status: "IN_PROGRESS",
        clientId: demoClient.id,
        agentId: agent.id,
        important: "SEO-Migration beachten",
      },
    });
  }

  // 4) Website-Details – 1:1 per projectId upsert
  await prisma.projectWebsite.upsert({
    where: { projectId: project.id },
    update: {
      domain: "www.demo-gmbh.de",
      priority: "HIGH",
      cms: "SHOPWARE",
      pStatus: "WITH_CUSTOMER",
      webDate: new Date(),
      demoDate: null,
      onlineDate: null,
      lastMaterialAt: null,
      effortBuildMin: 540,
      effortDemoMin: 60,
      materialAvailable: true,
      seo: "ANALYSIS",
      textit: "SENT_OUT",
      accessible: false,
      note: "Headerbilder fehlen noch",
      demoLink: "https://demo.example.com/relaunch",
    },
    create: {
      projectId: project.id,
      domain: "www.demo-gmbh.de",
      priority: "HIGH",
      cms: "SHOPWARE",
      pStatus: "WITH_CUSTOMER",
      webDate: new Date(),
      effortBuildMin: 540,
      effortDemoMin: 60,
      materialAvailable: true,
      seo: "ANALYSIS",
      textit: "SENT_OUT",
      accessible: false,
      note: "Headerbilder fehlen noch",
      demoLink: "https://demo.example.com/relaunch",
    },
  });

  console.log("Seed done.");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
