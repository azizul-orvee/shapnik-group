import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import { pdfAmount, pdfDate, pdfText } from "@/lib/pdf-format";
import { formatMonthKey } from "@/lib/dates";
import type { MemberStatement } from "@/server/reports";

const COLS = { month: "22%", paid: "20%", note: "38%", amount: "20%" } as const;

export function MemberStatementDocument({ statement }: { statement: MemberStatement }) {
  const { organization, member, rows, total, monthsPaid, generatedAt } = statement;

  return (
    <Document
      title={`Contribution statement — ${member.name}`}
      author={organization.name}
      subject="Member contribution statement"
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.orgName}>{pdfText(organization.name)}</Text>
          <Text style={styles.docTitle}>Member Contribution Statement</Text>
        </View>
        <View style={styles.headerRule} />

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Member</Text>
            <Text style={styles.metaValue}>{pdfText(member.name)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Member ID</Text>
            <Text style={styles.metaValue}>{member.memberCode}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Phone</Text>
            <Text style={styles.metaValue}>{member.phone ?? "-"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Joined</Text>
            <Text style={styles.metaValue}>{pdfDate(member.joinDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{member.status}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Months paid</Text>
            <Text style={styles.metaValue}>{monthsPaid}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Monthly total</Text>
            <Text style={styles.metaValue}>{pdfAmount(statement.monthlyTotal)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>One-time fee</Text>
            <Text style={styles.metaValue}>{pdfAmount(statement.oneTimeTotal)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Contributions</Text>

        {rows.length === 0 ? (
          <Text style={styles.empty}>No contributions recorded yet.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tr} fixed>
              <Text style={[styles.th, { width: COLS.month }]}>For month</Text>
              <Text style={[styles.th, { width: COLS.paid }]}>Paid on</Text>
              <Text style={[styles.th, { width: COLS.note }]}>Note</Text>
              <Text style={[styles.th, styles.right, { width: COLS.amount }]}>Amount</Text>
            </View>
            {rows.map((row, index) => (
              <View key={row.id} style={index === rows.length - 1 ? styles.trLast : styles.tr} wrap={false}>
                <Text style={[styles.td, { width: COLS.month }]}>
                  {row.monthKey ? formatMonthKey(row.monthKey) : "One-time fee"}
                </Text>
                <Text style={[styles.td, { width: COLS.paid }]}>{pdfDate(row.paidOnDate)}</Text>
                <Text style={[styles.td, { width: COLS.note }]}>
                  {row.note ? pdfText(row.note) : "-"}
                </Text>
                <Text style={[styles.td, styles.right, { width: COLS.amount }]}>
                  {pdfAmount(row.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total contributed</Text>
          <Text style={styles.totalValue}>{pdfAmount(total)}</Text>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Member</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Treasurer</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>President</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated {pdfDate(generatedAt)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
