import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BrandMark } from "@/components/app/brand-mark";
import { getAppSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const HIGHLIGHTS = [
  { icon: Wallet, text: "See everything you have saved, month by month" },
  { icon: TrendingUp, text: "Check what is paid and what is still owed this year" },
  { icon: ShieldCheck, text: "Download your own statement whenever you need it" },
];

export default async function LoginPage() {
  if (await getAppSession()) redirect("/");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Ambient brand glow behind the card. */}
      <div
        aria-hidden
        className="bg-brand/20 pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-viz-monthly/10 pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full blur-3xl"
      />

      <div className="relative grid w-full max-w-4xl gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        {/* Brand story — hidden on small screens where the form leads. */}
        <div className="hidden flex-col gap-6 lg:flex">
          <BrandMark size={52} />
          <div>
            <h1 className="font-heading text-4xl font-bold tracking-tight">
              Shapnik
            </h1>
            <p className="text-muted-foreground mt-2 max-w-sm text-[15px]">
              Savings management for your cooperative society — collections,
              progress and reports, without the ledger book.
            </p>
          </div>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-sm">
                <span className="bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <item.icon className="size-4.5" />
                </span>
                <span className="text-foreground/80">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <Card className="border-border/60 w-full shadow-xl">
          <CardContent className="p-6 sm:p-7">
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <BrandMark size={48} />
              <h1 className="font-heading mt-3 text-2xl font-bold tracking-tight">
                Shapnik
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Sign in to see your savings with the society.
              </p>
            </div>
            <div className="mb-5 hidden lg:block">
              <h2 className="font-heading text-xl font-semibold">Welcome back</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Sign in to continue to your society.
              </p>
            </div>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
