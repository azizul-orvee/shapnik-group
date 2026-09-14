/**
 * What makes two member IDs the same member. IDs that differ only by case, an
 * "M" / "M-" prefix or leading zeros are one ID: "M-01", "m01", "01" and "1"
 * all give "1". Any other ID compares as itself, uppercased.
 *
 * Uniqueness checks must compare these keys, never the raw strings — the
 * database's unique index only sees the exact text.
 */
export function memberIdKey(memberId: string): string {
  const id = memberId.trim().toUpperCase();
  const digits = /^M?-?(\d+)$/.exec(id)?.[1];
  return digits ? digits.replace(/^0+(?=\d)/, "") : id;
}
