-- DropForeignKey
ALTER TABLE "uploaded_files" DROP CONSTRAINT "uploaded_files_userId_fkey";

-- AlterTable
ALTER TABLE "uploaded_files" ADD COLUMN     "guestId" TEXT,
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "uploaded_files_orderId_idx" ON "uploaded_files"("orderId");

-- CreateIndex
CREATE INDEX "uploaded_files_guestId_idx" ON "uploaded_files"("guestId");

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
