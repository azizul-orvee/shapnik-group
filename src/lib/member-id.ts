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

/**
 * The one written form of a member ID: numeric IDs become `M-03` (never
 * `M-003`), whether typed as "3", "03", "m3" or "M-003". Non-numeric IDs (the
 * admin login, custom codes) are returned uppercased.
 *
 * IDs are stored in this form, and member sign-in looks the typed ID up in it,
 * so "13" and "M-13" reach the same member.
 */
export function formatMemberCode(memberId: string): string {
  const key = memberIdKey(memberId);
  if (!/^\d+$/.test(key)) return memberId.trim().toUpperCase();
  return `M-${key.padStart(2, "0")}`;
}
