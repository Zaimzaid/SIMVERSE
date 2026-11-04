import { Logo, BrandMark } from "@/components/brand/logo";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandSplash({
  label = "Preparing your world…",
  overlay = false,
  className,
}: {
  label?: string;
  overlay?: boolean;
  className?: string;
}) {
  return <div role="status" aria-live="polite" aria-label={label}
    className={cn(
      "kavandro-brand-splash flex min-h-[min(65vh,650px)] w-full flex-col items-center justify-center overflow-hidden bg-background px-5 py-14 text-center",
      overlay && "fixed inset-0 z-[110] min-h-dvh backdrop-blur-xl",
      className,
    )}>
    <div className="relative flex size-40 items-center justify-center" aria-hidden="true">
      <span className="kavandro-splash-halo absolute inset-0 rounded-full" />
      <span className="kavandro-splash-orbit absolute inset-2 rounded-full" />
      <span className="kavandro-splash-inner absolute inset-6 rounded-[30px]" />
      <BrandMark className="relative z-10 size-24 drop-shadow-[0_9px_28px_rgba(83,75,255,0.25)]"
        animated />
    </div>
    <div className="mt-4">
      <Logo size="lg" asStatic />
    </div>
    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.23em] text-muted">
      {BRAND_TAGLINE}
    </p>
    <span className="sr-only">{BRAND_NAME} is loading.</span>
    <div className="kavandro-splash-track mt-9 h-[3px] w-44 overflow-hidden rounded-full bg-border" aria-hidden="true">
      <span className="kavandro-splash-progress block h-full w-1/3 rounded-full bg-gradient-to-r from-[#7c3aed] via-[#4f46e5] to-[#2189fb]" />
    </div>
    <p className="mt-5 text-sm font-medium text-secondary">{label}</p>
    <p className="mt-1 text-xs text-muted">A world shaped together.</p>
  </div>;
}
