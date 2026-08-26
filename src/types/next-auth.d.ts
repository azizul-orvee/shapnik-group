import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: Role;
    organizationId: string;
    memberId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      organizationId: string;
      memberId: string | null;
    } & DefaultSession["user"];
  }
}

// next-auth/jwt only re-exports from @auth/core/jwt, so the augmentation has to
// target the module that actually declares the interface.
declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    organizationId: string;
    memberId?: string | null;
  }
}
