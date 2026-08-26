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
import {
  userCreateSchema,
  type UserCreateInput,
  type UserFormInput,
} from "@/lib/validation";
import { apiRequest, ApiRequestError } from "@/lib/http";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

const ROLES: Role[] = ["ADMIN", "TREASURER", "COMMITTEE", "MEMBER"];

export function NewUserDialog({
  members,
  open,
  onOpenChange,
}: {
  members: Array<{ id: string; name: string; memberId: string }>;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormInput, unknown, UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { name: "", email: "", password: "", role: "COMMITTEE", memberId: "" },
  });

  const role = watch("role");

  async function onSubmit(values: UserCreateInput) {
    try {
      await apiRequest("/api/users", { method: "POST", body: values });
      toast.success("Account created");
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.issues) {
        for (const [field, message] of Object.entries(error.issues)) {
          setError(field as keyof UserFormInput, { message });
        }
      }
      toast.error(error instanceof Error ? error.message : "Could not create the account");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">Add account</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add an account</DialogTitle>
          <DialogDescription>
            Create a login for a committee member, the treasurer, or a member checking their own
            record.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field id="user-name" label="Name" error={errors.name?.message}>
            <Input id="user-name" {...register("name")} />
          </Field>

          <Field id="user-email" label="Email" error={errors.email?.message}>
            <Input id="user-email" type="email" autoComplete="off" {...register("email")} />
          </Field>

          <Field
            id="user-password"
            label="Temporary password"
            error={errors.password?.message}
            hint="At least 8 characters. Share it with them directly."
          >
            <Input
              id="user-password"
              type="text"
              autoComplete="off"
              {...register("password")}
            />
          </Field>

          <Field id="user-role" label="Role" error={errors.role?.message}>
            <Select
              value={role}
              onValueChange={(value) => setValue("role", value as Role, { shouldDirty: true })}
            >
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {role === "MEMBER" ? (
            <Field
              id="user-member"
              label="Linked member"
              error={errors.memberId?.message}
              hint="A member login can only see this member's own record."
            >
              <Select
                value={watch("memberId") || undefined}
                onValueChange={(value) => setValue("memberId", value, { shouldDirty: true })}
              >
                <SelectTrigger id="user-member" className="w-full">
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
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
