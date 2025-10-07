-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "serverId" TEXT;

-- AlterTable
ALTER TABLE "public"."Server" ADD COLUMN     "hostname" TEXT;

-- CreateIndex
CREATE INDEX "Client_serverId_idx" ON "public"."Client"("serverId");

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "public"."Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
