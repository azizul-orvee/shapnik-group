import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Phone-sized record list. Pair with `DesktopTable` so the spreadsheet stays on `md+`. */
export function MobileList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "divide-border/70 bg-card ring-foreground/10 divide-y overflow-hidden rounded-2xl ring-1 md:hidden",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function DesktopTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hidden overflow-x-auto rounded-lg border md:block", className)}>
      {children}
    </div>
  );
}

export function MobileListItem({
  href,
  title,
  subtitle,
  trailing,
  children,
  className,
}: {
  href?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          {subtitle ? (
            <div className="text-muted-foreground mt-0.5 text-xs leading-snug">{subtitle}</div>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
      </div>
      {children}
    </>
  );

  return (
    <li className={cn("px-4 py-3.5", className)}>
      {href ? (
        <Link href={href} className="block min-h-11">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}
