"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { loginSchema } from "@/lib/validation";

export type LoginState = { error: string | null };

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your member ID and NID number" };
  }

  try {
    await signIn("member-login", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirectTo: "/my-statement",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Wrong member ID or NID number" };
    }
    // `signIn` signals a successful redirect by throwing — let it through.
    throw error;
  }
}
