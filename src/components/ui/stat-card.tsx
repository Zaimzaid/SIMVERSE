import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Neutral helper text (e.g. "No projects yet"). No fabricated metrics. */
  hint?: string;
  className?: string;
}

/** A single dashboard metric. Values are always real (0 when empty). */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between">
        <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-background/50 text-accent">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-secondary">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
