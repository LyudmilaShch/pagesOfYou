-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_magazinePageId_fkey";

-- DropIndex
DROP INDEX "questions_magazinePageId_sortOrder_idx";

-- AlterTable
ALTER TABLE "questions" DROP COLUMN "magazinePageId";
