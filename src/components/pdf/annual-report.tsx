import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import { pdfAmount, pdfDate, pdfText } from "@/lib/pdf-format";
import { formatMonthKeyShort } from "@/lib/dates";
import type { AnnualReport } from "@/server/reports";

export function AnnualReportDocument({ report }: { report: AnnualReport }) {
  return (
    <Document
      title={`Annual fund report ${report.year} — ${report.organization.name}`}
      author={report.organization.name}
      subject="Annual fund report"
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.orgName}>{pdfText(report.organization.name)}</Text>
          <Text style={styles.docTitle}>
            Annual Fund Report for the year ended 31 December {report.year}
          </Text>
          <Text style={styles.docTitle}>
            Prepared for submission to the Department of Cooperatives
          </Text>
        </View>
        <View style={styles.headerRule} />

        <Text style={styles.sectionTitle}>Statement of fund</Text>
        <View>
          <View style={styles.summaryRow}>
            <Text>Opening balance (1 January {report.year})</Text>
            <Text>{pdfAmount(report.openingBalance)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Add: total receipts during the year</Text>
            <Text>{pdfAmount(report.totalCollected)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryStrong}>
              Closing balance (31 December {report.year})
            </Text>
            <Text style={styles.summaryStrong}>{pdfAmount(report.closingBalance)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Membership</Text>
        <View>
          <View style={styles.summaryRow}>
            <Text>Total members</Text>
            <Text>{report.totalMembers}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Contributions recorded during the year</Text>
            <Text>{report.contributionCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Monthly contributions</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: "40%" }]}>Month</Text>
            <Text style={[styles.th, styles.right, { width: "25%" }]}>Payments</Text>
            <Text style={[styles.th, styles.right, { width: "35%" }]}>Collected</Text>
          </View>
          {report.months.map((month, index) => (
            <View
              key={month.monthKey}
              style={index === report.months.length - 1 ? styles.trLast : styles.tr}
              wrap={false}
            >
              <Text style={[styles.td, { width: "40%" }]}>
                {formatMonthKeyShort(month.monthKey)}
              </Text>
              <Text style={[styles.td, styles.right, { width: "25%" }]}>{month.count}</Text>
              <Text style={[styles.td, styles.right, { width: "35%" }]}>
                {pdfAmount(month.total)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total collected during the year</Text>
          <Text style={styles.totalValue}>{pdfAmount(report.totalCollected)}</Text>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Treasurer</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Secretary</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>President</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated {pdfDate(report.generatedAt)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
