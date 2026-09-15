import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/session";
import { findMember, redactMember } from "@/server/members";
import { getProfile } from "@/server/users";
import { MemberProfileView } from "./member-profile";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const session = await requireSession();

  if (session.role !== "ADMIN") {
    if (!session.memberId) notFound();
    const member = await findMember(session.organizationId, session.memberId);
    if (!member) notFound();
    const view = redactMember(member, false);

    return (
      <>
        <PageHeader
          title="My profile"
          description="What the society has on file for you. Only the admin can change these."
        />
        <MemberProfileView
          memberId={view.memberId}
          name={view.name}
          phone={view.phone}
          nationalId={view.nationalId}
          nomineeName={view.nomineeName}
          nomineeNationalId={view.nomineeNationalId}
          nomineePhone={view.nomineePhone}
        />
      </>
    );
  }

  const profile = await getProfile(session.userId);

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your own details. Fill these in whenever you are ready — nothing here is required to keep using the app."
      />
      <ProfileForm
        signInId={profile.username ?? "—"}
        defaultValues={{
          name: profile.name,
          phone: profile.phone ?? "",
          nationalId: profile.nationalId ?? "",
          nomineeName: profile.nomineeName ?? "",
          nomineeNationalId: profile.nomineeNationalId ?? "",
          nomineePhone: profile.nomineePhone ?? "",
        }}
      />
    </>
  );
}
