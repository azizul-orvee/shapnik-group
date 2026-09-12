import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/session";
import { getProfile } from "@/server/users";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const session = await requireSession();
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
