import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <div className="border-border/70 bg-card/40 rounded-2xl border border-dashed p-10 text-center">
      <span className="bg-muted text-muted-foreground mx-auto mb-3 flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </span>
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
