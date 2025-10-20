-- AlterTable
ALTER TABLE "public"."EmailLog" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "EmailLog_clientId_idx" ON "public"."EmailLog"("clientId");

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
