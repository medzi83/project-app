-- CreateEnum
CREATE TYPE "public"."NoticeVisibility" AS ENUM ('GLOBAL', 'TARGETED');

-- CreateTable
CREATE TABLE "public"."Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "visibility" "public"."NoticeVisibility" NOT NULL DEFAULT 'GLOBAL',
    "requireAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NoticeRecipient" (
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("noticeId","userId")
);

-- CreateTable
CREATE TABLE "public"."NoticeAcknowledgement" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_isActive_visibility_idx" ON "public"."Notice"("isActive", "visibility");

-- CreateIndex
CREATE INDEX "Notice_createdById_idx" ON "public"."Notice"("createdById");

-- CreateIndex
CREATE INDEX "NoticeRecipient_userId_idx" ON "public"."NoticeRecipient"("userId");

-- CreateIndex
CREATE INDEX "NoticeAcknowledgement_userId_idx" ON "public"."NoticeAcknowledgement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeAcknowledgement_noticeId_userId_key" ON "public"."NoticeAcknowledgement"("noticeId", "userId");

-- AddForeignKey
ALTER TABLE "public"."Notice" ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "public"."Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "public"."Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
