-- AlterTable
ALTER TABLE "uploaded_files" ADD COLUMN "guestTouchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "uploaded_files_guestTouchedAt_idx" ON "uploaded_files"("guestTouchedAt");
