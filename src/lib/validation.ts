import { z } from "zod";

const monthKey = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a YYYY-MM month, e.g. 2026-08");

const amount = z.coerce
  .number({ message: "Enter an amount" })
  .positive("Amount must be greater than zero")
  .max(99_999_999, "Amount is too large")
  // Taka amounts carry at most two decimals.
  .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(0)), {
    message: "Use at most two decimal places",
  });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

/**
 * Bangladeshi NIDs are usually 10, 13 or 17 digits, but older and reissued
 * cards vary, so accept any 10–17 digit number rather than reject a real one.
 */
const NID_PATTERN = /^\d{10,17}$/;
const NID_MESSAGE = "NID must be 10–17 digits";

const nationalId = z.string().trim().regex(NID_PATTERN, NID_MESSAGE);

const phoneNumber = z
  .string()
  .trim()
  .regex(/^01\d{9}$/, "Enter an 11-digit number starting 01");

const optionalNationalId = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || NID_PATTERN.test(v), { message: NID_MESSAGE });

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^01\d{9}$/.test(v), {
    message: "Enter an 11-digit number starting 01",
  });

export const memberCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  memberId: z
    .string()
    .trim()
    .min(1, "Member ID is required")
    .max(24)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only"),
  phone: phoneNumber,
  nationalId,
  nomineeName: z.string().trim().min(2, "Nominee name is required").max(120),
  nomineeNationalId: nationalId,
  nomineePhone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^01\d{9}$/.test(v), {
      message: "Enter an 11-digit number starting 01",
    }),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const memberUpdateSchema = memberCreateSchema.partial();

const note = z
  .string()
  .trim()
  .max(240)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

/**
 * A MONTHLY payment settles one named month; a ONE_TIME payment is an
 * instalment against that year's extra fee and has no month attached.
 */
export const contributionCreateSchema = z
  .object({
    memberId: z.string().min(1, "Choose a member"),
    type: z.enum(["MONTHLY", "ONE_TIME"]).default("MONTHLY"),
    amount,
    paidForMonth: monthKey.optional().or(z.literal("")),
    paidForYear: z.coerce.number().int().min(2000).max(2100).optional(),
    paidOnDate: isoDate,
    note,
  })
  .refine((v) => v.type !== "MONTHLY" || Boolean(v.paidForMonth), {
    message: "Choose the month this payment covers",
    path: ["paidForMonth"],
  })
  .refine((v) => v.type !== "ONE_TIME" || Boolean(v.paidForYear), {
    message: "Choose the year this fee covers",
    path: ["paidForYear"],
  })
  .transform((v) => ({
    ...v,
    paidForMonth: v.type === "MONTHLY" ? (v.paidForMonth as string) : undefined,
    paidForYear: v.type === "ONE_TIME" ? v.paidForYear : undefined,
  }));

export const contributionUpdateSchema = z.object({
  amount: amount.optional(),
  paidForMonth: monthKey.optional(),
  paidForYear: z.coerce.number().int().min(2000).max(2100).optional(),
  paidOnDate: isoDate.optional(),
  note,
});

/** Treasurer logging the same amount for many members in one go. */
export const bulkContributionSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1, "Select at least one member"),
  amount,
  paidForMonth: monthKey,
  paidOnDate: isoDate,
});

/**
 * One large payment that settles several obligations at once. The server splits
 * it with `planLumpSum()`; the client previews the same split before submitting.
 */
export const lumpSumSchema = z.object({
  memberId: z.string().min(1, "Choose a member"),
  amount,
  paidForYear: z.coerce.number().int().min(2000).max(2100),
  paidOnDate: isoDate,
  /** Record a remainder too small for a whole month as a short payment. */
  allowPartialMonth: z.coerce.boolean().default(true),
  note,
});

/**
 * Recording what a member has already paid for a year in one step: the whole
 * months (and the fee) ticked as settled, plus an optional extra lump sum that
 * fills the remaining months oldest-first and then the fee. The client previews
 * the split with `planInitialSetup()`; the server recomputes it the same way.
 */
