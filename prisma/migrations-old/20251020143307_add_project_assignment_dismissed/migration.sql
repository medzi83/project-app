-- AlterTable
ALTER TABLE "public"."JoomlaInstallation" ADD COLUMN     "projectAssignmentDismissed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "JoomlaInstallation_projectAssignmentDismissed_idx" ON "public"."JoomlaInstallation"("projectAssignmentDismissed");
