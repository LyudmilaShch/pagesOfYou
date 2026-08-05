-- CreateTable
CREATE TABLE "fonts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "regularFileUrl" TEXT NOT NULL,
    "boldFileUrl" TEXT,
    "italicFileUrl" TEXT,
    "boldItalicFileUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "fonts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fonts_fontFamily_key" ON "fonts"("fontFamily");

-- CreateIndex
CREATE INDEX "fonts_isActive_sortOrder_idx" ON "fonts"("isActive", "sortOrder");
