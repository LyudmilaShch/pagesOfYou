-- CreateEnum
CREATE TYPE "JournalSpreadLayout" AS ENUM ('SPREAD', 'SPLIT_PAGES');

-- AlterTable
ALTER TABLE "journal_pages" ADD COLUMN "slotType" "PageType" NOT NULL DEFAULT 'SPREAD';
ALTER TABLE "journal_pages" ADD COLUMN "layoutMode" "JournalSpreadLayout";
ALTER TABLE "journal_pages" ADD COLUMN "rightMagazinePageId" TEXT;

-- CreateIndex
CREATE INDEX "journal_pages_rightMagazinePageId_idx" ON "journal_pages"("rightMagazinePageId");

-- AddForeignKey
ALTER TABLE "journal_pages" ADD CONSTRAINT "journal_pages_rightMagazinePageId_fkey" FOREIGN KEY ("rightMagazinePageId") REFERENCES "magazine_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill slotType for existing journal pages (cover / spreads / back cover)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "orderId" ORDER BY "sortOrder" ASC) AS rn,
    COUNT(*) OVER (PARTITION BY "orderId") AS cnt
  FROM "journal_pages"
)
UPDATE "journal_pages" AS jp
SET "slotType" = CASE
  WHEN r.rn = 1 THEN 'COVER'::"PageType"
  WHEN r.rn = r.cnt THEN 'BACK_COVER'::"PageType"
  ELSE 'SPREAD'::"PageType"
END
FROM ranked AS r
WHERE jp.id = r.id;
