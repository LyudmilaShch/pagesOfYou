-- Split journal pricing into a PDF layout and a print run, plus per-spread extras.
ALTER TABLE "magazine_types" ADD COLUMN "layoutPrice" DECIMAL(10,2);
ALTER TABLE "magazine_types" ADD COLUMN "printPrice" DECIMAL(10,2);
ALTER TABLE "magazine_types" ADD COLUMN "layoutPricePerExtraSpread" DECIMAL(10,2);
ALTER TABLE "magazine_types" ADD COLUMN "printPricePerExtraSpread" DECIMAL(10,2);

-- Existing single price becomes the PDF layout so the constructor header still has a number.
UPDATE "magazine_types"
SET "layoutPrice" = "basePrice"
WHERE "layoutPrice" IS NULL AND "basePrice" IS NOT NULL;

CREATE TYPE "OrderFulfillment" AS ENUM ('LAYOUT', 'PRINT');

ALTER TABLE "orders" ADD COLUMN "fulfillment" "OrderFulfillment";
