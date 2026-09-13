"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { planInitialSetup } from "@/lib/allocate";
import { formatMonthKeyShort } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import { apiRequest, ApiRequestError } from "@/lib/http";
import { cn } from "@/lib/utils";

type Props = {
  memberId: string;
  year: number;
  monthlyAmount: number;
  oneTimeFee: number;
  oneTimePaid: number;
  /** In-season months of `year` with no payment yet, oldest first. */
  unpaidMonths: string[];
  /** Today, in Dhaka time, as YYYY-MM-DD. */
  today: string;
};

export function InitialPaymentsForm({
  memberId,
  year,
  monthlyAmount,
  oneTimeFee,
  oneTimePaid,
  unpaidMonths,
  today,
}: Props) {
  const router = useRouter();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [feeTicked, setFeeTicked] = useState(false);
  const [box, setBox] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const feeDue = Math.max(0, oneTimeFee - oneTimePaid);
  const boxAmount = Math.max(0, Number(box) || 0);
  const tickedMonths = unpaidMonths.filter((m) => ticked[m]);

  const plan = planInitialSetup({
    monthlyAmount,
    oneTimeFee,
    oneTimePaid,
    unpaidMonths,
    tickedMonths,
    feeTicked,
    boxAmount,
    allowPartial: true,
  });

  const hasSomething = tickedMonths.length > 0 || feeTicked || boxAmount > 0;

  function toggleMonth(monthKey: string) {
    setTicked((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  }

  function goToMember() {
    router.push(`/members/${memberId}`);
    router.refresh();
  }

  async function onSubmit() {
    setSubmitting(true);
    try {
      const result = await apiRequest<{ created: number; allocated: number; leftover: number }>(
        `/api/members/${memberId}/setup`,
        {
          method: "POST",
          body: { paidForYear: year, tickedMonths, feeTicked, boxAmount, paidOnDate: today },
        },
      );
      toast.success(
        `Recorded ${formatTaka(result.allocated)}` +
          (result.leftover > 0 ? ` · ${formatTaka(result.leftover)} left unallocated` : ""),
      );
      goToMember();
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError || error instanceof Error
          ? error.message
          : "Could not record the payments",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-muted-foreground text-sm">
        Tick every {year} month (and the fee) this member has already paid in full. Add any
        remaining lump sum below — it fills the earliest unticked months first, then the fee.
        {" "}
        <span className="text-foreground">Previous years are already recorded as fully paid.</span>
      </p>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Months paid in full</h2>
          <span className="text-muted-foreground text-xs">{formatTaka(monthlyAmount)} each</span>
        </div>
        {unpaidMonths.length === 0 ? (
          <p className="text-muted-foreground text-sm">Every month for {year} is already recorded.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {unpaidMonths.map((monthKey) => {
              const on = Boolean(ticked[monthKey]);
              return (
                <button
                  key={monthKey}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleMonth(monthKey)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                    on
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted",
                  )}
                >
                  <span>{formatMonthKeyShort(monthKey)}</span>
                  <span aria-hidden className={cn("text-xs", on ? "text-primary" : "text-muted-foreground")}>
                    {on ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {feeDue > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">One-time fee</h2>
          <button
            type="button"
            aria-pressed={feeTicked}
            onClick={() => setFeeTicked((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
              feeTicked ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted",
            )}
          >
            <span>One-time fee {year} paid in full</span>
            <span aria-hidden>{feeTicked ? `✓ ${formatTaka(feeDue)}` : formatTaka(feeDue)}</span>
          </button>
        </section>
      ) : null}

      <section className="space-y-1.5">
        <Field
          id="box"
          label="Extra lump sum (optional)"
          hint="Spread over the remaining unticked months oldest-first, then the fee."
        >
          <Input
            id="box"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={box}
            onChange={(e) => setBox(e.target.value)}
          />
        </Field>
      </section>

      <section className="rounded-lg border bg-muted/40 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Will record</h2>
          <span className="font-heading text-lg font-semibold">{formatTaka(plan.allocated)}</span>
        </div>
        {plan.parts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing yet — tick the months already paid, or enter an amount.
          </p>
        ) : (
          <ul className="divide-border/60 divide-y text-sm">
            {plan.parts.map((part) => (
              <li
                key={part.kind === "MONTHLY" ? part.monthKey : "fee"}
                className="flex items-center justify-between py-1.5"
              >
                <span>
                  {part.kind === "MONTHLY" ? formatMonthKeyShort(part.monthKey) : `One-time fee ${year}`}
                  {!part.full ? <span className="text-[var(--warning)]"> · part</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {part.source === "tick" ? "ticked" : "lump sum"}
                  </span>
                  <span>{formatTaka(part.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {plan.leftover > 0 ? (
          <p className="text-[var(--warning)] mt-3 text-xs">
            {formatTaka(plan.leftover)} won&apos;t be recorded — that&apos;s more than {year} still owes.
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" onClick={onSubmit} disabled={submitting || !hasSomething}>
          {submitting ? "Recording…" : "Record payments"}
        </Button>
        <Button type="button" variant="ghost" onClick={goToMember} disabled={submitting}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
