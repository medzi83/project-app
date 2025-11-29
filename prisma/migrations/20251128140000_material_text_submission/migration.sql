-- CreateTable
CREATE TABLE "MaterialTextSubmission" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialTextSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialTextSubmission_menuItemId_key" ON "MaterialTextSubmission"("menuItemId");

-- AddForeignKey
ALTER TABLE "MaterialTextSubmission" ADD CONSTRAINT "MaterialTextSubmission_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "WebDocuMenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
