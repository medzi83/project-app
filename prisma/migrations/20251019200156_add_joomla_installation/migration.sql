-- CreateTable
CREATE TABLE "public"."JoomlaInstallation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "customerNo" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "installPath" TEXT NOT NULL,
    "installUrl" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "databasePassword" TEXT NOT NULL,
    "standardDomain" TEXT NOT NULL,
    "filesExtracted" INTEGER,
    "bytesProcessed" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JoomlaInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JoomlaInstallation_clientId_idx" ON "public"."JoomlaInstallation"("clientId");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_serverId_idx" ON "public"."JoomlaInstallation"("serverId");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_customerNo_idx" ON "public"."JoomlaInstallation"("customerNo");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_createdAt_idx" ON "public"."JoomlaInstallation"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."JoomlaInstallation" ADD CONSTRAINT "JoomlaInstallation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoomlaInstallation" ADD CONSTRAINT "JoomlaInstallation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "public"."Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
