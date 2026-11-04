import { BrandMark } from "@/components/brand/logo";
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
      <BrandMark className="size-8" animated />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Content-shaped shimmer placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden="true" />;
}
