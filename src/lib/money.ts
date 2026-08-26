import { Prisma } from "@/generated/prisma/client";

export type Money = Prisma.Decimal;

/** Bangladeshi Taka sign. */
export const TAKA = "৳";

export function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

/** `৳12,500.00` — always two decimals, grouped with en-IN style separators. */
export function formatTaka(value: Prisma.Decimal | number | null | undefined): string {
  const amount = toNumber(value);
  return `${TAKA}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Same as `formatTaka` but drops `.00` for whole amounts — used in compact tables. */
export function formatTakaShort(value: Prisma.Decimal | number | null | undefined): string {
  const amount = toNumber(value);
  const hasFraction = Math.round(amount * 100) % 100 !== 0;
  return `${TAKA}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
