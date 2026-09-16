import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Marks the area as planned functionality rather than a true empty list. */
  futurePhase?: boolean;
  className?: string;
}

/**
 * Empty / placeholder state. Used both for genuinely empty lists and for
 * sections whose functionality arrives in a later phase (futurePhase).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  futurePhase,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="relative mb-5 inline-flex size-14 items-center justify-center rounded-2xl border border-border bg-surface text-accent">
        <Icon className="size-6" />
        <span className="absolute inset-0 -z-10 rounded-2xl bg-accent/10 blur-lg" />
      </span>
      {futurePhase ? (
        <Badge variant="accent" className="mb-3">
          Coming in a future phase
        </Badge>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
