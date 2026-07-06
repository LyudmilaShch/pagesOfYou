-- CreateTable
CREATE TABLE "magazine_default_spreads" (
    "id" TEXT NOT NULL,
    "magazineTypeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "layoutMode" "JournalSpreadLayout" NOT NULL DEFAULT 'SPREAD',
    "magazinePageId" TEXT NOT NULL,
    "rightMagazinePageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "magazine_default_spreads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "magazine_default_spreads_magazineTypeId_idx" ON "magazine_default_spreads"("magazineTypeId");

-- CreateIndex
CREATE INDEX "magazine_default_spreads_magazinePageId_idx" ON "magazine_default_spreads"("magazinePageId");

-- CreateIndex
CREATE INDEX "magazine_default_spreads_rightMagazinePageId_idx" ON "magazine_default_spreads"("rightMagazinePageId");

-- CreateIndex
CREATE UNIQUE INDEX "magazine_default_spreads_magazineTypeId_sortOrder_key" ON "magazine_default_spreads"("magazineTypeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "magazine_default_spreads" ADD CONSTRAINT "magazine_default_spreads_magazineTypeId_fkey" FOREIGN KEY ("magazineTypeId") REFERENCES "magazine_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magazine_default_spreads" ADD CONSTRAINT "magazine_default_spreads_magazinePageId_fkey" FOREIGN KEY ("magazinePageId") REFERENCES "magazine_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magazine_default_spreads" ADD CONSTRAINT "magazine_default_spreads_rightMagazinePageId_fkey" FOREIGN KEY ("rightMagazinePageId") REFERENCES "magazine_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
