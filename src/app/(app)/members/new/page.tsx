import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireWriter } from "@/lib/session";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Add member" };

export default async function NewMemberPage() {
  await requireWriter();

  return (
    <>
      <PageHeader title="Add member" description="Register a new member of the society." />
      <MemberForm
        defaultValues={{
          name: "",
          memberId: "",
          phone: "",
          nationalId: "",
          nomineeName: "",
          nomineeNationalId: "",
          nomineePhone: "",
        }}
      />
    </>
  );
}
