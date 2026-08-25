-- CreateTable
CREATE TABLE "custom_photo_masks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_photo_masks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_photo_masks_isActive_sortOrder_idx" ON "custom_photo_masks"("isActive", "sortOrder");
