import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the Auth.js config: no Prisma, no bcrypt.
 * `src/auth.ts` extends this with the Credentials provider.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.memberId = user.memberId ?? null;
      }
      // `update()` from the client refreshes the display name only.
      if (trigger === "update" && session?.name) {
        token.name = session.name as string;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
        session.user.memberId = token.memberId ?? null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
