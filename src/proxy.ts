import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 renamed `middleware.ts` to `proxy.ts`. This only checks for the
// presence of a session cookie; per-role checks live in the page/route guards.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
