import { NextResponse } from "next/server";
import { ApiError, handler, parseBody, requireApiSession } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/validation";
import { getProfile, updateProfile } from "@/server/users";

/** Admin only. Member details live on the Member row, not this User profile. */
async function requireAdminProfile() {
  const session = await requireApiSession();
  if (session.role !== "ADMIN") {
    throw new ApiError(403, "Ask the admin to update your registered details.");
  }
  return session;
}

export const GET = handler(async () => {
  const session = await requireAdminProfile();
  return NextResponse.json({ profile: await getProfile(session.userId) });
});

export const PATCH = handler(async (request: Request) => {
  const session = await requireAdminProfile();
  const input = await parseBody(request, profileUpdateSchema);
  const profile = await updateProfile(session.userId, input);
  return NextResponse.json({ profile });
});
