-- AlterTable: Add email server fields to Client
ALTER TABLE "Client" ADD COLUMN "emailServerId" TEXT;
ALTER TABLE "Client" ADD COLUMN "emailCustomerNo" TEXT;

-- CreateIndex
CREATE INDEX "Client_emailServerId_idx" ON "Client"("emailServerId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_emailServerId_fkey" FOREIGN KEY ("emailServerId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
