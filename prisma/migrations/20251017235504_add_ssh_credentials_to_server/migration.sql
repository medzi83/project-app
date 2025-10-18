-- AlterTable
ALTER TABLE "public"."Server" ADD COLUMN     "sshHost" TEXT,
ADD COLUMN     "sshPassword" TEXT,
ADD COLUMN     "sshPort" INTEGER DEFAULT 22,
ADD COLUMN     "sshUsername" TEXT;
