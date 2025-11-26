-- CreateEnum
CREATE TYPE "PaymentInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ContractService" AS ENUM ('WEBSITE_SUCCESS', 'WEBSITE_HOSTING', 'TEXTERSTELLUNG', 'FILM_IMAGE', 'FILM_HOSTING', 'SEO_PLUS', 'BARRIEREFREIHEIT', 'DROHNE_ONAIR', 'FOTOERSTELLUNG', 'ONLINESHOP_SHOPIT', 'FULL_CONTENT', 'SECURE_PLUS', 'ADWORDS_ADLEIT', 'SOCIAL_MEDIA');

-- CreateTable
CREATE TABLE "ClientContract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractStart" TIMESTAMP(3),
    "contractDuration" INTEGER,
    "setupFee" DECIMAL(10,2),
    "paymentInterval" "PaymentInterval",
    "monthlyAmount" DECIMAL(10,2),
    "services" "ContractService"[],
    "street" TEXT,
    "houseNumber" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "mobile" TEXT,
    "note" TEXT,
    "minTermEnd" TIMESTAMP(3),
    "cancellation" TEXT,
    "sepaMandate" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientContract_clientId_key" ON "ClientContract"("clientId");

-- CreateIndex
CREATE INDEX "ClientContract_clientId_idx" ON "ClientContract"("clientId");

-- CreateIndex
CREATE INDEX "ClientContract_contractStart_idx" ON "ClientContract"("contractStart");

-- CreateIndex
CREATE INDEX "ClientContract_minTermEnd_idx" ON "ClientContract"("minTermEnd");

-- AddForeignKey
ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
