import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BrandMark } from "@/components/app/brand-mark";
import { getAppSession } from "@/lib/session";
import { ControlPanelForm } from "./control-panel-form";

export const metadata: Metadata = {
  title: "Control panel",
  // Nothing here should show up in a search result.
  robots: { index: false, follow: false },
};

export default async function ControlPanelPage() {
  const session = await getAppSession();
  if (session) redirect(session.role === "ADMIN" ? "/dashboard" : "/my-statement");

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2 text-center">
              <div className="flex justify-center">
                <BrandMark className="size-11" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Control panel</h1>
              <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                <Lock className="size-3.5" />
                Administrator access only
              </p>
            </div>

            <ControlPanelForm />
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-4 text-center text-xs">
          Are you a member?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in here
          </Link>
        </p>
      </div>
    </main>
  );
}
