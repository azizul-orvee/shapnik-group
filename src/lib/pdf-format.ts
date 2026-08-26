/**
 * The standard PDF fonts have no glyph for ৳, so printed documents use the
 * ISO currency code instead. On-screen we keep the Taka sign.
 */
export function pdfAmount(value: number): string {
  return `BDT ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The standard PDF fonts (WinAnsi) have no glyphs for typographic dashes and
 * quotes, which silently vanish. Fold them down to ASCII before rendering.
 */
export function pdfText(value: string): string {
  return value
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...");
}

export function pdfDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
