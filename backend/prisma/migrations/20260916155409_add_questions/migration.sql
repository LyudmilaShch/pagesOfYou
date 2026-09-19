-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'TEXTAREA', 'DATE', 'IMAGE', 'GALLERY', 'SELECT');

-- CreateEnum
CREATE TYPE "PlaceholderSource" AS ENUM ('AUTO', 'AI', 'OVERRIDDEN');

-- AlterTable
ALTER TABLE "placeholder_values" ADD COLUMN     "source" "PlaceholderSource" NOT NULL DEFAULT 'AUTO';

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "magazineTypeId" TEXT NOT NULL,
    "magazinePageId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "placeholder" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "validationRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_magazineTypeId_sortOrder_idx" ON "questions"("magazineTypeId", "sortOrder");

-- CreateIndex
CREATE INDEX "questions_magazinePageId_sortOrder_idx" ON "questions"("magazinePageId", "sortOrder");

-- CreateIndex
CREATE INDEX "questions_deletedAt_idx" ON "questions"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "questions_magazineTypeId_key_key" ON "questions"("magazineTypeId", "key");

-- CreateIndex
CREATE INDEX "question_options_questionId_sortOrder_idx" ON "question_options"("questionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_magazineTypeId_fkey" FOREIGN KEY ("magazineTypeId") REFERENCES "magazine_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_magazinePageId_fkey" FOREIGN KEY ("magazinePageId") REFERENCES "magazine_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
