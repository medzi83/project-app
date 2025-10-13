-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "finished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workStopped" BOOLEAN NOT NULL DEFAULT false;
