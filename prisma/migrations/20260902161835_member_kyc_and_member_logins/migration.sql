-- Members gain the identity details the admin records at sign-up, and the
-- society gains a cap on how many active members it may hold.
--
-- The new Member columns are NOT NULL. Existing rows are backfilled with
-- deterministic placeholders first so the migration is safe to replay; a fresh
-- deployment has no rows and skips straight past it.

-- 1. Add as nullable so existing rows survive.
ALTER TABLE "Member"
  ADD COLUMN "nationalId"        TEXT,
  ADD COLUMN "nomineeName"       TEXT,
  ADD COLUMN "nomineeNationalId" TEXT,
  ADD COLUMN "nomineePhone"      TEXT;

-- 2. Backfill. Placeholders are derived from the member code so they are stable
--    and unique; real values are entered by the admin (or written by the seed).
UPDATE "Member"
SET
  "phone"             = COALESCE("phone", '01700000000'),
  "nationalId"        = COALESCE("nationalId", LPAD(REGEXP_REPLACE("memberId", '\D', '', 'g'), 10, '19900000')),
  "nomineeName"       = COALESCE("nomineeName", 'Nominee of ' || "name"),
  "nomineeNationalId" = COALESCE("nomineeNationalId", LPAD(REGEXP_REPLACE("memberId", '\D', '', 'g'), 10, '19800000'));

-- 3. Lock them down.
ALTER TABLE "Member"
  ALTER COLUMN "phone"             SET NOT NULL,
  ALTER COLUMN "nationalId"        SET NOT NULL,
  ALTER COLUMN "nomineeName"       SET NOT NULL,
  ALTER COLUMN "nomineeNationalId" SET NOT NULL;

-- 4. Active-member cap.
ALTER TABLE "Organization" ADD COLUMN "memberLimit" INTEGER NOT NULL DEFAULT 30;

-- 5. Member logins sign in with a username (their member code) instead of an
--    email, so email becomes optional.
ALTER TABLE "User"
  ADD COLUMN "username" TEXT,
  ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "User_organizationId_username_key" ON "User"("organizationId", "username");
