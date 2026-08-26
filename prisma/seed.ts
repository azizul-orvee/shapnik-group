import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ORG_NAME = process.env.SEED_ORG_NAME ?? "Shapnik Shomobay Shomiti";
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@shomiti.local").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "shomiti1234";
const MONTHLY_AMOUNT = 6000;
const ONE_TIME_FEE = 28000;
// The society runs January 2026 through December 2027.
const START_MONTH = new Date(Date.UTC(2026, 0, 1));
const END_MONTH = new Date(Date.UTC(2027, 11, 1));

const FIRST_NAMES = [
  "Abdul Karim", "Rahima Begum", "Mizanur Rahman", "Nasrin Akter", "Shahidul Islam",
  "Fatema Khatun", "Jahangir Alam", "Salma Parvin", "Nurul Haque", "Ayesha Siddika",
  "Kamrul Hasan", "Rokeya Sultana", "Anwar Hossain", "Shirin Akhter", "Delwar Hossain",
  "Momena Khatun", "Rafiqul Islam", "Taslima Nasrin", "Bablu Mia", "Hasina Begum",
  "Sohel Rana", "Jesmin Ara", "Mahbub Alam", "Rina Khatun", "Faruk Ahmed",
  "Shefali Rani", "Aminul Islam", "Marufa Yesmin", "Habibur Rahman", "Lutfa Begum",
];

