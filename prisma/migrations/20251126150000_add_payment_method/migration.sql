-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('SEPA', 'INVOICE', 'OTHER');

-- AlterTable
ALTER TABLE "ClientContract" ADD COLUMN "paymentMethod" "PaymentMethod";
