-- AlterTable
-- SERIAL creates the backing sequence, sets the column default to nextval(), and backfills every
-- existing row with a sequential value as part of the ALTER TABLE itself.
ALTER TABLE "users" ADD COLUMN "userNumber" SERIAL;

-- CreateIndex
CREATE UNIQUE INDEX "users_userNumber_key" ON "users"("userNumber");
