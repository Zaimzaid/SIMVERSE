import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-14 text-secondary",
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin text-accent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Content-shaped shimmer placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden="true" />;
}
