"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/app/field";
import { apiRequest } from "@/lib/http";
import { formatTakaShort } from "@/lib/money";
import { dhakaDateKey, formatMonthKey } from "@/lib/dates";
import { planLumpSum, type ShortMonth } from "@/lib/allocate";

/** What one member still owes for one year — the input to the split. */
export type YearObligationView = {
  year: number;
  monthlyAmount: number;
  oneTimeFee: number;
  oneTimePaid: number;
  unpaidMonths: string[];
  shortMonths: ShortMonth[];
  outstanding: number;
};

/**
 * For the member who does not pay month by month.
 *
 * They hand over a large amount — half the year, the whole year — and the
 * treasurer needs it turned into the rows the app actually tracks. Rather than
 * asking the treasurer to do that arithmetic, they enter the one number they
 * were given and see exactly what it settles before committing: the year's fee
 * first, then months oldest first, with any remainder called out rather than
 * quietly absorbed.
 *
 * The preview here and the rows the server writes come from the same
 * `planLumpSum()`, so what is approved is what is recorded.
 */
export function LumpSumDialog({
  memberId,
  memberName,
  obligations,
  defaultYear,
}: {
  memberId: string;
  memberName: string;
  obligations: YearObligationView[];
  defaultYear: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(defaultYear);
  const [amount, setAmount] = useState("");
  const [paidOnDate, setPaidOnDate] = useState(dhakaDateKey());
  const [allowPartialMonth, setAllowPartialMonth] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const obligation =
    obligations.find((row) => row.year === year) ?? obligations[0] ?? null;

  const amountNumber = Number(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;

  const split = useMemo(() => {
    if (!obligation || !amountValid) return null;
    return planLumpSum({
      amount: amountNumber,
      year: obligation.year,
      monthlyAmount: obligation.monthlyAmount,
      oneTimeFee: obligation.oneTimeFee,
      oneTimePaid: obligation.oneTimePaid,
      unpaidMonths: obligation.unpaidMonths,
      shortMonths: obligation.shortMonths,
      allowPartialMonth,
    });
  }, [obligation, amountNumber, amountValid, allowPartialMonth]);

  const canSubmit = Boolean(split && split.parts.length > 0) && !submitting;

  async function submit() {
    if (!obligation) return;
    setSubmitting(true);
    try {
      const result = await apiRequest<{
        created: number;
        leftover: number;
        clearsYear: boolean;
      }>("/api/contributions/lump-sum", {
        method: "POST",
        body: {
          memberId,
          amount: amountNumber,
          paidForYear: obligation.year,
          paidOnDate,
          allowPartialMonth,
          note: note.trim() || undefined,
        },
      });
      toast.success(
        `Recorded ${result.created} ${result.created === 1 ? "entry" : "entries"} for ${memberName}`,
        {
          description: result.clearsYear
            ? `${obligation.year} is now fully settled`
            : result.leftover > 0
              ? `${formatTakaShort(result.leftover)} could not be allocated and was not recorded`
              : undefined,
        },
      );
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (obligations.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Layers className="size-4" />
          Lump sum
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a lump sum</DialogTitle>
          <DialogDescription>
            Enter what {memberName} handed over. It is split across the year&rsquo;s fee
            and unpaid months automatically — check the breakdown before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="lump-year" label="Counts toward">
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger id="lump-year" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {obligations.map((row) => (
                  <SelectItem key={row.year} value={String(row.year)}>
                    {row.year}
                    {row.outstanding === 0 ? " · settled" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="lump-date" label="Received on">
            <Input
              id="lump-date"
              type="date"
              value={paidOnDate}
              onChange={(event) => setPaidOnDate(event.target.value)}
            />
          </Field>
        </div>

        <Field
          id="lump-amount"
          label="Amount received (৳)"
          hint={
            obligation
              ? `${formatTakaShort(obligation.outstanding)} outstanding for ${obligation.year}.`
              : undefined
          }
        >
          <Input
            id="lump-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="50000"
          />
        </Field>

        {/* Shortcuts for the two amounts people actually hand over. */}
        {obligation && obligation.outstanding > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmount(String(obligation.outstanding))}
            >
              All of it · {formatTakaShort(obligation.outstanding)}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmount(String(Math.round(obligation.outstanding / 2)))}
            >
              Half · {formatTakaShort(Math.round(obligation.outstanding / 2))}
            </Button>
          </div>
        ) : null}

        {/* The breakdown — the whole point of this dialog. */}
        {split && obligation ? (
          <div className="rounded-md border">
            <p className="text-muted-foreground border-b px-3 py-2 text-xs font-medium tracking-wide uppercase">
              This will record {split.parts.length}{" "}
              {split.parts.length === 1 ? "entry" : "entries"}
            </p>
            <ul className="max-h-56 divide-y overflow-y-auto text-sm">
              {split.parts.map((part) => (
                <li
                  key={part.kind === "ONE_TIME" ? `fee-${part.year}` : part.monthKey}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={
                        part.kind === "ONE_TIME"
                          ? "bg-viz-onetime size-2 shrink-0 rounded-full"
                          : "bg-viz-monthly size-2 shrink-0 rounded-full"
                      }
                      aria-hidden
                    />
                    <span className="truncate">
                      {part.kind === "ONE_TIME"
                        ? `One-time fee ${part.year}`
                        : formatMonthKey(part.monthKey)}
                    </span>
                    {part.kind === "MONTHLY_TOPUP" ? (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {part.full ? "tops up" : "tops up, still short"}
                      </span>
                    ) : !part.full ? (
                      <span className="text-viz-warning shrink-0 text-xs">part payment</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatTakaShort(part.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-muted-foreground space-y-1 border-t px-3 py-2 text-xs">
              <p className="flex justify-between gap-3">
                <span>Allocated</span>
                <span className="text-foreground font-medium tabular-nums">
                  {formatTakaShort(split.allocated)}
                </span>
              </p>
              {split.leftover > 0 ? (
                <p className="text-viz-warning flex justify-between gap-3">
                  <span>Not allocated</span>
                  <span className="font-medium tabular-nums">
                    {formatTakaShort(split.leftover)}
                  </span>
                </p>
              ) : null}
              {split.clearsYear ? <p>{obligation.year} will be fully settled.</p> : null}
            </div>
          </div>
        ) : null}

        {/* Only worth asking about when a remainder actually exists. */}
        {split && split.leftover > 0 && obligation && obligation.unpaidMonths.length > 0 ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 size-4"
              checked={allowPartialMonth}
              onChange={(event) => setAllowPartialMonth(event.target.checked)}
            />
            <span>
              Put the remaining {formatTakaShort(split.leftover)} toward the next unpaid
              month as a part payment.
              <span className="text-muted-foreground block text-xs">
                Leave this off and the remainder is not recorded at all.
              </span>
            </span>
          </label>
        ) : null}

        {split && split.leftover > 0 && obligation && obligation.unpaidMonths.length === 0 ? (
          <p className="text-viz-warning text-xs">
            {formatTakaShort(split.leftover)} is more than {obligation.year} needs. Record
            the rest against another year once it has a payment structure.
          </p>
        ) : null}

        <Field id="lump-note" label="Note" hint="Optional — bank reference, for example.">
          <Textarea
            id="lump-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting
              ? "Recording…"
              : split
                ? `Record ${formatTakaShort(split.allocated)}`
                : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
