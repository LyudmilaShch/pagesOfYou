-- How many unfinished journals (drafts) a guest and a signed-in user may keep at once.
-- 0 means a new journal cannot be created. A submitted or deleted draft frees a slot.
ALTER TABLE "platform_settings" ADD COLUMN "maxJournalDraftsGuest" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "maxJournalDraftsUser" INTEGER NOT NULL DEFAULT 5;
