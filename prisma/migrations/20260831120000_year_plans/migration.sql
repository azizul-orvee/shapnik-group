-- Per-year rates (monthly + extra fee) and which year a payment counts toward.

CREATE TABLE "YearPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "oneTimeFee" DECIMAL(12,2) NOT NULL,
    "startMonth" DATE NOT NULL,
    "endMonth" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YearPlan_organizationId_year_key" ON "YearPlan"("organizationId", "year");
CREATE INDEX "YearPlan_organizationId_idx" ON "YearPlan"("organizationId");

ALTER TABLE "YearPlan" ADD CONSTRAINT "YearPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill known years from each organisation's current rates, plus 2025.
INSERT INTO "YearPlan" ("id", "organizationId", "year", "monthlyAmount", "oneTimeFee", "startMonth", "endMonth", "createdAt", "updatedAt")
SELECT
    concat('yp-', "id", '-2025'),
    "id",
    2025,
    5000,
    25000,
    DATE '2025-04-01',
    DATE '2025-12-01',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization";

INSERT INTO "YearPlan" ("id", "organizationId", "year", "monthlyAmount", "oneTimeFee", "startMonth", "endMonth", "createdAt", "updatedAt")
SELECT
    concat('yp-', "id", '-2026'),
    "id",
    2026,
    "monthlyAmount",
    "oneTimeFee",
    DATE '2026-01-01',
    DATE '2026-12-01',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization";

INSERT INTO "YearPlan" ("id", "organizationId", "year", "monthlyAmount", "oneTimeFee", "startMonth", "endMonth", "createdAt", "updatedAt")
SELECT
    concat('yp-', "id", '-2027'),
    "id",
    2027,
    "monthlyAmount",
    "oneTimeFee",
    DATE '2027-01-01',
    DATE '2027-12-01',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization";

UPDATE "Organization"
SET "startMonth" = DATE '2025-04-01',
    "endMonth" = DATE '2027-12-01';

ALTER TABLE "Contribution" ADD COLUMN "paidForYear" INTEGER;

UPDATE "Contribution"
SET "paidForYear" = EXTRACT(YEAR FROM "paidForMonth")::INTEGER
WHERE "type" = 'MONTHLY';

UPDATE "Contribution"
SET "paidForYear" = EXTRACT(YEAR FROM "paidOnDate")::INTEGER
WHERE "type" = 'ONE_TIME';

ALTER TABLE "Contribution" ALTER COLUMN "paidForYear" SET NOT NULL;

CREATE INDEX "Contribution_organizationId_paidForYear_idx" ON "Contribution"("organizationId", "paidForYear");

ALTER TABLE "Organization" DROP COLUMN "monthlyAmount";
ALTER TABLE "Organization" DROP COLUMN "oneTimeFee";
