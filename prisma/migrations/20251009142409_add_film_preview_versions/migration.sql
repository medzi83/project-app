-- CreateTable
CREATE TABLE "public"."FilmPreviewVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilmPreviewVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FilmPreviewVersion_projectId_sentDate_idx" ON "public"."FilmPreviewVersion"("projectId", "sentDate");

-- CreateIndex
CREATE UNIQUE INDEX "FilmPreviewVersion_projectId_version_key" ON "public"."FilmPreviewVersion"("projectId", "version");

-- AddForeignKey
ALTER TABLE "public"."FilmPreviewVersion" ADD CONSTRAINT "FilmPreviewVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."ProjectFilm"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
