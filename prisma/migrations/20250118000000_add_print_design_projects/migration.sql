-- CreateEnum
CREATE TYPE "PrintDesignType" AS ENUM ('LOGO', 'VISITENKARTE', 'FLYER', 'PLAKAT', 'BROSCHÜRE', 'SONSTIGES');

-- AlterEnum
ALTER TYPE "ProjectType" ADD VALUE 'PRINT_DESIGN';

-- AlterEnum
ALTER TYPE "AgentCategory" ADD VALUE 'PRINT_DESIGN';

-- AlterEnum
ALTER TYPE "EmailTemplateCategory" ADD VALUE 'PRINT_DESIGN';

-- AlterTable UserPreferences
ALTER TABLE "UserPreferences"
ADD COLUMN "printDesignAgentFilter" JSONB,
ADD COLUMN "printDesignStatusFilter" JSONB,
ADD COLUMN "printDesignProjectTypeFilter" JSONB;

-- CreateTable
CREATE TABLE "ProjectPrintDesign" (
    "projectId" TEXT NOT NULL,
    "projectType" "PrintDesignType",
    "pStatus" "ProductionStatus" NOT NULL DEFAULT 'NONE',
    "webtermin" TIMESTAMP(3),
    "implementation" TIMESTAMP(3),
    "designToClient" TIMESTAMP(3),
    "designApproval" TIMESTAMP(3),
    "finalVersionToClient" TIMESTAMP(3),
    "printRequired" BOOLEAN NOT NULL DEFAULT false,
    "printOrderPlaced" TIMESTAMP(3),
    "printProvider" TEXT,
    "note" TEXT,

    CONSTRAINT "ProjectPrintDesign_pkey" PRIMARY KEY ("projectId")
);

-- AddForeignKey
ALTER TABLE "ProjectPrintDesign" ADD CONSTRAINT "ProjectPrintDesign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
