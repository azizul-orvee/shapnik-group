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

export const memberCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  memberId: z
    .string()
    .trim()
    .min(1, "Member ID is required")
    .max(24)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only"),
  phone: z
    .string()
    .trim()
    .max(24)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  joinDate: isoDate,
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
 * instalment against the admission fee and has no month attached.
 */
export const contributionCreateSchema = z
  .object({
    memberId: z.string().min(1, "Choose a member"),
    type: z.enum(["MONTHLY", "ONE_TIME"]).default("MONTHLY"),
    amount,
    paidForMonth: monthKey.optional().or(z.literal("")),
    paidOnDate: isoDate,
    note,
  })
  .refine((v) => v.type !== "MONTHLY" || Boolean(v.paidForMonth), {
    message: "Choose the month this payment covers",
    path: ["paidForMonth"],
  })
  .transform((v) => ({
    ...v,
    paidForMonth: v.type === "MONTHLY" ? (v.paidForMonth as string) : undefined,
  }));

export const contributionUpdateSchema = z.object({
  amount: amount.optional(),
  paidForMonth: monthKey.optional(),
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

export const transactionCreateSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  amount,
  description: z.string().trim().min(2, "Describe this entry").max(240),
  date: isoDate,
});

export const transactionUpdateSchema = transactionCreateSchema.partial();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  role: z.enum(["ADMIN", "TREASURER", "COMMITTEE", "MEMBER"]),
  memberId: z.string().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
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
export type TransactionFormInput = z.input<typeof transactionCreateSchema>;
export type TransactionCreateInput = z.output<typeof transactionCreateSchema>;
export type LoginInput = z.output<typeof loginSchema>;
export type UserFormInput = z.input<typeof userCreateSchema>;
export type UserCreateInput = z.output<typeof userCreateSchema>;
