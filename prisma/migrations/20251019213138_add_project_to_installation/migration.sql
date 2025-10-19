-- AlterTable
ALTER TABLE "public"."JoomlaInstallation" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "JoomlaInstallation_projectId_idx" ON "public"."JoomlaInstallation"("projectId");

-- AddForeignKey
ALTER TABLE "public"."JoomlaInstallation" ADD CONSTRAINT "JoomlaInstallation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
