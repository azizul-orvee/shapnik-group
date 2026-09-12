import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireWriter } from "@/lib/session";
import { suggestMemberCode } from "@/server/members";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Add member" };

export default async function NewMemberPage() {
  const session = await requireWriter();
  const suggestedCode = await suggestMemberCode(session.organizationId);

  return (
    <>
      <PageHeader title="Add member" description="Register a new member of the society." />
      <MemberForm
        defaultValues={{
          name: "",
          memberId: suggestedCode,
          phone: "",
          nationalId: "",
          nomineeName: "",
          nomineeNationalId: "",
          nomineePhone: "",
          joinDate: new Date().toISOString().slice(0, 10),
          status: "ACTIVE",
        }}
      />
    </>
  );
}
