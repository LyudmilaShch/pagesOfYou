-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('COVER', 'PAGE', 'SPREAD', 'BACK_COVER');

-- CreateEnum
CREATE TYPE "PageOrientation" AS ENUM ('PORTRAIT', 'LANDSCAPE');

-- CreateEnum
CREATE TYPE "PlaceholderValueType" AS ENUM ('TEXT', 'PHOTO', 'DATE');

-- CreateTable
CREATE TABLE "page_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "previewImage" TEXT,
    "thumbnail" TEXT,
    "pageType" "PageType" NOT NULL DEFAULT 'PAGE',
    "orientation" "PageOrientation" NOT NULL DEFAULT 'PORTRAIT',
    "width" INTEGER NOT NULL DEFAULT 595,
    "height" INTEGER NOT NULL DEFAULT 842,
    "canvasData" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "page_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magazine_type_page_templates" (
    "id" TEXT NOT NULL,
    "magazineTypeId" TEXT NOT NULL,
    "pageTemplateId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "magazine_type_page_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_pages" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "pageTemplateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "templateSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placeholder_values" (
    "id" TEXT NOT NULL,
    "journalPageId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "valueType" "PlaceholderValueType" NOT NULL,
    "textValue" TEXT,
    "jsonValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placeholder_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_templates_slug_key" ON "page_templates"("slug");

-- CreateIndex
CREATE INDEX "page_templates_isActive_sortOrder_idx" ON "page_templates"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "page_templates_pageType_isActive_idx" ON "page_templates"("pageType", "isActive");

-- CreateIndex
CREATE INDEX "page_templates_deletedAt_idx" ON "page_templates"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "magazine_type_page_templates_magazineTypeId_pageTemplateId_key" ON "magazine_type_page_templates"("magazineTypeId", "pageTemplateId");

-- CreateIndex
CREATE INDEX "magazine_type_page_templates_magazineTypeId_sortOrder_idx" ON "magazine_type_page_templates"("magazineTypeId", "sortOrder");

-- CreateIndex
CREATE INDEX "journal_pages_orderId_sortOrder_idx" ON "journal_pages"("orderId", "sortOrder");

-- CreateIndex
CREATE INDEX "journal_pages_pageTemplateId_idx" ON "journal_pages"("pageTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "placeholder_values_journalPageId_elementId_key" ON "placeholder_values"("journalPageId", "elementId");

-- CreateIndex
CREATE INDEX "placeholder_values_journalPageId_idx" ON "placeholder_values"("journalPageId");

-- AddForeignKey
ALTER TABLE "magazine_type_page_templates" ADD CONSTRAINT "magazine_type_page_templates_magazineTypeId_fkey" FOREIGN KEY ("magazineTypeId") REFERENCES "magazine_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magazine_type_page_templates" ADD CONSTRAINT "magazine_type_page_templates_pageTemplateId_fkey" FOREIGN KEY ("pageTemplateId") REFERENCES "page_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_pages" ADD CONSTRAINT "journal_pages_pageTemplateId_fkey" FOREIGN KEY ("pageTemplateId") REFERENCES "page_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placeholder_values" ADD CONSTRAINT "placeholder_values_journalPageId_fkey" FOREIGN KEY ("journalPageId") REFERENCES "journal_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
