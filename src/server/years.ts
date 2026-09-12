import "server-only";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/api";
import {
  dateToMonthKey,
  formatMonthKey,
  monthCount,
  monthKeyToDate,
  planForMonthKey as planForMonthKeyShared,
} from "@/lib/dates";
import type { YearPlanInput, YearPlanUpdateInput } from "@/lib/validation";

/** Years at or before this have fixed rates and cannot be edited in the app. */
export const RATES_LOCKED_THROUGH_YEAR = 2026;

export type YearPlanView = {
  year: number;
  monthlyAmount: number;
  oneTimeFee: number;
  startMonthKey: string;
  endMonthKey: string;
  monthCount: number;
  monthlyTarget: number;
  annualTarget: number;
  locked: boolean;
};

function toView(plan: {
  year: number;
  monthlyAmount: { toNumber(): number };
  oneTimeFee: { toNumber(): number };
  startMonth: Date;
  endMonth: Date;
}): YearPlanView {
  const startMonthKey = dateToMonthKey(plan.startMonth);
  const endMonthKey = dateToMonthKey(plan.endMonth);
  const months = monthCount(startMonthKey, endMonthKey);
  const monthlyAmount = plan.monthlyAmount.toNumber();
  const oneTimeFee = plan.oneTimeFee.toNumber();
  const monthlyTarget = monthlyAmount * months;
  return {
    year: plan.year,
    monthlyAmount,
    oneTimeFee,
    startMonthKey,
    endMonthKey,
    monthCount: months,
    monthlyTarget,
    annualTarget: monthlyTarget + oneTimeFee,
    locked: plan.year <= RATES_LOCKED_THROUGH_YEAR,
  };
}

export function isYearLocked(year: number) {
  return year <= RATES_LOCKED_THROUGH_YEAR;
}

export async function listYearPlans(organizationId: string): Promise<YearPlanView[]> {
  const plans = await prisma.yearPlan.findMany({
    where: { organizationId },
    orderBy: { year: "desc" },
  });
  return plans.map(toView);
}

export async function getYearPlan(
  organizationId: string,
  year: number,
): Promise<YearPlanView | null> {
  const plan = await prisma.yearPlan.findUnique({
    where: { organizationId_year: { organizationId, year } },
  });
  return plan ? toView(plan) : null;
}

export async function requireYearPlan(organizationId: string, year: number): Promise<YearPlanView> {
  const plan = await getYearPlan(organizationId, year);
  if (!plan) throw notFound(`No payment structure for ${year}`);
  return plan;
}

export function planForMonthKey(plans: YearPlanView[], monthKey: string): YearPlanView | undefined {
  return planForMonthKeyShared(plans, monthKey);
}

async function syncOrganizationWindow(organizationId: string) {
  const plans = await prisma.yearPlan.findMany({
    where: { organizationId },
    select: { startMonth: true, endMonth: true },
    orderBy: { startMonth: "asc" },
  });
  if (plans.length === 0) return;
  const startMonth = plans.reduce(
    (min, p) => (p.startMonth < min ? p.startMonth : min),
    plans[0].startMonth,
  );
  const endMonth = plans.reduce(
    (max, p) => (p.endMonth > max ? p.endMonth : max),
    plans[0].endMonth,
  );
  await prisma.organization.update({
    where: { id: organizationId },
    data: { startMonth, endMonth },
  });
}

function parseSeason(year: number, startMonthKey: string, endMonthKey: string) {
  if (!startMonthKey.startsWith(String(year)) || !endMonthKey.startsWith(String(year))) {
    throw badRequest(`Start and end months must fall in ${year}`);
  }
  if (startMonthKey > endMonthKey) {
    throw badRequest("The first month must be on or before the last month");
  }
  return {
    startMonth: monthKeyToDate(startMonthKey),
    endMonth: monthKeyToDate(endMonthKey),
  };
}

