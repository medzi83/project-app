-- CreateTable
CREATE TABLE "public"."MailServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "username" TEXT,
    "password" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "useTls" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "agencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailServer_agencyId_idx" ON "public"."MailServer"("agencyId");
CREATE INDEX "MailServer_name_idx" ON "public"."MailServer"("name");

-- AddForeignKey
ALTER TABLE "public"."MailServer" ADD CONSTRAINT "MailServer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "public"."Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
