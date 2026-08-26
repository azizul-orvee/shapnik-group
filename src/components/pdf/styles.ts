import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  orgName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  docTitle: { fontSize: 11, marginTop: 2, color: "#4b5563" },
  headerRule: { borderBottomWidth: 1, borderBottomColor: "#111827", marginTop: 10, marginBottom: 14 },

  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  metaItem: { width: "50%", flexDirection: "row", marginBottom: 3 },
  metaLabel: { width: 90, color: "#6b7280" },
  metaValue: { flex: 1, fontFamily: "Helvetica-Bold" },

  table: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 2 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  trLast: { flexDirection: "row" },
  th: {
    backgroundColor: "#f3f4f6",
    fontFamily: "Helvetica-Bold",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  td: { paddingVertical: 5, paddingHorizontal: 6 },
  right: { textAlign: "right" },

  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#111827",
    marginTop: 8,
    paddingTop: 6,
  },
  totalLabel: { flex: 1, fontFamily: "Helvetica-Bold" },
  totalValue: { fontFamily: "Helvetica-Bold" },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  summaryStrong: { fontFamily: "Helvetica-Bold" },

  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  signatureBlock: { width: "30%", borderTopWidth: 1, borderTopColor: "#111827", paddingTop: 4 },
  signatureLabel: { fontSize: 9, color: "#4b5563", textAlign: "center" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#6b7280",
  },
  empty: { color: "#6b7280", fontStyle: "italic", paddingVertical: 8 },
});
