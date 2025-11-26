-- CreateEnum
CREATE TYPE "CustomerNoticeTargetGroup" AS ENUM ('ALL_CUSTOMERS', 'AGENCY_CUSTOMERS', 'SELECTED_CUSTOMERS');

-- CreateTable
CREATE TABLE "CustomerNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetGroup" "CustomerNoticeTargetGroup" NOT NULL DEFAULT 'ALL_CUSTOMERS',
    "agencyId" TEXT,
    "showOnDashboard" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerNoticeRecipient" (
    "noticeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNoticeRecipient_pkey" PRIMARY KEY ("noticeId","clientId")
);

-- CreateIndex
CREATE INDEX "CustomerNotice_isActive_targetGroup_idx" ON "CustomerNotice"("isActive", "targetGroup");

-- CreateIndex
CREATE INDEX "CustomerNotice_isActive_showOnDashboard_idx" ON "CustomerNotice"("isActive", "showOnDashboard");

-- CreateIndex
CREATE INDEX "CustomerNotice_createdById_idx" ON "CustomerNotice"("createdById");

-- CreateIndex
CREATE INDEX "CustomerNotice_agencyId_idx" ON "CustomerNotice"("agencyId");

-- CreateIndex
CREATE INDEX "CustomerNoticeRecipient_clientId_idx" ON "CustomerNoticeRecipient"("clientId");

-- AddForeignKey
ALTER TABLE "CustomerNotice" ADD CONSTRAINT "CustomerNotice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNotice" ADD CONSTRAINT "CustomerNotice_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNoticeRecipient" ADD CONSTRAINT "CustomerNoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "CustomerNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNoticeRecipient" ADD CONSTRAINT "CustomerNoticeRecipient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
