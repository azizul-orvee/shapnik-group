import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Full-width stacked actions on a phone; a compact row from `sm` up. */
export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:pt-2 [&_[data-slot=button]]:h-11 [&_[data-slot=button]]:w-full sm:[&_[data-slot=button]]:h-8 sm:[&_[data-slot=button]]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
