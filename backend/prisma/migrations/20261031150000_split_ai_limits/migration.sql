-- The guest limit becomes the guest's hidden cap on first texts; the user limit now only covers
-- regenerations. Rows still on the old defaults move to the new ones, admin-set values stay.
ALTER TABLE "platform_settings" RENAME COLUMN "aiDailyLimitGuest" TO "aiDailyFillCapGuest";
ALTER TABLE "platform_settings" ALTER COLUMN "aiDailyFillCapGuest" SET DEFAULT 150;
UPDATE "platform_settings" SET "aiDailyFillCapGuest" = 150 WHERE "aiDailyFillCapGuest" = 40;

ALTER TABLE "platform_settings" ALTER COLUMN "aiDailyLimitUser" SET DEFAULT 30;
UPDATE "platform_settings" SET "aiDailyLimitUser" = 30 WHERE "aiDailyLimitUser" = 100;

ALTER TABLE "platform_settings" ADD COLUMN "aiDailyFillCapUser" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN "aiGuestAutoUpdatesPerText" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "placeholder_values" ADD COLUMN "aiSourceHash" TEXT;
