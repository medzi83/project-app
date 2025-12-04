-- AlterTable: Make status column nullable and remove default
ALTER TABLE "ProjectFilm"
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;
