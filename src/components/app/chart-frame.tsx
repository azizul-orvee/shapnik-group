"use client";

import { Suspense, useSyncExternalStore, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const noopSubscribe = () => () => {};

/** True once hydrated, without a setState-in-effect cascade. */
function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Charts render client-side only, inside a fixed-height frame with their own
 * Suspense boundary.
 *
 * Recharts measures its container, so server-rendering it produces markup that
 * cannot match the client. In a production build the chart also lives in a
 * lazily-fetched chunk: re-measuring during a window resize can then suspend
 * while React is handling synchronous input, and without a nearby boundary that
 * takes down the whole page (React error #441 — reproducible by rotating a
 * phone). Mounting on the client behind a local boundary keeps both the
 * suspension and the resize contained, and reserving the height stops the
 * layout jumping.
 */
export function ChartFrame({
  children,
  className = "h-56 w-full sm:h-64",
}: {
  children: ReactNode;
  className?: string;
}) {
  const mounted = useMounted();
  const placeholder = <Skeleton className="size-full rounded-md" />;

  return (
    <div className={className}>
      {mounted ? <Suspense fallback={placeholder}>{children}</Suspense> : placeholder}
    </div>
  );
}
