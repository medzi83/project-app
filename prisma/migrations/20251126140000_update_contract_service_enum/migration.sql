-- Drop the old enum values and add new ones
-- First, we need to drop and recreate the enum since PostgreSQL doesn't allow easy enum value changes

-- Remove the services column temporarily (it uses the enum)
ALTER TABLE "ClientContract" DROP COLUMN IF EXISTS "services";

-- Drop the old enum
DROP TYPE IF EXISTS "ContractService";

-- Create new enum with updated values
CREATE TYPE "ContractService" AS ENUM (
  'WEBSITE_SUCCESS',
  'WEBSITE_HOSTING',
  'TEXTERSTELLUNG',
  'FILM_IMAGE',
  'FILM_HOSTING',
  'SEO_PLUS',
  'BARRIEREFREIHEIT',
  'DROHNE_ONAIR',
  'FOTOERSTELLUNG',
  'ONLINESHOP_SHOPIT',
  'FULL_CONTENT',
  'SECURE_PLUS',
  'ADWORDS_ADLEIT',
  'SOCIAL_MEDIA'
);

-- Re-add the services column with the new enum
ALTER TABLE "ClientContract" ADD COLUMN "services" "ContractService"[];

-- Also update cancellation column from TIMESTAMP to TEXT if needed
ALTER TABLE "ClientContract" ALTER COLUMN "cancellation" TYPE TEXT;
