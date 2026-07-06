-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_magazineStyleId_fkey";

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_magazineStyleId_fkey" FOREIGN KEY ("magazineStyleId") REFERENCES "magazine_styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
