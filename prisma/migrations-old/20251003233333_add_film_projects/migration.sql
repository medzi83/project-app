-- CreateEnum
CREATE TYPE "public"."FilmScope" AS ENUM ('FILM', 'DROHNE', 'NACHDREH', 'FILM_UND_DROHNE');

-- CreateEnum
CREATE TYPE "public"."FilmPriority" AS ENUM ('NONE', 'FILM_SOLO', 'PRIO_1', 'PRIO_2');

-- CreateEnum
CREATE TYPE "public"."FilmProjectStatus" AS ENUM ('AKTIV', 'BEENDET', 'WARTEN', 'VERZICHT', 'MMW');

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."ProjectFilm" (
    "projectId" TEXT NOT NULL,
    "scope" "public"."FilmScope",
    "priority" "public"."FilmPriority" NOT NULL DEFAULT 'NONE',
    "filmerId" TEXT,
    "cutterId" TEXT,
    "contractStart" TIMESTAMP(3),
    "scouting" TIMESTAMP(3),
    "scriptToClient" TIMESTAMP(3),
    "scriptApproved" TIMESTAMP(3),
    "shootDate" TIMESTAMP(3),
    "firstCutToClient" TIMESTAMP(3),
    "finalToClient" TIMESTAMP(3),
    "onlineDate" TIMESTAMP(3),
    "lastContact" TIMESTAMP(3),
    "status" "public"."FilmProjectStatus" NOT NULL DEFAULT 'AKTIV',
    "reminderAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "ProjectFilm_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE INDEX "ProjectFilm_status_idx" ON "public"."ProjectFilm"("status");

-- CreateIndex
CREATE INDEX "ProjectFilm_filmerId_idx" ON "public"."ProjectFilm"("filmerId");

-- CreateIndex
CREATE INDEX "ProjectFilm_cutterId_idx" ON "public"."ProjectFilm"("cutterId");

-- CreateIndex
CREATE INDEX "ProjectFilm_reminderAt_idx" ON "public"."ProjectFilm"("reminderAt");

-- AddForeignKey
ALTER TABLE "public"."ProjectFilm" ADD CONSTRAINT "ProjectFilm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectFilm" ADD CONSTRAINT "ProjectFilm_filmerId_fkey" FOREIGN KEY ("filmerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectFilm" ADD CONSTRAINT "ProjectFilm_cutterId_fkey" FOREIGN KEY ("cutterId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
