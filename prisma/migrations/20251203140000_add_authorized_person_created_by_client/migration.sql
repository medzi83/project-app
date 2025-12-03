-- Add createdByClient field to AuthorizedPerson to track if person was added by client
ALTER TABLE "AuthorizedPerson" ADD COLUMN "createdByClient" BOOLEAN NOT NULL DEFAULT false;
