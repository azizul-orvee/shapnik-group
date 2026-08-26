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
        toast.success("Member added");
        router.push(`/members/${member.id}`);
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

      <Field id="phone" label="Phone" error={errors.phone?.message} hint="Optional.">
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />
      </Field>

      <Field id="joinDate" label="Join date" error={errors.joinDate?.message}>
        <Input id="joinDate" type="date" {...register("joinDate")} />
      </Field>

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
