-- AlterTable
ALTER TABLE "magazine_types" ADD COLUMN     "includedSpreads" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "pricePerExtraSpread" DECIMAL(10,2);
