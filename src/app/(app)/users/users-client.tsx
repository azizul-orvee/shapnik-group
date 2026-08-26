"use client";

import { useState } from "react";
import { NewUserDialog } from "./user-form";

/** Owns the dialog's open state so the server page can stay a Server Component. */
export function AddUserButton({
  members,
}: {
  members: Array<{ id: string; name: string; memberId: string }>;
}) {
  const [open, setOpen] = useState(false);
  return <NewUserDialog members={members} open={open} onOpenChange={setOpen} />;
}
