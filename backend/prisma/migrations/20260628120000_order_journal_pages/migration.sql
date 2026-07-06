-- Make magazineStyleId optional for canvas-based orders
ALTER TABLE "orders" ALTER COLUMN "magazineStyleId" DROP NOT NULL;

-- Link journal pages to orders (required FK)
DELETE FROM "journal_pages" WHERE "orderId" IS NULL;

ALTER TABLE "journal_pages" ALTER COLUMN "orderId" SET NOT NULL;

ALTER TABLE "journal_pages"
  ADD CONSTRAINT "journal_pages_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
