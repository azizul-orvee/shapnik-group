import { Document, Page, Text, View } from "@react-pdf/renderer";
import { PDF_BRAND_NAME, PdfFooter, PdfLetterhead } from "./letterhead";
import { styles } from "./styles";
import { pdfAmount, pdfDate, pdfIssuedOn, pdfText } from "@/lib/pdf-format";
import { formatMonthKey } from "@/lib/dates";
import { formatMemberCode } from "@/lib/member-id";
import type { MemberStatement } from "@/server/reports";

const COLS = {
  particulars: "40%",
  type: "20%",
  amount: "20%",
  balance: "20%",
} as const;

function particulars(row: MemberStatement["rows"][number]): string {
  if (row.monthKey) return formatMonthKey(row.monthKey);
  return `One time fee ${row.paidForYear}`;
}

function typeLabel(type: MemberStatement["rows"][number]["type"]): string {
  return type === "ONE_TIME" ? "One time fee" : "Monthly";
}

export function MemberStatementDocument({ statement }: { statement: MemberStatement }) {
  const { member, rows, total, generatedAt } = statement;
  const issuedOn = pdfIssuedOn(generatedAt);
  const memberCode = formatMemberCode(member.memberCode);
  const ledger = rows.map((row, index) => ({
    ...row,
    balance: rows.slice(0, index + 1).reduce((sum, item) => sum + item.amount, 0),
  }));

  return (
    <Document
      title={`Contribution statement - ${member.name}`}
      author={PDF_BRAND_NAME}
      subject="Member contribution statement"
      creator={PDF_BRAND_NAME}
    >
      <Page size="A4" style={styles.page}>
        <PdfLetterhead documentTitle="Contribution statement" issuedOn={issuedOn} />

        <View style={styles.memberCard}>
          <Text style={styles.memberName}>{pdfText(member.name)}</Text>
          <Text style={styles.memberId}>Member {memberCode}</Text>
          <View style={styles.memberFacts}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>Member since</Text>
              <Text style={styles.factValue}>{pdfDate(member.joinDate)}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>Phone</Text>
              <Text style={styles.factValue}>{member.phone ?? "-"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryCellLast}>
            <Text style={styles.summaryLabel}>Lifetime contributions</Text>
            <Text style={styles.summaryValue}>{pdfAmount(total)}</Text>
            <Text style={styles.summaryHint}>All years combined</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Account activity</Text>

        {ledger.length === 0 ? (
          <Text style={styles.empty}>No contributions recorded yet.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tr} fixed>
              <Text style={[styles.th, { width: COLS.particulars }]}>Particulars</Text>
              <Text style={[styles.th, { width: COLS.type }]}>Type</Text>
              <Text style={[styles.th, styles.right, { width: COLS.amount }]}>Amount</Text>
              <Text style={[styles.th, styles.right, { width: COLS.balance }]}>Balance</Text>
            </View>
            {ledger.map((row, index) => {
              const last = index === ledger.length - 1;
              const alt = index % 2 === 1;
              const rowStyle = last ? styles.trLast : alt ? styles.trAlt : styles.tr;
              return (
                <View key={row.id} style={rowStyle} wrap={false}>
                  <Text style={[styles.td, { width: COLS.particulars }]}>
                    {pdfText(particulars(row))}
                  </Text>
                  <Text style={[styles.tdMuted, { width: COLS.type }]}>{typeLabel(row.type)}</Text>
                  <Text style={[styles.td, styles.right, { width: COLS.amount }]}>
                    {pdfAmount(row.amount)}
                  </Text>
                  <Text style={[styles.td, styles.right, { width: COLS.balance }]}>
                    {pdfAmount(row.balance)}
                  </Text>
                </View>
              );
            })}
            <View style={styles.closing} wrap={false}>
              <Text style={styles.closingLabel}>Closing balance</Text>
              <Text style={styles.closingValue}>{pdfAmount(total)}</Text>
            </View>
          </View>
        )}

        <Text style={styles.attestation}>
          This is a record of contributions logged by the society. Money is received
          in cash or by bank outside this system. It is not a bank statement and is
          not a tax certificate. Figures are in Bangladeshi Taka (BDT).
        </Text>

        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Member</Text>
            <Text style={styles.signatureHint}>Acknowledged</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Treasurer</Text>
            <Text style={styles.signatureHint}>Certified true record</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>President</Text>
            <Text style={styles.signatureHint}>On behalf of the society</Text>
          </View>
        </View>

        <PdfFooter />
      </Page>
    </Document>
  );
}
