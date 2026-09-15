"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  yearPlanSchema,
  type YearPlanFormInput,
  type YearPlanInput,
} from "@/lib/validation";
import { apiRequest, ApiRequestError } from "@/lib/http";
import { formatMonthKey, monthRange } from "@/lib/dates";

export function YearPlanForm({
  mode,
  defaultValues,
}: {
  mode: "create" | "edit";
  defaultValues: YearPlanFormInput;
}) {
  const router = useRouter();
  const year = Number(defaultValues.year);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<YearPlanFormInput, unknown, YearPlanInput>({
    resolver: zodResolver(yearPlanSchema),
    defaultValues,
  });

  const startMonth = watch("startMonth");
  const endMonth = watch("endMonth");

  async function onSubmit(values: YearPlanInput) {
    try {
      if (mode === "create") {
        await apiRequest("/api/years", { method: "POST", body: values });
        toast.success(`${values.year} added`);
      } else {
        await apiRequest(`/api/years/${values.year}`, { method: "PATCH", body: values });
        toast.success(`${values.year} updated`);
      }
      router.push(`/years/${values.year}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.issues) {
        for (const [field, message] of Object.entries(error.issues)) {
          setError(field as keyof YearPlanFormInput, { message });
        }
      }
      toast.error(error instanceof Error ? error.message : "Could not save the year");
    }
  }

  const monthOptions = monthRange(`${year}-01`, `${year}-12`);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <Field id="year" label="Year" error={errors.year?.message}>
        <Input id="year" type="number" inputMode="numeric" readOnly={mode === "edit"} {...register("year")} />
      </Field>

      <Field
        id="monthlyAmount"
        label="Monthly contribution (৳)"
        error={errors.monthlyAmount?.message}
        hint="What each member pays per month this year."
      >
        <Input
          id="monthlyAmount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          {...register("monthlyAmount")}
        />
      </Field>

      <Field
        id="oneTimeFee"
        label="One-time fee (৳)"
        error={errors.oneTimeFee?.message}
        hint="Extra amount due this year. Can be paid in instalments."
      >
        <Input
          id="oneTimeFee"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          {...register("oneTimeFee")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startMonth" label="First month" error={errors.startMonth?.message}>
          <Select
            value={startMonth}
            onValueChange={(value) => setValue("startMonth", value, { shouldDirty: true })}
          >
            <SelectTrigger id="startMonth" className="w-full">
              <SelectValue />
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

        <Field id="endMonth" label="Last month" error={errors.endMonth?.message}>
          <Select
            value={endMonth}
            onValueChange={(value) => setValue("endMonth", value, { shouldDirty: true })}
          >
            <SelectTrigger id="endMonth" className="w-full">
              <SelectValue />
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
      </div>

      <FormActions>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : mode === "create" ? "Add year" : "Save changes"}
        </Button>
      </FormActions>
    </form>
  );
}
