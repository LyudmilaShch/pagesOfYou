-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('TOP', 'NEW', 'SALE', 'POPULAR', 'LIMITED');

-- AlterTable
ALTER TABLE "magazine_types" ADD COLUMN     "badgeText" VARCHAR(50),
ADD COLUMN     "badgeType" "BadgeType",
ADD COLUMN     "oldPrice" DECIMAL(10,2);
