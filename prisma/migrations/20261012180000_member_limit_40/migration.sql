-- Raise the member cap from 30 to 40. Targets stay fixed at 30 members in code.
ALTER TABLE "Organization" ALTER COLUMN "memberLimit" SET DEFAULT 40;

-- Lift societies still on the old default; leave any custom limit alone.
UPDATE "Organization" SET "memberLimit" = 40 WHERE "memberLimit" = 30;
