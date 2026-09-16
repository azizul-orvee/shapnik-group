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

const ORG_NAME = process.env.SEED_ORG_NAME ?? "Shapnik Group";
const ADMIN_LOGIN_ID = process.env.ADMIN_LOGIN_ID ?? "1";
const ADMIN_NID = process.env.ADMIN_NID ?? "123456789876";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Society Admin";

const JOIN_DATE = new Date(Date.UTC(2025, 3, 1));
const WINDOW_END = new Date(Date.UTC(2026, 11, 1));

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

const FIRST_NAMES = [
  "Abdul Karim", "Rahima Begum", "Mizanur Rahman", "Nasrin Akter", "Shahidul Islam",
  "Fatema Khatun", "Jahangir Alam", "Salma Parvin", "Nurul Haque", "Ayesha Siddika",
  "Kamrul Hasan", "Rokeya Sultana", "Anwar Hossain", "Shirin Akhter", "Delwar Hossain",
  "Momena Khatun", "Rafiqul Islam", "Taslima Nasrin", "Bablu Mia", "Hasina Begum",
  "Sohel Rana", "Jesmin Ara", "Mahbub Alam", "Rina Khatun", "Faruk Ahmed",
  "Shefali Rani", "Aminul Islam", "Marufa Yesmin", "Habibur Rahman", "Lutfa Begum",
];

