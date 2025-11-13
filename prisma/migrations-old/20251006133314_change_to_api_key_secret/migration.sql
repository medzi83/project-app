/*
  Warnings:

  - You are about to drop the column `froxlorPassword` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `froxlorUsername` on the `Server` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Server" DROP COLUMN "froxlorPassword",
DROP COLUMN "froxlorUsername",
ADD COLUMN     "froxlorApiSecret" TEXT;
