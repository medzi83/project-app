-- AlterTable: Add showOnDashboard column to CustomerNotice
ALTER TABLE "CustomerNotice" ADD COLUMN "showOnDashboard" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CustomerNotice_isActive_showOnDashboard_idx" ON "CustomerNotice"("isActive", "showOnDashboard");
