-- CreateTable
CREATE TABLE "ClientServer" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "customerNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientServer_clientId_idx" ON "ClientServer"("clientId");

-- CreateIndex
CREATE INDEX "ClientServer_serverId_idx" ON "ClientServer"("serverId");

-- CreateIndex
CREATE INDEX "ClientServer_customerNo_idx" ON "ClientServer"("customerNo");

-- CreateIndex
CREATE UNIQUE INDEX "ClientServer_clientId_serverId_key" ON "ClientServer"("clientId", "serverId");

-- AddForeignKey
ALTER TABLE "ClientServer" ADD CONSTRAINT "ClientServer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServer" ADD CONSTRAINT "ClientServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
