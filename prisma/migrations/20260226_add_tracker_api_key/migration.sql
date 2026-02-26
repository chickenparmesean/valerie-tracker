-- AddTrackerApiKey
-- Applied via `prisma db push` (no migration history in this project)

ALTER TABLE "User" ADD COLUMN "trackerApiKey" TEXT;
CREATE UNIQUE INDEX "User_trackerApiKey_key" ON "User"("trackerApiKey");
