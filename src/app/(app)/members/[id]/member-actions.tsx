"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { apiRequest, ApiRequestError } from "@/lib/http";

/**
 * Permanently deletes a member — their login, contributions and cash-book rows
 * all go with them. Irreversible, so it asks the admin to re-enter their own
 * password before it will run.
 */
export function DeleteMemberDialog({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    if (!password) {
      setError("Enter your password");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/api/members/${memberId}`, {
        method: "DELETE",
        body: { adminPassword: password },
      });
      toast.success(`${memberName} deleted`);
      setOpen(false);
      router.push("/members");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Could not delete the member",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPassword("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {memberName}?</DialogTitle>
          <DialogDescription>
            This permanently removes {memberName}, their sign-in, and every payment recorded
            for them. This cannot be undone. Enter your admin password to confirm.
          </DialogDescription>
        </DialogHeader>

        <Field id="delete-password" label="Your password" error={error ?? undefined}>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirmDelete();
            }}
          />
        </Field>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={pending || !password}>
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
