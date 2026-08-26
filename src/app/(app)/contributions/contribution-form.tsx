"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/app/field";
import {
  contributionCreateSchema,
  type ContributionCreateInput,
  type ContributionFormInput,
} from "@/lib/validation";
import { apiRequest, ApiRequestError } from "@/lib/http";
import { currentMonthKey, formatMonthKey, monthRange } from "@/lib/dates";

export type MemberOption = { id: string; name: string; memberId: string };

export function ContributionForm({
  members,
  settings,
  defaultValues,
}: {
  members: MemberOption[];
  settings: {
    monthlyAmount: number;
    oneTimeFee: number;
    startMonthKey: string;
    endMonthKey: string;
  };
  defaultValues: ContributionFormInput;
}) {
  const router = useRouter();
  // Every month the society runs, newest first. Future months are offered too:
  // members do pay ahead, sometimes the whole year at once.
  const thisMonth = currentMonthKey();
  const monthOptions = monthRange(settings.startMonthKey, settings.endMonthKey).reverse();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContributionFormInput, unknown, ContributionCreateInput>({
    resolver: zodResolver(contributionCreateSchema),
    defaultValues,
  });

  const isMonthly = (watch("type") ?? "MONTHLY") === "MONTHLY";

  async function onSubmit(values: ContributionCreateInput) {
    try {
      await apiRequest("/api/contributions", { method: "POST", body: values });
      toast.success("Payment recorded");
      router.push("/contributions");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.issues) {
        for (const [field, message] of Object.entries(error.issues)) {
          setError(field as keyof ContributionFormInput, { message });
        }
      }
      toast.error(error instanceof Error ? error.message : "Could not record the payment");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <Field
        id="type"
        label="Payment type"
        error={errors.type?.message}
        hint="The one-time admission fee can be taken in instalments."
      >
        <Select
          value={watch("type") ?? "MONTHLY"}
          onValueChange={(value) => {
            const next = value as ContributionFormInput["type"];
            setValue("type", next, { shouldDirty: true });
            // Prefill the usual amount for the type; the treasurer can still
            // override it for a part payment.
            setValue(
              "amount",
              next === "ONE_TIME" ? settings.oneTimeFee : settings.monthlyAmount,
              { shouldDirty: true },
            );
          }}
        >
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MONTHLY">Monthly contribution</SelectItem>
            <SelectItem value="ONE_TIME">One-time fee</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field id="memberId" label="Member" error={errors.memberId?.message}>
        <Select
          value={watch("memberId")}
          onValueChange={(value) => setValue("memberId", value, { shouldDirty: true })}
        >
          <SelectTrigger id="memberId" className="w-full">
            <SelectValue placeholder="Choose a member" />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.memberId} — {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isMonthly ? (
      <Field
        id="paidForMonth"
        label="Covers month"
        error={errors.paidForMonth?.message}
        hint="Which monthly contribution this payment settles — a later month is fine if they are paying ahead."
      >
        <Select
          value={watch("paidForMonth")}
          onValueChange={(value) => setValue("paidForMonth", value, { shouldDirty: true })}
        >
          <SelectTrigger id="paidForMonth" className="w-full">
            <SelectValue placeholder="Choose a month" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((month) => (
              <SelectItem key={month} value={month}>
                {formatMonthKey(month)}
                {month > thisMonth ? " · in advance" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      ) : null}

      <Field
        id="amount"
        label="Amount (৳)"
        error={errors.amount?.message}
        hint={
          isMonthly
            ? `Usual monthly contribution is ${settings.monthlyAmount.toLocaleString("en-IN")}.`
            : `Full fee is ${settings.oneTimeFee.toLocaleString("en-IN")} — enter less for an instalment.`
        }
      >
        <Input
          id="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          {...register("amount")}
        />
      </Field>

      <Field id="paidOnDate" label="Received on" error={errors.paidOnDate?.message}>
        <Input id="paidOnDate" type="date" {...register("paidOnDate")} />
      </Field>

      <Field id="note" label="Note" error={errors.note?.message} hint="Optional.">
        <Textarea id="note" rows={2} {...register("note")} />
      </Field>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Record payment"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
