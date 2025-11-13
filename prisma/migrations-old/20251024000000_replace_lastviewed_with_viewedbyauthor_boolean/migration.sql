-- AlterTable: Remove lastViewedByAuthor and add viewedByAuthor
ALTER TABLE "Feedback" DROP COLUMN "lastViewedByAuthor";
ALTER TABLE "Feedback" ADD COLUMN "viewedByAuthor" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Add index for efficient unread count queries
CREATE INDEX "Feedback_authorId_viewedByAuthor_idx" ON "Feedback"("authorId", "viewedByAuthor");
