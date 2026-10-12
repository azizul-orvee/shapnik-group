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
import { FormActions } from "@/components/app/form-actions";
import { contributionUpdateSchema, type ContributionUpdateInput } from "@/lib/validation";
import { apiRequest, ApiRequestError } from "@/lib/http";
import { dhakaDateKey, formatMonthKey, monthRange, planForMonthKey } from "@/lib/dates";
import { formatTakaShort } from "@/lib/money";
import type { z } from "zod";

type PlanOption = {
  year: number;
  monthlyAmount: number;
  oneTimeFee: number;
  startMonthKey: string;
  endMonthKey: string;
};

type FormInput = z.input<typeof contributionUpdateSchema>;

/**
 * Corrects a payment that was recorded wrongly. Member and type cannot change
 * here — a payment against the wrong member is removed and logged again.
 */
export function EditContributionForm({
  contributionId,
  type,
  recordedAmount,
  plans,
  window,
  returnHref,
  defaultValues,
}: {
  contributionId: string;
  type: "MONTHLY" | "ONE_TIME";
  recordedAmount: number;
  plans: PlanOption[];
  window: { startMonthKey: string; endMonthKey: string };
  returnHref: string;
  defaultValues: FormInput;
}) {
  const router = useRouter();
  const today = dhakaDateKey();
  const isMonthly = type === "MONTHLY";
  const monthOptions = monthRange(window.startMonthKey, window.endMonthKey).reverse();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormInput, unknown, ContributionUpdateInput>({
    resolver: zodResolver(contributionUpdateSchema),
    defaultValues,
  });

  const selectedMonth = watch("paidForMonth");
  const selectedYear = watch("paidForYear");
  const monthPlan = selectedMonth ? planForMonthKey(plans, selectedMonth) : undefined;
  const feePlan = plans.find((p) => p.year === Number(selectedYear));

  async function onSubmit(values: ContributionUpdateInput) {
    // Send only what applies to this type; the server derives a monthly year.
    // An empty note is sent as "" so clearing it actually clears it.
    const common = { amount: values.amount, paidOnDate: values.paidOnDate, note: values.note ?? "" };
    const body = isMonthly
      ? { ...common, paidForMonth: values.paidForMonth }
      : { ...common, paidForYear: values.paidForYear };
    try {
      await apiRequest(`/api/contributions/${contributionId}`, { method: "PATCH", body });
      toast.success("Payment corrected");
      router.push(returnHref);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.issues) {
        for (const [field, message] of Object.entries(error.issues)) {
          setError(field as keyof FormInput, { message });
        }
      }
      toast.error(error instanceof Error ? error.message : "Could not save the correction");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      {isMonthly ? (
        <Field
          id="paidForMonth"
          label="Covers month"
          error={errors.paidForMonth?.message}
          hint="Change this only if the payment was logged against the wrong month."
        >
          <Select
            value={selectedMonth}
            onValueChange={(value) => setValue("paidForMonth", value, { shouldDirty: true })}
          >
            <SelectTrigger id="paidForMonth" className="w-full md:h-8">
              <SelectValue placeholder="Choose a month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonthKey(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <Field
          id="paidForYear"
          label="Covers year"
          error={errors.paidForYear?.message}
          hint="Which year's extra fee this instalment counts toward."
        >
          <Select
            value={selectedYear ? String(selectedYear) : undefined}
            onValueChange={(value) => setValue("paidForYear", Number(value), { shouldDirty: true })}
          >
            <SelectTrigger id="paidForYear" className="w-full md:h-8">
              <SelectValue placeholder="Choose a year" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.year} value={String(plan.year)}>
                  {plan.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field
        id="amount"
        label="Amount actually received (৳)"
        error={errors.amount?.message}
        hint={`Recorded as ${formatTakaShort(recordedAmount)}. ${
          isMonthly
            ? `The monthly rate is ${formatTakaShort(monthPlan?.monthlyAmount ?? 0)}; less than that leaves the month part paid.`
            : `The full fee for ${feePlan?.year ?? ""} is ${formatTakaShort(feePlan?.oneTimeFee ?? 0)}.`
        }`}
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

      <Field
        id="paidOnDate"
        label="Received on"
        error={errors.paidOnDate?.message}
        hint="The day the member actually handed the money over."
      >
        <Input id="paidOnDate" type="date" max={today} {...register("paidOnDate")} />
      </Field>

      <Field id="note" label="Note" error={errors.note?.message} hint="Optional.">
        <Textarea id="note" rows={2} {...register("note")} />
      </Field>

      <FormActions>
        <Button type="button" variant="ghost" onClick={() => router.push(returnHref)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save correction"}
        </Button>
      </FormActions>
    </form>
  );
}