/** Every month from the society's opening up to and including today. */
function monthsSoFar(): Date[] {
  const now = new Date();
  const months: Date[] = [];
  const cursor = new Date(START_MONTH);
  while (cursor <= now && cursor <= END_MONTH) {
    months.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "seed-org" },
    update: {
      name: ORG_NAME,
      monthlyAmount: MONTHLY_AMOUNT,
      oneTimeFee: ONE_TIME_FEE,
      startMonth: START_MONTH,
      endMonth: END_MONTH,
    },
    create: {
      id: "seed-org",
      name: ORG_NAME,
      monthlyAmount: MONTHLY_AMOUNT,
      oneTimeFee: ONE_TIME_FEE,
      startMonth: START_MONTH,
      endMonth: END_MONTH,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Society Admin",
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: "ADMIN",
    },
  });

  // Everyone joined when the society opened.
  const joinBase = START_MONTH;
  const members = [];
  for (const [index, name] of FIRST_NAMES.entries()) {
    const code = `M-${String(index + 1).padStart(3, "0")}`;
    members.push(
      await prisma.member.upsert({
        where: { organizationId_memberId: { organizationId: organization.id, memberId: code } },
        update: {},
        create: {
          organizationId: organization.id,
          memberId: code,
          name,
          phone: `01${7 + (index % 3)}${String(10000000 + index * 137).slice(0, 8)}`,
          joinDate: joinBase,
          status: index >= 28 ? "INACTIVE" : "ACTIVE",
        },
      }),
    );
  }

  const months = monthsSoFar();
  // M-003 settles the whole year in January — the "paid up front" case.
  const PREPAID_INDEX = 2;
  let created = 0;
  for (const [monthIndex, month] of months.entries()) {
    const isCurrentMonth = monthIndex === months.length - 1;
    for (const [memberIndex, member] of members.entries()) {
      if (member.status === "INACTIVE") continue;
      // Handled separately below, in one January payment run.
      if (memberIndex === PREPAID_INDEX) continue;
      // Leave a couple of members unpaid this month so dues tracking has something to show.
      if (isCurrentMonth && memberIndex >= 26) continue;

      const paidOnDate = new Date(month);
      paidOnDate.setUTCDate(5 + (memberIndex % 12));

      const existing = await prisma.contribution.findUnique({
        where: { memberId_paidForMonth: { memberId: member.id, paidForMonth: month } },
        select: { id: true },
      });
      if (existing) continue;

      const contribution = await prisma.contribution.create({
        data: {
          organizationId: organization.id,
          memberId: member.id,
          type: "MONTHLY",
          amount: MONTHLY_AMOUNT,
          paidForMonth: month,
          paidOnDate,
          recordedById: admin.id,
        },
      });
      await prisma.fundTransaction.create({
        data: {
          organizationId: organization.id,
          type: "IN",
          amount: MONTHLY_AMOUNT,
          description: `Monthly contribution — ${member.name} (${member.memberId}) for ${month.toISOString().slice(0, 7)}`,
          date: paidOnDate,
          contributionId: contribution.id,
          recordedById: admin.id,
        },
      });
      created += 1;
    }
  }

  // The member who paid everything up front: all twelve months of 2026 plus the
  // fee, all settled on 5 January. Exercises advance payments end to end.
  const prepaid = members[PREPAID_INDEX];
  if (prepaid) {
    const paidOnDate = new Date(Date.UTC(2026, 0, 5));
    for (let m = 0; m < 12; m += 1) {
      const paidForMonth = new Date(Date.UTC(2026, m, 1));
      const existing = await prisma.contribution.findUnique({
        where: { memberId_paidForMonth: { memberId: prepaid.id, paidForMonth } },
        select: { id: true },
      });
      if (existing) continue;
      const contribution = await prisma.contribution.create({
        data: {
          organizationId: organization.id,
          memberId: prepaid.id,
          type: "MONTHLY",
          amount: MONTHLY_AMOUNT,
          paidForMonth,
          paidOnDate,
          note: "Full year paid in advance",
          recordedById: admin.id,
        },
      });
      await prisma.fundTransaction.create({
        data: {
          organizationId: organization.id,
          type: "IN",
          amount: MONTHLY_AMOUNT,
          description: `Monthly contribution — ${prepaid.name} (${prepaid.memberId}) for ${paidForMonth.toISOString().slice(0, 7)}`,
          date: paidOnDate,
          recordedById: admin.id,
        },
      });
      created += 1;
    }
  }

  // One-time admission fee: most members have cleared it, a few are paying it
  // off in instalments and two have not started, so the progress views have a
  // realistic spread to render.
  let oneTimeCreated = 0;
  for (const [index, member] of members.entries()) {
    if (member.status === "INACTIVE") continue;

    const already = await prisma.contribution.findFirst({
      where: { memberId: member.id, type: "ONE_TIME" },
      select: { id: true },
    });
    if (already) continue;

    // index 0-21 paid in full, 22-27 part-paid, 28+ nothing yet.
    const instalments: number[] =
      index <= 21
        ? [ONE_TIME_FEE]
        : index <= 24
          ? [ONE_TIME_FEE / 2, ONE_TIME_FEE / 4]
          : index <= 27
            ? [ONE_TIME_FEE / 4]
            : [];

    for (const [part, amount] of instalments.entries()) {
      const paidOnDate = new Date(months[Math.min(part * 3, months.length - 1)]);
      paidOnDate.setUTCDate(index === PREPAID_INDEX ? 5 : 10 + part);
      await prisma.contribution.create({
        data: {
          organizationId: organization.id,
          memberId: member.id,
          type: "ONE_TIME",
          amount,
          paidForMonth: null,
          paidOnDate,
          note: instalments.length > 1 ? `Instalment ${part + 1} of ${instalments.length}` : null,
          recordedById: admin.id,
        },
      });
      await prisma.fundTransaction.create({
        data: {
          organizationId: organization.id,
          type: "IN",
          amount,
          description: `One-time fee — ${member.name} (${member.memberId})`,
          date: paidOnDate,
          recordedById: admin.id,
        },
      });
      oneTimeCreated += 1;
    }
  }

  // A committee login and a member-facing login, so every role can be tried out.
  await prisma.user.upsert({
    where: { email: "committee@shomiti.local" },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Committee Member",
      email: "committee@shomiti.local",
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: "COMMITTEE",
    },
  });
  // Linked to the member who paid the whole year up front, so the member view
  // demonstrates advance payments out of the box.
  const memberLogin = members[PREPAID_INDEX] ?? members[0];
  await prisma.user.upsert({
    where: { email: "member@shomiti.local" },
    update: { memberId: memberLogin.id, name: memberLogin.name },
    create: {
      organizationId: organization.id,
      name: memberLogin.name,
      email: "member@shomiti.local",
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: "MEMBER",
      memberId: memberLogin.id,
    },
  });

  console.log(
    `Seeded "${organization.name}" — ${members.length} members, ${created} monthly contributions, ${oneTimeCreated} one-time fee payments.`,
  );
  console.log(
    `Rates: ${MONTHLY_AMOUNT}/month x 12 + ${ONE_TIME_FEE} one-time = ${MONTHLY_AMOUNT * 12 + ONE_TIME_FEE} per member per year.`,
  );
  console.log(
    `Window: ${START_MONTH.toISOString().slice(0, 7)} to ${END_MONTH.toISOString().slice(0, 7)}.`,
  );
  console.log(`Sign in as ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
