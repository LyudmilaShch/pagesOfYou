-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "aiDailyLimitGuest" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "aiDailyLimitUser" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "ai_usage_counters" (
    "id" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_counters_day_idx" ON "ai_usage_counters"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_counters_subjectKey_day_key" ON "ai_usage_counters"("subjectKey", "day");
