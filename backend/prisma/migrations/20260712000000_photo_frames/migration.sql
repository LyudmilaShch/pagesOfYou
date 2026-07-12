-- CreateTable
CREATE TABLE "photo_frames" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "naturalWidth" INTEGER NOT NULL,
    "naturalHeight" INTEGER NOT NULL,
    "sliceTop" INTEGER NOT NULL,
    "sliceRight" INTEGER NOT NULL,
    "sliceBottom" INTEGER NOT NULL,
    "sliceLeft" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "photo_frames_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photo_frames_isActive_sortOrder_idx" ON "photo_frames"("isActive", "sortOrder");
