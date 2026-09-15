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
import {
  contributionCreateSchema,
  type ContributionCreateInput,
  type ContributionFormInput,
} from "@/lib/validation";
import { apiRequest, ApiRequestError } from "@/lib/http";
import { currentMonthKey, formatMonthKey, monthRange, planForMonthKey } from "@/lib/dates";

export type MemberOption = { id: string; name: string; memberId: string };

type PlanOption = {
  year: number;
  monthlyAmount: number;
  oneTimeFee: number;
  startMonthKey: string;
  endMonthKey: string;
};

export function ContributionForm({
  members,
  plans,
  window,
  defaultValues,
}: {
  members: MemberOption[];
  plans: PlanOption[];
  window: { startMonthKey: string; endMonthKey: string };
  defaultValues: ContributionFormInput;
}) {
  const router = useRouter();
  const thisMonth = currentMonthKey();
  const monthOptions = monthRange(window.startMonthKey, window.endMonthKey).reverse();
  const years = plans.map((p) => p.year);

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
  const selectedMonth = watch("paidForMonth");
  const selectedYear = watch("paidForYear");
  const monthPlan = selectedMonth ? planForMonthKey(plans, selectedMonth) : plans[0];
  const feePlan = plans.find((p) => p.year === Number(selectedYear)) ?? plans[0];

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
        hint="The year's extra fee can be taken in instalments."
      >
        <Select
          value={watch("type") ?? "MONTHLY"}
          onValueChange={(value) => {
            const next = value as ContributionFormInput["type"];
            setValue("type", next, { shouldDirty: true });
            if (next === "ONE_TIME") {
              const plan = feePlan ?? plans[0];
              if (plan) {
                setValue("paidForYear", plan.year, { shouldDirty: true });
                setValue("amount", plan.oneTimeFee, { shouldDirty: true });
              }
            } else if (monthPlan) {
              setValue("amount", monthPlan.monthlyAmount, { shouldDirty: true });
            }
          }}
        >
          <SelectTrigger id="type" className="w-full md:h-8">
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
          <SelectTrigger id="memberId" className="w-full md:h-8">
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
            onValueChange={(value) => {
              setValue("paidForMonth", value, { shouldDirty: true });
              const plan = planForMonthKey(plans, value);
              if (plan) setValue("amount", plan.monthlyAmount, { shouldDirty: true });
            }}
          >
            <SelectTrigger id="paidForMonth" className="w-full md:h-8">
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
      ) : (
        <Field
          id="paidForYear"
          label="Covers year"
          error={errors.paidForYear?.message}
          hint="Which year's extra fee this payment is for."
        >
          <Select
            value={selectedYear ? String(selectedYear) : undefined}
            onValueChange={(value) => {
              const nextYear = Number(value);
              setValue("paidForYear", nextYear, { shouldDirty: true });
              const plan = plans.find((p) => p.year === nextYear);
              if (plan) setValue("amount", plan.oneTimeFee, { shouldDirty: true });
            }}
          >
            <SelectTrigger id="paidForYear" className="w-full md:h-8">
              <SelectValue placeholder="Choose a year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field
        id="amount"
        label="Amount (৳)"
        error={errors.amount?.message}
        hint={
          isMonthly
            ? `Usual monthly contribution is ${(monthPlan?.monthlyAmount ?? 0).toLocaleString("en-IN")}.`
            : `Full fee for ${feePlan?.year ?? ""} is ${(feePlan?.oneTimeFee ?? 0).toLocaleString("en-IN")} — enter less for an instalment.`
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

      <FormActions>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Record payment"}
        </Button>
      </FormActions>
    </form>
  );
}
