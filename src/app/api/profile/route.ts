import { NextResponse } from "next/server";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/validation";
import { getProfile, updateProfile } from "@/server/users";

export const GET = handler(async () => {
  const session = await requireApiSession();
  return NextResponse.json({ profile: await getProfile(session.userId) });
});

/** Anyone may edit their own account — never anyone else's. */
export const PATCH = handler(async (request: Request) => {
  const session = await requireApiSession();
  const input = await parseBody(request, profileUpdateSchema);
  const profile = await updateProfile(session.userId, input);
  return NextResponse.json({ profile });
});
