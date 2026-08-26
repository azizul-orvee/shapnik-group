import { renderToBuffer } from "@react-pdf/renderer";
import { ApiError, handler, requireApiSession } from "@/lib/api";
import { canReadOrg } from "@/lib/rbac";
import { buildMemberStatement } from "@/server/reports";
import { MemberStatementDocument } from "@/components/pdf/member-statement";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export const GET = handler(async (_request: Request, { params }: Context) => {
  const session = await requireApiSession();
  const { id } = await params;

  // A MEMBER-role login may only pull their own statement.
  if (!canReadOrg(session.role) && session.memberId !== id) {
    throw new ApiError(403, "You can only download your own statement");
  }

  const statement = await buildMemberStatement(session.organizationId, id);
  const buffer = await renderToBuffer(<MemberStatementDocument statement={statement} />);
  const filename = `statement-${statement.member.memberCode}-${statement.member.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
