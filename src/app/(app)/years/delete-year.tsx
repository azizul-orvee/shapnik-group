"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/http";

export function DeleteYearButton({ year }: { year: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm(`Remove ${year}? You can only do this if no payments are recorded for it.`)) {
      return;
    }
    setPending(true);
    try {
      await apiRequest(`/api/years/${year}`, { method: "DELETE" });
      toast.success(`${year} removed`);
      router.push("/years");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the year");
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onDelete} disabled={pending}>
      {pending ? "Removing…" : "Remove year"}
    </Button>
  );
}
