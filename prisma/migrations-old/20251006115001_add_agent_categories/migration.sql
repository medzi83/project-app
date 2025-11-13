-- CreateEnum
CREATE TYPE "public"."AgentCategory" AS ENUM ('WEBSEITE', 'FILM', 'SOCIALMEDIA');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "categories" "public"."AgentCategory"[];
