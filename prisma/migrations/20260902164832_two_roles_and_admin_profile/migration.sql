-- The society runs on two roles: ADMIN and MEMBER. Committee and treasurer
-- logins are removed. Admins also gain the same identity fields members give,
-- nullable so they can be filled in after first sign-in.

-- 1. Drop the logins whose roles no longer exist. Contributions and ledger rows
--    they recorded keep their history: recordedById is ON DELETE SET NULL.
DELETE FROM "User" WHERE "role" IN ('TREASURER', 'COMMITTEE');

-- 2. Narrow the enum.
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'MEMBER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- 3. Admin profile details.
ALTER TABLE "User"
  ADD COLUMN "phone"             TEXT,
  ADD COLUMN "nationalId"        TEXT,
  ADD COLUMN "nomineeName"       TEXT,
  ADD COLUMN "nomineeNationalId" TEXT,
  ADD COLUMN "nomineePhone"      TEXT;
