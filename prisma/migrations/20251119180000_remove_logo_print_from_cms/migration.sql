-- AlterEnum: Remove LOGO and PRINT from CMS enum
-- Note: All LOGO and PRINT projects have been migrated to Print & Design type via migration script

-- First, verify no projects are using these values (should already be migrated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProjectWebsite" WHERE cms IN ('LOGO', 'PRINT')) THEN
    RAISE EXCEPTION 'Cannot remove LOGO/PRINT from CMS enum: Projects still using these values';
  END IF;
END $$;

-- Remove the enum values
ALTER TYPE "CMS" RENAME TO "CMS_old";

CREATE TYPE "CMS" AS ENUM ('SHOPWARE', 'WORDPRESS', 'JOOMLA', 'CUSTOM', 'OTHER');

-- Drop default constraint to allow type change
ALTER TABLE "ProjectWebsite"
  ALTER COLUMN cms DROP DEFAULT;

-- Change column type
ALTER TABLE "ProjectWebsite"
  ALTER COLUMN cms TYPE "CMS" USING cms::text::"CMS";

-- Re-add default constraint
ALTER TABLE "ProjectWebsite"
  ALTER COLUMN cms SET DEFAULT 'JOOMLA'::"CMS";

DROP TYPE "CMS_old";
