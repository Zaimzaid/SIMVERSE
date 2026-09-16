import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Render as a non-navigating mark (e.g. inside an existing link). */
  asStatic?: boolean;
  href?: string;
  className?: string;
  /** Show the small orbital glyph before the wordmark. */
  showMark?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "text-sm tracking-[0.32em]",
  md: "text-lg tracking-[0.38em]",
  lg: "text-2xl tracking-[0.42em]",
} as const;

const MARK_SIZES = {
  sm: "size-5",
  md: "size-6",
  lg: "size-8",
} as const;

function OrbitalMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <circle cx="12" cy="12" r="3" fill="var(--accent)" />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="4.4"
        stroke="var(--accent)"
        strokeWidth="1.4"
        opacity="0.9"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="4.4"
        stroke="var(--purple)"
        strokeWidth="1.4"
        opacity="0.7"
        transform="rotate(60 12 12)"
      />
    </svg>
  );
}

/** The SIMVERSE wordmark — wide-tracked, gradient, cinematic. */
export function Logo({
  asStatic = false,
  href = "/",
  className,
  showMark = true,
  size = "md",
}: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {showMark ? <OrbitalMark className={MARK_SIZES[size]} /> : null}
      <span
        className={cn(
          "text-gradient font-display font-bold uppercase leading-none",
          SIZES[size],
        )}
      >
        Simverse
      </span>
    </span>
  );

  if (asStatic) return content;

  return (
    <Link href={href} aria-label="SIMVERSE home" className="inline-flex">
      {content}
    </Link>
  );
}