export async function createYearPlan(organizationId: string, input: YearPlanInput) {
  if (isYearLocked(input.year)) {
    throw badRequest(`${input.year} is a locked historical year and cannot be added here`);
  }

  const existing = await prisma.yearPlan.findMany({
    where: { organizationId },
    select: { year: true },
    orderBy: { year: "desc" },
  });
  const latest = existing[0]?.year;
  if (existing.some((p) => p.year === input.year)) {
    throw conflict(`${input.year} already has a payment structure`);
  }
  if (latest !== undefined && input.year !== latest + 1) {
    throw badRequest(`Add ${latest + 1} next — years have to stay consecutive`);
  }

  const season = parseSeason(input.year, input.startMonth, input.endMonth);

  const plan = await prisma.yearPlan.create({
    data: {
      organizationId,
      year: input.year,
      monthlyAmount: input.monthlyAmount,
      oneTimeFee: input.oneTimeFee,
      startMonth: season.startMonth,
      endMonth: season.endMonth,
    },
  });
  await syncOrganizationWindow(organizationId);
  return toView(plan);
}

export async function updateYearPlan(
  organizationId: string,
  year: number,
  input: YearPlanUpdateInput,
) {
  const existing = await prisma.yearPlan.findUnique({
    where: { organizationId_year: { organizationId, year } },
  });
  if (!existing) throw notFound(`No payment structure for ${year}`);
  if (isYearLocked(year)) {
    throw badRequest(`${year} is locked. Rates for 2025 and 2026 cannot be changed.`);
  }

  const startMonthKey = input.startMonth ?? dateToMonthKey(existing.startMonth);
  const endMonthKey = input.endMonth ?? dateToMonthKey(existing.endMonth);
  const season = parseSeason(year, startMonthKey, endMonthKey);

  const plan = await prisma.yearPlan.update({
    where: { organizationId_year: { organizationId, year } },
    data: {
      ...(input.monthlyAmount !== undefined ? { monthlyAmount: input.monthlyAmount } : {}),
      ...(input.oneTimeFee !== undefined ? { oneTimeFee: input.oneTimeFee } : {}),
      startMonth: season.startMonth,
      endMonth: season.endMonth,
    },
  });
  await syncOrganizationWindow(organizationId);
  return toView(plan);
}

export async function deleteYearPlan(organizationId: string, year: number) {
  const existing = await prisma.yearPlan.findUnique({
    where: { organizationId_year: { organizationId, year } },
  });
  if (!existing) throw notFound(`No payment structure for ${year}`);
  if (isYearLocked(year)) {
    throw badRequest(`${year} is locked and cannot be removed`);
  }

  const latest = await prisma.yearPlan.findFirst({
    where: { organizationId },
    orderBy: { year: "desc" },
    select: { year: true },
  });
  if (latest && latest.year !== year) {
    throw badRequest(`Remove ${latest.year} first — years have to stay consecutive`);
  }

  const payments = await prisma.contribution.count({
    where: { organizationId, paidForYear: year },
  });
  if (payments > 0) {
    throw conflict(
      `${year} already has ${payments} payment${payments === 1 ? "" : "s"} recorded. Clear those first.`,
    );
  }

  await prisma.yearPlan.delete({
    where: { organizationId_year: { organizationId, year } },
  });
  await syncOrganizationWindow(organizationId);
}

/** Rejects a month that no year plan covers (e.g. Jan–Mar 2025). */
export async function assertMonthCovered(organizationId: string, monthKey: string) {
  const plans = await listYearPlans(organizationId);
  const plan = planForMonthKey(plans, monthKey);
  if (!plan) {
    const window = plans.at(-1);
    const latest = plans[0];
    throw badRequest(
      window && latest
        ? `The society runs from ${formatMonthKey(window.startMonthKey)} to ${formatMonthKey(latest.endMonthKey)}`
        : "No payment years have been set up yet",
    );
  }
  return plan;
}
