import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn’t load this content. Please try again.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger-soft px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl border border-danger/30 bg-surface text-danger">
        <AlertTriangle className="size-6" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
