-- CreateEnum
CREATE TYPE "public"."WebterminType" AS ENUM ('TELEFONISCH', 'BEIM_KUNDEN', 'IN_DER_AGENTUR');

-- AlterTable
ALTER TABLE "public"."ProjectWebsite" ADD COLUMN     "webterminType" "public"."WebterminType";
