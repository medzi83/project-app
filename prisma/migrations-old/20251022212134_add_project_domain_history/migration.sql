-- CreateTable
CREATE TABLE "public"."ProjectDomainHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDomainHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectDomainHistory_projectId_idx" ON "public"."ProjectDomainHistory"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDomainHistory_domain_idx" ON "public"."ProjectDomainHistory"("domain");

-- AddForeignKey
ALTER TABLE "public"."ProjectDomainHistory" ADD CONSTRAINT "ProjectDomainHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."ProjectWebsite"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
