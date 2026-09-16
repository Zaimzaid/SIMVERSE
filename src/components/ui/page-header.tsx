import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Consistent page title block used at the top of every platform page. */
export function PageHeader({
  title,
  description,
  icon: Icon,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {Icon ? (
          <span className="mt-0.5 hidden size-11 items-center justify-center rounded-xl border border-border bg-surface text-accent sm:inline-flex">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div>
          {eyebrow ? (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
