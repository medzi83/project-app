-- CreateTable: WebDocumentation für Webseitenprojekte
CREATE TABLE "WebDocumentation" (
    "projectId" TEXT NOT NULL,
    "companyName" TEXT,
    "companyFocus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebDocumentation_pkey" PRIMARY KEY ("projectId")
);

-- AddForeignKey
ALTER TABLE "WebDocumentation" ADD CONSTRAINT "WebDocumentation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectWebsite"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
