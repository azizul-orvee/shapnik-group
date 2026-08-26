-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('MONTHLY', 'ONE_TIME');

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "type" "ContributionType" NOT NULL DEFAULT 'MONTHLY',
ALTER COLUMN "paidForMonth" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "monthlyAmount" DECIMAL(12,2) NOT NULL DEFAULT 6000,
ADD COLUMN     "oneTimeFee" DECIMAL(12,2) NOT NULL DEFAULT 28000;

-- CreateIndex
CREATE INDEX "Contribution_organizationId_type_idx" ON "Contribution"("organizationId", "type");

