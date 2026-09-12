import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { adminLoginSchema, loginSchema } from "@/lib/validation";
import type { Role } from "@/generated/prisma/enums";

/** A hash to compare against when no user matched, so timing stays flat. */
const DUMMY_HASH = "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";

type Candidate = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: Role;
  organizationId: string;
  memberId: string | null;
  passwordHash: string;
  adminPasswordHash: string | null;
};

/**
 * An ID is only unique within an organisation, so a deployment holding more than
 * one society could match twice. Refuse rather than guess who is signing in.
 */
async function findByUsername(username: string): Promise<Candidate | null> {
  const matches = await prisma.user.findMany({ where: { username }, take: 2 });
  return matches.length === 1 ? matches[0] : null;
}

function sessionUser(user: Candidate) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email ?? "",
    role: user.role,
    organizationId: user.organizationId,
    memberId: user.memberId,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    /** Members: member ID + NID, from /login. Admins are turned away here. */
    Credentials({
      id: "member-login",
      credentials: {
        identifier: { label: "Member ID", type: "text" },
        password: { label: "NID number", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await findByUsername(parsed.data.identifier);
        if (!user) {
          await bcrypt.compare(parsed.data.password, DUMMY_HASH);
          return null;
        }

        // The admin has a third factor and must use /control_panel, so this
        // door never opens for them however correct the first two are.
        if (user.role === "ADMIN") {
          await bcrypt.compare(parsed.data.password, DUMMY_HASH);
          return null;
        }

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        return ok ? sessionUser(user) : null;
      },
    }),

    /** Admins: ID + NID + their own password, from /control_panel. */
    Credentials({
      id: "admin-login",
      credentials: {
        identifier: { label: "Admin ID", type: "text" },
        password: { label: "NID number", type: "password" },
        adminPassword: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = adminLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await findByUsername(parsed.data.identifier);
        // Only an admin with a third factor set can sign in here.
        if (!user || user.role !== "ADMIN" || !user.adminPasswordHash) {
          await bcrypt.compare(parsed.data.password, DUMMY_HASH);
          await bcrypt.compare(parsed.data.adminPassword, DUMMY_HASH);
          return null;
        }

        // Check both factors every time — no early return, so a wrong NID and a
        // wrong password cost the same.
        const nidOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
        const passwordOk = await bcrypt.compare(
          parsed.data.adminPassword,
          user.adminPasswordHash,
        );
        return nidOk && passwordOk ? sessionUser(user) : null;
      },
    }),
  ],
});
