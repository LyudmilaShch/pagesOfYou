-- Replace PageTemplate library with MagazinePage owned by MagazineType

DROP TABLE IF EXISTS "placeholder_values";
DROP TABLE IF EXISTS "journal_pages";
DROP TABLE IF EXISTS "magazine_type_page_templates";
DROP TABLE IF EXISTS "page_templates";

DROP TYPE IF EXISTS "PageOrientation";

CREATE TABLE "magazine_pages" (
    "id" TEXT NOT NULL,
    "magazineTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pageType" "PageType" NOT NULL DEFAULT 'PAGE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "previewImage" TEXT,
    "canvasData" JSONB NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "magazine_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journal_pages" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "magazinePageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pageSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_pages_pkey" PRIMARY KEY ("id")
);

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

CREATE INDEX "magazine_pages_magazineTypeId_sortOrder_idx" ON "magazine_pages"("magazineTypeId", "sortOrder");
CREATE INDEX "magazine_pages_magazineTypeId_deletedAt_idx" ON "magazine_pages"("magazineTypeId", "deletedAt");

CREATE INDEX "journal_pages_orderId_sortOrder_idx" ON "journal_pages"("orderId", "sortOrder");
CREATE INDEX "journal_pages_magazinePageId_idx" ON "journal_pages"("magazinePageId");

CREATE UNIQUE INDEX "placeholder_values_journalPageId_elementId_key" ON "placeholder_values"("journalPageId", "elementId");
CREATE INDEX "placeholder_values_journalPageId_idx" ON "placeholder_values"("journalPageId");

ALTER TABLE "magazine_pages" ADD CONSTRAINT "magazine_pages_magazineTypeId_fkey" FOREIGN KEY ("magazineTypeId") REFERENCES "magazine_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_pages" ADD CONSTRAINT "journal_pages_magazinePageId_fkey" FOREIGN KEY ("magazinePageId") REFERENCES "magazine_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "placeholder_values" ADD CONSTRAINT "placeholder_values_journalPageId_fkey" FOREIGN KEY ("journalPageId") REFERENCES "journal_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
