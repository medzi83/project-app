// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

type GlobalPrismaCache = { prisma?: PrismaClient };
const globalForPrisma = globalThis as unknown as GlobalPrismaCache;

const createClient = () =>
  new PrismaClient({
    log: ["error", "warn"],
  });

const needsNewClient = (client: PrismaClient | undefined) => {
  if (!client) return true;
  // When the Prisma schema changes (new models/enums), the dev server may still hold onto
  // an instance created before the update. In that case the new properties are missing.
  return typeof (client as PrismaClient).emailTrigger?.findMany !== "function";
};

const prismaClient = needsNewClient(globalForPrisma.prisma)
  ? createClient()
  : globalForPrisma.prisma!;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;