function monthsFromTo(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "seed-org" },
    update: { name: ORG_NAME, startMonth: JOIN_DATE, endMonth: WINDOW_END, memberLimit: 30 },
    create: {
      id: "seed-org",
      name: ORG_NAME,
      startMonth: JOIN_DATE,
      endMonth: WINDOW_END,
      memberLimit: 30,
    },
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

  // The admin signs in at /control_panel with three factors: ID, NID, password.
  const adminHash = await bcrypt.hash(ADMIN_NID, 10);
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existingAdmin = await prisma.user.findFirst({
    where: { organizationId: organization.id, username: ADMIN_LOGIN_ID },
    select: { id: true },
  });
  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          name: ADMIN_NAME,
          passwordHash: adminHash,
          adminPasswordHash,
          role: "ADMIN",
          nationalId: ADMIN_NID,
        },
      })
    : await prisma.user.create({
        data: {
          organizationId: organization.id,
          name: ADMIN_NAME,
          email: null,
          username: ADMIN_LOGIN_ID,
          passwordHash: adminHash,
          adminPasswordHash,
          nationalId: ADMIN_NID,
          role: "ADMIN",
        },
      });

  type SeedMember = {
    id: string;
    name: string;
    memberId: string;
    nationalId: string;
    status: "ACTIVE" | "INACTIVE";
  };
  const members: SeedMember[] = [];
  for (const [index, name] of FIRST_NAMES.entries()) {
    const code = `M-${String(index + 1).padStart(3, "0")}`;
    // Deterministic stand-ins so the sample data is usable; real NIDs come from
    // whatever the admin types in.
    const nationalId = `1990${String(100000 + index * 7).padStart(6, "0")}`;
    const details = {
      name,
      phone: `01${7 + (index % 3)}${String(10000000 + index * 137).slice(0, 8)}`,
      nationalId,
      nomineeName: `${name.split(" ")[0]} Nominee`,
      nomineeNationalId: `1980${String(200000 + index * 7).padStart(6, "0")}`,
      nomineePhone: index % 3 === 0 ? null : `019${String(20000000 + index * 311).slice(0, 8)}`,
      joinDate: JOIN_DATE,
      // The society runs at its full complement of 30.
      status: "ACTIVE" as const,
    };
    members.push(
      await prisma.member.upsert({
        where: { organizationId_memberId: { organizationId: organization.id, memberId: code } },
        update: details,
        create: { organizationId: organization.id, memberId: code, ...details },
      }),
    );
  }

  // Every member signs in with their member ID and their NID.
  for (const member of members) {
    const passwordHash = await bcrypt.hash(member.nationalId, 10);
    const existing = await prisma.user.findFirst({
      where: { organizationId: organization.id, username: member.memberId },
      select: { id: true },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: member.name, passwordHash, memberId: member.id, role: "MEMBER" },
      });
      continue;
    }
    await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: member.name,
        email: null,
        username: member.memberId,
        passwordHash,
        role: "MEMBER",
        memberId: member.id,
      },
    });
  }

  const PREPAID_INDEX = 2;
  let created = 0;

  async function ensureMonthly(
    member: (typeof members)[number],
    paidForMonth: Date,
    amount: number,
    paidOnDate: Date,
    note?: string,
  ) {
    const existing = await prisma.contribution.findUnique({
      where: { memberId_paidForMonth: { memberId: member.id, paidForMonth } },
      select: { id: true },
    });
    if (existing) return;
    const contribution = await prisma.contribution.create({
      data: {
        organizationId: organization.id,
        memberId: member.id,
        type: "MONTHLY",
        amount,
        paidForYear: paidForMonth.getUTCFullYear(),
        paidForMonth,
        paidOnDate,
        note: note ?? null,
        recordedById: admin.id,
      },
    });
    await prisma.fundTransaction.create({
      data: {
        organizationId: organization.id,
        type: "IN",
        amount,
        description: `Monthly contribution — ${member.name} (${member.memberId}) for ${paidForMonth.toISOString().slice(0, 7)}`,
        date: paidOnDate,
        contributionId: contribution.id,
        recordedById: admin.id,
      },
    });
    created += 1;
  }

  async function ensureOneTime(
    member: (typeof members)[number],
    year: number,
    instalments: number[],
    firstDate: Date,
  ) {
    const already = await prisma.contribution.findFirst({
      where: { memberId: member.id, type: "ONE_TIME", paidForYear: year },
      select: { id: true },
    });
    if (already) return 0;
    let count = 0;
    for (const [part, amount] of instalments.entries()) {
      const paidOnDate = new Date(firstDate);
      paidOnDate.setUTCMonth(firstDate.getUTCMonth() + part * 3);
      paidOnDate.setUTCDate(10 + part);
      // Contribution and its cash-book row are created together and linked, the
      // same invariant the app enforces: every IN row carries its contributionId.
      await prisma.$transaction(async (tx) => {
        const contribution = await tx.contribution.create({
          data: {
            organizationId: organization.id,
            memberId: member.id,
            type: "ONE_TIME",
            amount,
            paidForYear: year,
            paidForMonth: null,
            paidOnDate,
            note: instalments.length > 1 ? `Instalment ${part + 1} of ${instalments.length}` : null,
            recordedById: admin.id,
          },
        });
        await tx.fundTransaction.create({
          data: {
            organizationId: organization.id,
            type: "IN",
            amount,
            description: `One-time fee ${year} — ${member.name} (${member.memberId})`,
            date: paidOnDate,
            contributionId: contribution.id,
            recordedById: admin.id,
          },
        });
      });
      count += 1;
    }
    return count;
  }

  // 2025: everyone paid April–December at 5,000 plus the 25,000 fee.
  const months2025 = monthsFromTo(YEAR_PLANS[0].startMonth, YEAR_PLANS[0].endMonth);
  for (const month of months2025) {
    for (const member of members) {
      if (member.status === "INACTIVE") continue;
      const paidOnDate = new Date(month);
      paidOnDate.setUTCDate(5);
      await ensureMonthly(member, month, YEAR_PLANS[0].monthlyAmount, paidOnDate);
    }
  }

  let oneTimeCreated = 0;
  for (const member of members) {
    if (member.status === "INACTIVE") continue;
    oneTimeCreated += await ensureOneTime(
      member,
      2025,
      [YEAR_PLANS[0].oneTimeFee],
      new Date(Date.UTC(2025, 3, 10)),
    );
  }

  // 2026: monthly from January through today, with a couple left unpaid this month.
  const now = new Date();
  const months2026 = monthsFromTo(
    YEAR_PLANS[1].startMonth,
    now < YEAR_PLANS[1].endMonth ? now : YEAR_PLANS[1].endMonth,
  ).filter((m) => m.getUTCFullYear() === 2026);

  for (const [monthIndex, month] of months2026.entries()) {
    const isCurrentMonth = monthIndex === months2026.length - 1;
    for (const [memberIndex, member] of members.entries()) {
      if (member.status === "INACTIVE") continue;
      if (memberIndex === PREPAID_INDEX) continue;
      if (isCurrentMonth && memberIndex >= 28) continue;
      const paidOnDate = new Date(month);
      paidOnDate.setUTCDate(5 + (memberIndex % 12));
      await ensureMonthly(member, month, YEAR_PLANS[1].monthlyAmount, paidOnDate);
    }
  }

  const prepaid = members[PREPAID_INDEX];
  if (prepaid) {
    const paidOnDate = new Date(Date.UTC(2026, 0, 5));
    for (let m = 0; m < 12; m += 1) {
      await ensureMonthly(
        prepaid,
        new Date(Date.UTC(2026, m, 1)),
        YEAR_PLANS[1].monthlyAmount,
        paidOnDate,
        "Full year paid in advance",
      );
    }
  }

  // 2026 extra fee: most cleared, a few on instalments, two not started.
  for (const [index, member] of members.entries()) {
    if (member.status === "INACTIVE") continue;
    const fee = YEAR_PLANS[1].oneTimeFee;
    const instalments: number[] =
      index <= 23 ? [fee] : index <= 26 ? [fee / 2, fee / 4] : index <= 29 ? [fee / 4] : [];
    if (instalments.length === 0) continue;
    oneTimeCreated += await ensureOneTime(
      member,
      2026,
      instalments,
      index === PREPAID_INDEX ? new Date(Date.UTC(2026, 0, 5)) : new Date(Date.UTC(2026, 0, 10)),
    );
  }

  // Rotating ADMIN_LOGIN_ID leaves the previous admin row behind; drop it so a
  // superseded credential cannot linger. Recorded history survives because
  // Contribution.recordedById is ON DELETE SET NULL.
  const staleAdmins = await prisma.user.deleteMany({
    where: {
      organizationId: organization.id,
      role: "ADMIN",
      username: { not: ADMIN_LOGIN_ID },
    },
  });
  if (staleAdmins.count) {
    console.log(`Removed ${staleAdmins.count} superseded admin login(s).`);
  }

  // Committee and treasurer logins were removed; clear any that linger.
  await prisma.user.deleteMany({
    where: { organizationId: organization.id, email: { not: null }, username: null },
  });
  // Reconcile the cash book. The invariant is one IN row per contribution and
  // nothing else, so rebuild any row that has drifted — earlier hand-edits to
  // sample data can leave orphans on both sides.
  const orphanLedger = await prisma.fundTransaction.deleteMany({
    where: { organizationId: organization.id, contributionId: null },
  });
  const unledgered = await prisma.contribution.findMany({
    where: { organizationId: organization.id, transaction: { is: null } },
    include: { member: { select: { name: true, memberId: true } } },
  });
  for (const c of unledgered) {
    await prisma.fundTransaction.create({
      data: {
        organizationId: organization.id,
        type: "IN",
        amount: c.amount,
        description:
          c.type === "ONE_TIME"
            ? `One-time fee — ${c.member.name} (${c.member.memberId})`
            : `Monthly contribution — ${c.member.name} (${c.member.memberId}) for ${c.paidForMonth?.toISOString().slice(0, 7)}`,
        date: c.paidOnDate,
        contributionId: c.id,
        recordedById: admin.id,
      },
    });
  }
  if (orphanLedger.count || unledgered.length) {
    console.log(
      `Cash book reconciled — removed ${orphanLedger.count} orphan rows, added ${unledgered.length} missing.`,
    );
  }

  // Members no longer use email logins; drop the old demo account if present.
  await prisma.user.deleteMany({ where: { email: "member@shomiti.local" } });

  console.log(
    `Seeded "${organization.name}" — ${members.length} members, ${created} monthly contributions, ${oneTimeCreated} one-time fee payments.`,
  );
  console.log("2025: 5,000 x 9 + 25,000 = 70,000. 2026: 6,000 x 12 + 28,000 = 100,000.");
  const demo = members[PREPAID_INDEX] ?? members[0];
  console.log(
    `Admin sign-in at /control_panel: ID ${ADMIN_LOGIN_ID}, NID ${ADMIN_NID}, plus the password from ADMIN_PASSWORD.`,
  );
  console.log(
    `Member sign-in: ${demo.memberId} / ${demo.nationalId} (${demo.name}, paid 2026 up front)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
