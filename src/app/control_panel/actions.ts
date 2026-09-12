"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { adminLoginSchema } from "@/lib/validation";

export type AdminLoginState = { error: string | null };

export async function authenticateAdmin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const parsed = adminLoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { error: "Fill in all three fields" };
  }

  try {
    await signIn("admin-login", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      adminPassword: parsed.data.adminPassword,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately vague: never say which of the three was wrong.
      return { error: "Those credentials were not accepted" };
    }
    // `signIn` signals a successful redirect by throwing — let it through.
    throw error;
  }
}
