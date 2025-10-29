-- CreateTable
CREATE TABLE "DatabaseServer" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER DEFAULT 3306,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseServer_pkey" PRIMARY KEY ("id")
);

-- AlterTable JoomlaInstallation
ALTER TABLE "JoomlaInstallation" ADD COLUMN "databaseServerId" TEXT;
ALTER TABLE "JoomlaInstallation" ADD COLUMN "databaseHost" TEXT;
ALTER TABLE "JoomlaInstallation" ADD COLUMN "databasePort" INTEGER;

-- CreateIndex
CREATE INDEX "DatabaseServer_serverId_idx" ON "DatabaseServer"("serverId");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_databaseServerId_idx" ON "JoomlaInstallation"("databaseServerId");

-- AddForeignKey
ALTER TABLE "DatabaseServer" ADD CONSTRAINT "DatabaseServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoomlaInstallation" ADD CONSTRAINT "JoomlaInstallation_databaseServerId_fkey" FOREIGN KEY ("databaseServerId") REFERENCES "DatabaseServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
