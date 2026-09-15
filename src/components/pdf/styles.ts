import { StyleSheet } from "@react-pdf/renderer";

/**
 * Print chrome for official PDFs. Brand teal only — never the viz palette,
 * and never colour as the sole cue (type labels sit beside any tint).
 */
export const ink = {
  text: "#1C2B2E",
  muted: "#5A6B6E",
  faint: "#8A9698",
  line: "#D5DEDF",
  wash: "#F3F7F7",
  brand: "#2F7A7C",
  brandDeep: "#1E4F52",
  brandSoft: "#E6F2F2",
  paper: "#FFFFFF",
} as const;

export const styles = StyleSheet.create({
  page: {
    paddingTop: 92,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: ink.text,
    backgroundColor: ink.paper,
  },

  letterhead: {
    position: "absolute",
    top: 28,
    left: 40,
    right: 40,
  },
  letterheadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 16,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ink.paper,
    borderWidth: 0.75,
    borderColor: ink.line,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 38,
    height: 38,
  },
  brandText: {
    flexGrow: 1,
    flexShrink: 1,
  },
  orgName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: ink.text,
    letterSpacing: 0.2,
  },
  orgTag: {
    fontSize: 8,
    color: ink.muted,
    marginTop: 2,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  docMeta: {
    alignItems: "flex-end",
    maxWidth: 180,
  },
  docKicker: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ink.brand,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  docRef: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ink.text,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  docIssued: {
    fontSize: 8,
    color: ink.muted,
    marginTop: 2,
  },
  brandBar: {
    height: 3,
    backgroundColor: ink.brand,
    marginTop: 10,
  },

  memberCard: {
    backgroundColor: ink.wash,
    borderWidth: 0.75,
    borderColor: ink.line,
    borderLeftWidth: 3,
    borderLeftColor: ink.brand,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  memberName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: ink.text,
  },
  memberId: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: ink.brandDeep,
    marginTop: 2,
    letterSpacing: 0.6,
  },
  memberFacts: {
    flexDirection: "row",
    marginTop: 8,
    gap: 18,
  },
  fact: {
    flexGrow: 1,
  },
  factLabel: {
    fontSize: 7,
    color: ink.faint,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  factValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: ink.text,
  },

  summary: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: ink.line,
    marginBottom: 16,
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRightWidth: 0.75,
    borderRightColor: ink.line,
  },
  summaryCellLast: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 7,
    color: ink.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: ink.text,
  },
  summaryHint: {
    fontSize: 7.5,
    color: ink.faint,
    marginTop: 2,
  },

  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ink.brandDeep,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
  },

  table: {
    borderWidth: 0.75,
    borderColor: ink.line,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: ink.line,
  },
  trAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: ink.line,
    backgroundColor: ink.wash,
  },
  trLast: {
    flexDirection: "row",
  },
  th: {
    backgroundColor: ink.brandDeep,
    color: ink.paper,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  td: {
    paddingVertical: 5.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
  },
  tdMuted: {
    paddingVertical: 5.5,
    paddingHorizontal: 6,
    fontSize: 8,
    color: ink.muted,
  },
  right: { textAlign: "right" },
  note: {
    fontSize: 7.5,
    color: ink.faint,
    marginTop: 1,
  },

  closing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: ink.brandDeep,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 0,
  },
  closingLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ink.paper,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  closingValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: ink.paper,
  },

  attestation: {
    marginTop: 18,
    fontSize: 8,
    color: ink.muted,
    lineHeight: 1.4,
  },
  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 36,
    gap: 16,
  },
  signatureBlock: {
    width: "30%",
    borderTopWidth: 0.75,
    borderTopColor: ink.text,
    paddingTop: 6,
  },
  signatureLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ink.text,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  signatureHint: {
    fontSize: 7,
    color: ink.faint,
    textAlign: "center",
    marginTop: 2,
  },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.75,
    borderTopColor: ink.line,
    paddingTop: 6,
    fontSize: 7.5,
    color: ink.faint,
  },

  empty: {
    color: ink.muted,
    fontFamily: "Helvetica-Oblique",
    paddingVertical: 14,
    paddingHorizontal: 8,
    textAlign: "center",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: ink.line,
  },
  summaryStrong: { fontFamily: "Helvetica-Bold" },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: ink.brandDeep,
    marginTop: 8,
    paddingTop: 6,
  },
  totalLabel: { flex: 1, fontFamily: "Helvetica-Bold" },
  totalValue: { fontFamily: "Helvetica-Bold" },
});
