/*
  Warnings:

  - You are about to drop the column `pricePerExtraSpread` on the `magazine_types` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "magazine_types" DROP COLUMN "pricePerExtraSpread",
ADD COLUMN     "pricePerExtraFourPages" DECIMAL(10,2);
