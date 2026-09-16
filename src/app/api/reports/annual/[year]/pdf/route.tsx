import { renderToBuffer } from "@react-pdf/renderer";
import { badRequest, handler, requireApiOrgReader } from "@/lib/api";
import { buildAnnualReport } from "@/server/reports";
import { getSocietySettings } from "@/server/progress";
import { AnnualReportDocument } from "@/components/pdf/annual-report";
import { BRAND_NAME } from "@/lib/brand";

export const runtime = "nodejs";

type Context = { params: Promise<{ year: string }> };

export const GET = handler(async (_request: Request, { params }: Context) => {
  const session = await requireApiOrgReader();
  const { year: yearParam } = await params;

  const year = Number(yearParam);
  const { years } = await getSocietySettings(session.organizationId);
  // Only years the society actually operates in can be reported on.
  if (!Number.isInteger(year) || !years.includes(year)) {
    throw badRequest(`Reports are available for ${years.slice().reverse().join(" and ")}`);
  }

  const report = await buildAnnualReport(session.organizationId, year);
  const buffer = await renderToBuffer(<AnnualReportDocument report={report} />);
  const slug = BRAND_NAME.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="annual-report-${year}-${slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
