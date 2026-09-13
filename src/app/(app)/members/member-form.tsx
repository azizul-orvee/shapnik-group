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
import {
  memberCreateSchema,
  type MemberCreateInput,
  type MemberFormInput,
} from "@/lib/validation";
import { apiRequest, ApiRequestError } from "@/lib/http";

type Props = {
  /** Present when editing an existing member. */
  memberId?: string;
  defaultValues: MemberFormInput;
};

export function MemberForm({ memberId, defaultValues }: Props) {
  const router = useRouter();
  const isEdit = Boolean(memberId);

  const form = useForm<MemberFormInput, unknown, MemberCreateInput>({
    resolver: zodResolver(memberCreateSchema),
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: MemberCreateInput) {
    try {
      if (isEdit) {
        await apiRequest(`/api/members/${memberId}`, { method: "PATCH", body: values });
        toast.success("Member updated");
        router.push(`/members/${memberId}`);
      } else {
        const { member } = await apiRequest<{ member: { id: string } }>("/api/members", {
          method: "POST",
          body: values,
        });
        toast.success("Member added — now record what they've paid");
        router.push(`/members/${member.id}/setup`);
      }
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.issues) {
        for (const [field, message] of Object.entries(error.issues)) {
          setError(field as keyof MemberFormInput, { message });
        }
      }
      toast.error(error instanceof Error ? error.message : "Could not save the member");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <Field id="name" label="Full name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" {...register("name")} />
      </Field>

      <Field
        id="memberId"
        label="Member ID"
        error={errors.memberId?.message}
        hint="Shown on the passbook, e.g. M-014. Must be unique in the society."
      >
        <Input id="memberId" autoCapitalize="characters" {...register("memberId")} />
      </Field>

      <Field id="phone" label="Phone" error={errors.phone?.message} hint="11 digits, e.g. 01712345678.">
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
        hint={
          isEdit
            ? "10–17 digits. Changing it also changes the password they sign in with."
            : "10–17 digits. This is also their sign-in password."
        }
      >
        <Input
          id="nationalId"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1990123456"
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

      <Field
        id="status"
        label="Status"
        error={errors.status?.message}
        hint="Inactive members are left out of dues tracking but keep their history."
      >
        <Select
          value={watch("status") ?? "ACTIVE"}
          onValueChange={(value) =>
            setValue("status", value as MemberFormInput["status"], { shouldDirty: true })
          }
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {isEdit ? null : (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
          A sign-in is created automatically: the member signs in with their{" "}
          <strong>member ID</strong> and their <strong>NID</strong> as the password.
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add member"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
