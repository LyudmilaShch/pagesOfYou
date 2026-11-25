-- CreateTable
CREATE TABLE "phone_upload_sessions" (
    "id" TEXT NOT NULL,
    "uploadToken" TEXT NOT NULL,
    "revokeToken" TEXT NOT NULL,
    "orderId" TEXT,
    "guestId" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "phone_upload_sessions_uploadToken_key" ON "phone_upload_sessions"("uploadToken");

-- CreateIndex
CREATE UNIQUE INDEX "phone_upload_sessions_revokeToken_key" ON "phone_upload_sessions"("revokeToken");

-- CreateIndex
CREATE INDEX "phone_upload_sessions_expiresAt_idx" ON "phone_upload_sessions"("expiresAt");
