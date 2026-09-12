/**
 * Production bootstrap — the real first run.
 *
 * Creates only what a live society cannot start without:
 *   - the organisation
 *   - the 2025 and 2026 year plans (rates and the operating window)
 *   - the admin login, from the environment
 *
 * It creates **no members and no contributions**: the admin registers the real
 * members through the app. Contrast `prisma/seed.ts`, which fills the database
 * with 30 fictional members for development.
 *
 * Safe to re-run. It never deletes members or payments; it only updates the
 * organisation, the year plans and the admin's credentials, and clears an admin
 * row whose ID has been rotated away.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { schemaFromDatabaseUrl } from "../src/lib/db-url";

const connectionString = process.env.DATABASE_URL ?? "";
const schema = schemaFromDatabaseUrl(connectionString);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined),
});

const ORG_NAME = process.env.SEED_ORG_NAME ?? "Shapnik Shomobay Shomiti";
const ADMIN_LOGIN_ID = process.env.ADMIN_LOGIN_ID;
const ADMIN_NID = process.env.ADMIN_NID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Society Admin";
const MEMBER_LIMIT = Number(process.env.MEMBER_LIMIT ?? 30);

const YEAR_PLANS = [
  {
    year: 2025,
    monthlyAmount: 5000,
    oneTimeFee: 25000,
    startMonth: new Date(Date.UTC(2025, 3, 1)),
    endMonth: new Date(Date.UTC(2025, 11, 1)),
  },
  {
    year: 2026,
    monthlyAmount: 6000,
    oneTimeFee: 28000,
    startMonth: new Date(Date.UTC(2026, 0, 1)),
    endMonth: new Date(Date.UTC(2026, 11, 1)),
  },
] as const;

function requireEnv(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `${name} is not set. Put the admin's real credentials in .env before bootstrapping.`,
    );
  }
  return value;
}

async function main() {
  const loginId = requireEnv("ADMIN_LOGIN_ID", ADMIN_LOGIN_ID);
  const nid = requireEnv("ADMIN_NID", ADMIN_NID);
  const password = requireEnv("ADMIN_PASSWORD", ADMIN_PASSWORD);

  if (!/^\d{10,17}$/.test(nid)) {
    throw new Error("ADMIN_NID must be 10–17 digits — it is the admin's second sign-in factor.");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const startMonth = YEAR_PLANS[0].startMonth;
  const endMonth = YEAR_PLANS[YEAR_PLANS.length - 1].endMonth;

  // One society per deployment today, so reuse whichever exists.
  const existingOrg = await prisma.organization.findFirst({ select: { id: true } });
  const organization = existingOrg
    ? await prisma.organization.update({
        where: { id: existingOrg.id },
        data: { name: ORG_NAME, startMonth, endMonth, memberLimit: MEMBER_LIMIT },
      })
    : await prisma.organization.create({
        data: { name: ORG_NAME, startMonth, endMonth, memberLimit: MEMBER_LIMIT },
      });

  for (const plan of YEAR_PLANS) {
    await prisma.yearPlan.upsert({
      where: { organizationId_year: { organizationId: organization.id, year: plan.year } },
      update: {
        monthlyAmount: plan.monthlyAmount,
        oneTimeFee: plan.oneTimeFee,
        startMonth: plan.startMonth,
        endMonth: plan.endMonth,
      },
      create: {
        organizationId: organization.id,
        year: plan.year,
        monthlyAmount: plan.monthlyAmount,
        oneTimeFee: plan.oneTimeFee,
        startMonth: plan.startMonth,
        endMonth: plan.endMonth,
      },
    });
  }

  const passwordHash = await bcrypt.hash(nid, 10);
  const adminPasswordHash = await bcrypt.hash(password, 10);

  const existingAdmin = await prisma.user.findFirst({
    where: { organizationId: organization.id, username: loginId },
    select: { id: true },
  });
  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { name: ADMIN_NAME, passwordHash, adminPasswordHash, role: "ADMIN", nationalId: nid },
    });
  } else {
    await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: ADMIN_NAME,
        email: null,
        username: loginId,
        passwordHash,
        adminPasswordHash,
        nationalId: nid,
        role: "ADMIN",
      },
    });
  }

  // A rotated ADMIN_LOGIN_ID must not leave the previous login usable.
  const stale = await prisma.user.deleteMany({
    where: { organizationId: organization.id, role: "ADMIN", username: { not: loginId } },
  });

  const members = await prisma.member.count({ where: { organizationId: organization.id } });
  const payments = await prisma.contribution.count({
    where: { organizationId: organization.id },
  });

  console.log(`Organisation : ${organization.name}`);
  console.log(`Window       : 2025-04 to 2026-12 (2027+ is added in the app under /years)`);
  console.log(`Member limit : ${MEMBER_LIMIT} active`);
  console.log(`Admin login  : /control_panel — ID ${loginId}, NID + password from .env`);
  if (stale.count) console.log(`Removed      : ${stale.count} superseded admin login(s)`);
  console.log(`Existing data: ${members} members, ${payments} payments (untouched)`);
  console.log("\nReady. Sign in at /control_panel and add the members.");
}

main()
  .catch((error) => {
    console.error(`\nBootstrap failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
