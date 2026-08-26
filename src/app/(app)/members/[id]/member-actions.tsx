"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/http";
import type { MemberStatus } from "@/generated/prisma/enums";

/** Deactivate / reactivate. Members are never deleted — the books need them. */
export function MemberStatusToggle({
  memberId,
  status,
}: {
  memberId: string;
  status: MemberStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const next: MemberStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  async function toggle() {
    setPending(true);
    try {
      await apiRequest(`/api/members/${memberId}`, {
        method: "PATCH",
        body: { status: next },
      });
      toast.success(next === "ACTIVE" ? "Member reactivated" : "Member deactivated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the member");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={status === "ACTIVE" ? "outline" : "default"}
      size="sm"
      onClick={toggle}
      disabled={pending}
    >
      {status === "ACTIVE" ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
