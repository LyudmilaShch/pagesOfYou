-- AlterTable
ALTER TABLE "journal_pages" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "journal_pages_orderId_deletedAt_idx" ON "journal_pages"("orderId", "deletedAt");
