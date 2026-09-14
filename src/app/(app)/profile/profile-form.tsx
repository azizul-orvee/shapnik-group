"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import {
  profileUpdateSchema,
  type ProfileFormInput,
  type ProfileUpdateInput,
} from "@/lib/validation";
import { apiRequest, ApiRequestError } from "@/lib/http";

export function ProfileForm({
  signInId,
  defaultValues,
}: {
  signInId: string;
  defaultValues: ProfileFormInput;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues,
  });

  async function onSubmit(values: ProfileUpdateInput) {
    try {
      await apiRequest("/api/profile", { method: "PATCH", body: values });
      toast.success(
        values.nationalId && values.nationalId !== defaultValues.nationalId
          ? "Profile saved — sign in with your new NID from now on"
          : "Profile saved",
      );
      reset(values as ProfileFormInput);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.issues) {
        for (const [field, message] of Object.entries(error.issues)) {
          setError(field as keyof ProfileFormInput, { message });
        }
      }
      toast.error(error instanceof Error ? error.message : "Could not save your profile");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <Field id="signInId" label="Sign-in ID" hint="Issued by the society. It cannot be changed here.">
        <Input id="signInId" value={signInId} readOnly disabled className="font-mono" />
      </Field>

      <Field id="name" label="Full name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" {...register("name")} />
      </Field>

      <Field
        id="phone"
        label="Phone"
        error={errors.phone?.message}
        hint="At least 10 digits, e.g. 01712345678."
      >
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="01712345678"
          {...register("phone")}
        />
      </Field>

      <Field
        id="nationalId"
        label="National ID (NID)"
        error={errors.nationalId?.message}
        hint="10–17 digits. This is your sign-in password — changing it changes how you sign in."
      >
        <Input
          id="nationalId"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1234567898765"
          {...register("nationalId")}
        />
      </Field>

      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Nominee</legend>

        <Field id="nomineeName" label="Nominee name" error={errors.nomineeName?.message}>
          <Input id="nomineeName" autoComplete="off" {...register("nomineeName")} />
        </Field>

        <Field
          id="nomineeNationalId"
          label="Nominee NID"
          error={errors.nomineeNationalId?.message}
          hint="10–17 digits."
        >
          <Input
            id="nomineeNationalId"
            inputMode="numeric"
            autoComplete="off"
            {...register("nomineeNationalId")}
          />
        </Field>

        <Field
          id="nomineePhone"
          label="Nominee phone"
          error={errors.nomineePhone?.message}
          hint="Optional."
        >
          <Input
            id="nomineePhone"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="01712345678"
            {...register("nomineePhone")}
          />
        </Field>
      </fieldset>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
