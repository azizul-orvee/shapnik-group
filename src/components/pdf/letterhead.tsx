import { Image, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import { SOCIETY_LOGO_PNG } from "./logo";
import { BRAND_NAME } from "@/lib/brand";
import { pdfText } from "@/lib/pdf-format";

/** Printed name on every official PDF, regardless of the organisation row. */
export const PDF_BRAND_NAME = BRAND_NAME;

export function PdfLetterhead({
  documentTitle,
  documentRef,
  issuedOn,
}: {
  documentTitle: string;
  documentRef?: string;
  issuedOn: string;
}) {
  return (
    <View style={styles.letterhead} fixed>
      <View style={styles.letterheadRow}>
        <View style={styles.brandBlock}>
          <View style={styles.logoBadge}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt; org name sits beside it */}
            <Image src={{ data: SOCIETY_LOGO_PNG, format: "png" }} style={styles.logo} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.orgName}>{PDF_BRAND_NAME}</Text>
          </View>
        </View>
        <View style={styles.docMeta}>
          <Text style={styles.docKicker}>{pdfText(documentTitle)}</Text>
          {documentRef ? <Text style={styles.docRef}>{documentRef}</Text> : null}
          <Text style={styles.docIssued}>Issued {issuedOn}</Text>
        </View>
      </View>
      <View style={styles.brandBar} />
    </View>
  );
}

export function PdfFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>Confidential | {PDF_BRAND_NAME}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
