-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "endMonth" DATE NOT NULL DEFAULT '2027-12-01'::date,
ADD COLUMN     "startMonth" DATE NOT NULL DEFAULT '2026-01-01'::date;