export const initialSetupSchema = z
  .object({
    paidForYear: z.coerce.number().int().min(2000).max(2100),
    tickedMonths: z.array(monthKey).default([]),
    feeTicked: z.coerce.boolean().default(false),
    boxAmount: z.coerce
      .number({ message: "Enter an amount" })
      .min(0, "Amount cannot be negative")
      .max(99_999_999, "Amount is too large")
      .default(0),
    paidOnDate: isoDate,
    note,
  })
  .refine((v) => v.tickedMonths.length > 0 || v.feeTicked || v.boxAmount > 0, {
    message: "Tick at least one month or the fee, or enter an amount",
    path: ["boxAmount"],
  });

export type InitialSetupFormInput = z.input<typeof initialSetupSchema>;
export type InitialSetupInput = z.output<typeof initialSetupSchema>;

export const transactionCreateSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  amount,
  description: z.string().trim().min(2, "Describe this entry").max(240),
  date: isoDate,
});

export const transactionUpdateSchema = transactionCreateSchema.partial();

/** Members sign in at /login with their member ID and their NID. */
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your member ID"),
  password: z.string().min(1, "Enter your NID number"),
});

/**
 * Admins sign in at /control_panel with a third factor on top of the same two:
 * a separate password only they hold.
 */
export const adminLoginSchema = loginSchema.extend({
  adminPassword: z.string().min(1, "Enter your password"),
});

/**
 * An admin editing their own details. Everything is optional so they can fill it
 * in over time, but a value that is supplied has to be valid.
 */
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  phone: optionalPhone,
  nationalId: optionalNationalId,
  nomineeName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  nomineeNationalId: optionalNationalId,
  nomineePhone: optionalPhone,
});

export const yearPlanSchema = z
  .object({
    year: z.coerce.number().int().min(2027, "Only 2027 onwards can be added").max(2100),
    monthlyAmount: amount,
    oneTimeFee: z.coerce
      .number({ message: "Enter an amount" })
      .min(0, "Amount cannot be negative")
      .max(99_999_999, "Amount is too large")
      .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(0)), {
        message: "Use at most two decimal places",
      }),
    startMonth: monthKey,
    endMonth: monthKey,
  })
  .refine((v) => v.startMonth <= v.endMonth, {
    message: "The first month must be on or before the last month",
    path: ["endMonth"],
  })
  .refine((v) => v.startMonth.startsWith(String(v.year)) && v.endMonth.startsWith(String(v.year)), {
    message: "Start and end months must fall in the same year",
    path: ["startMonth"],
  });

export const yearPlanUpdateSchema = z
  .object({
    monthlyAmount: amount.optional(),
    oneTimeFee: z.coerce
      .number({ message: "Enter an amount" })
      .min(0, "Amount cannot be negative")
      .max(99_999_999, "Amount is too large")
      .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(0)), {
        message: "Use at most two decimal places",
      })
      .optional(),
    startMonth: monthKey.optional(),
    endMonth: monthKey.optional(),
  })
  .refine((v) => !v.startMonth || !v.endMonth || v.startMonth <= v.endMonth, {
    message: "The first month must be on or before the last month",
    path: ["endMonth"],
  });

// `*Input` is what a form holds before parsing (defaults/transforms not yet
// applied); `*Values` is what the server receives after parsing.
export type MemberFormInput = z.input<typeof memberCreateSchema>;
export type MemberCreateInput = z.output<typeof memberCreateSchema>;
export type ContributionFormInput = z.input<typeof contributionCreateSchema>;
export type ContributionCreateInput = z.output<typeof contributionCreateSchema>;
export type ContributionUpdateInput = z.output<typeof contributionUpdateSchema>;
export type BulkContributionFormInput = z.input<typeof bulkContributionSchema>;
export type BulkContributionInput = z.output<typeof bulkContributionSchema>;
export type LumpSumFormInput = z.input<typeof lumpSumSchema>;
export type LumpSumInput = z.output<typeof lumpSumSchema>;
export type TransactionFormInput = z.input<typeof transactionCreateSchema>;
export type TransactionCreateInput = z.output<typeof transactionCreateSchema>;
export type LoginInput = z.output<typeof loginSchema>;
export type AdminLoginInput = z.output<typeof adminLoginSchema>;
export type ProfileFormInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdateInput = z.output<typeof profileUpdateSchema>;
export type YearPlanFormInput = z.input<typeof yearPlanSchema>;
export type YearPlanInput = z.output<typeof yearPlanSchema>;
export type YearPlanUpdateInput = z.output<typeof yearPlanUpdateSchema>;
