import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-surface-hover text-secondary border border-border",
  accent: "bg-accent-soft text-accent border border-accent/25",
  success: "bg-success-soft text-success border border-success/25",
  warning: "bg-warning-soft text-warning border border-warning/25",
  danger: "bg-danger-soft text-danger border border-danger/25",
  outline: "bg-transparent text-secondary border border-border-strong",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
