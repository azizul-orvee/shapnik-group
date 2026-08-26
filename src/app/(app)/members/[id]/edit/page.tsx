import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { requireWriter } from "@/lib/session";
import { findMember } from "@/server/members";
import { MemberForm } from "../../member-form";

export const metadata: Metadata = { title: "Edit member" };

export default async function EditMemberPage({ params }: PageProps<"/members/[id]/edit">) {
  const session = await requireWriter();
  const { id } = await params;
  const member = await findMember(session.organizationId, id);
  if (!member) notFound();

  return (
    <>
      <PageHeader title="Edit member" description={member.name} />
      <MemberForm
        memberId={member.id}
        defaultValues={{
          name: member.name,
          memberId: member.memberId,
          phone: member.phone ?? undefined,
          joinDate: member.joinDate.toISOString().slice(0, 10),
          status: member.status,
        }}
      />
    </>
  );
}
