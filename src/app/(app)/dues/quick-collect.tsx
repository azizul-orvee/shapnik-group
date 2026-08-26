"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/app/field";
import { apiRequest } from "@/lib/http";
import { formatMonthKey } from "@/lib/dates";

export type PendingMember = { memberId: string; memberCode: string; name: string };

/**
 * The treasurer's fast path: tick off several members who paid the same amount
 * at a collection meeting, without opening the form once per member.
 */
export function QuickCollect({
  monthKey,
  pending,
  suggestedAmount,
}: {
  monthKey: string;
  pending: PendingMember[];
  suggestedAmount: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState(suggestedAmount ? String(suggestedAmount) : "");
  const [paidOnDate, setPaidOnDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const allSelected = selected.size === pending.length && pending.length > 0;
  const amountNumber = Number(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const canSubmit = useMemo(
    () => selected.size > 0 && amountValid && !submitting,
    [selected.size, amountValid, submitting],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    try {
      const result = await apiRequest<{ created: number; skipped: number }>(
        "/api/contributions/bulk",
        {
          method: "POST",
          body: {
            memberIds: [...selected],
            amount: amountNumber,
            paidForMonth: monthKey,
            paidOnDate,
          },
        },
      );
      toast.success(
        `Recorded ${result.created} ${result.created === 1 ? "payment" : "payments"}` +
          (result.skipped > 0 ? ` · ${result.skipped} already paid` : ""),
      );
      setOpen(false);
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the payments");
    } finally {
      setSubmitting(false);
    }
  }

  if (pending.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Collect from {pending.length} pending</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payments for {formatMonthKey(monthKey)}</DialogTitle>
          <DialogDescription>
            Tick the members who have paid. Everyone selected is logged for the same amount.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="bulk-amount" label="Amount each (৳)">
            <Input
              id="bulk-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field id="bulk-date" label="Received on">
            <Input
              id="bulk-date"
              type="date"
              value={paidOnDate}
              onChange={(event) => setPaidOnDate(event.target.value)}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(pending.map((m) => m.memberId)))
            }
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        </div>

        <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
          {pending.map((member) => (
            <li key={member.memberId}>
              <label className="hover:bg-accent/50 flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={selected.has(member.memberId)}
                  onChange={() => toggle(member.memberId)}
                />
                <span className="text-muted-foreground w-16 shrink-0 font-mono text-xs">
                  {member.memberCode}
                </span>
                <span className="truncate">{member.name}</span>
              </label>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? "Recording…" : `Record ${selected.size || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
