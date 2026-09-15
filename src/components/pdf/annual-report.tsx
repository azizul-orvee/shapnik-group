import { Document, Page, Text, View } from "@react-pdf/renderer";
import { PDF_BRAND_NAME, PdfFooter, PdfLetterhead } from "./letterhead";
import { styles } from "./styles";
import { pdfAmount, pdfIssuedOn } from "@/lib/pdf-format";
import { formatMonthKeyShort } from "@/lib/dates";
import type { AnnualReport } from "@/server/reports";

export function AnnualReportDocument({ report }: { report: AnnualReport }) {
  const issuedOn = pdfIssuedOn(report.generatedAt);

  return (
    <Document
      title={`Annual fund report ${report.year} - ${PDF_BRAND_NAME}`}
      author={PDF_BRAND_NAME}
      subject="Annual fund report"
      creator={PDF_BRAND_NAME}
    >
      <Page size="A4" style={styles.page}>
        <PdfLetterhead
          documentTitle="Annual fund report"
          documentRef={`Year ended 31 December ${report.year}`}
          issuedOn={issuedOn}
        />

        <Text style={[styles.attestation, { marginTop: 0 }]}>
          Prepared for submission to the Department of Cooperatives. Receipts only
          - this society does not record spending in the app.
        </Text>

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

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Membership</Text>
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

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Monthly contributions</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: "40%" }]}>Month</Text>
            <Text style={[styles.th, styles.right, { width: "25%" }]}>Payments</Text>
            <Text style={[styles.th, styles.right, { width: "35%" }]}>Collected</Text>
          </View>
          {report.months.map((month, index) => (
            <View
              key={month.monthKey}
              style={index === report.months.length - 1 ? styles.trLast : index % 2 === 1 ? styles.trAlt : styles.tr}
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

        <View style={styles.closing} wrap={false}>
          <Text style={styles.closingLabel}>Total collected during the year</Text>
          <Text style={styles.closingValue}>{pdfAmount(report.totalCollected)}</Text>
        </View>

        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Treasurer</Text>
            <Text style={styles.signatureHint}>Certified true record</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Secretary</Text>
            <Text style={styles.signatureHint}>Prepared</Text>
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
