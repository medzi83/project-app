// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const useDirect =
  process.env.NODE_ENV !== "production" && !!process.env.DIRECT_URL;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: useDirect ? process.env.DIRECT_URL : process.env.DATABASE_URL },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
