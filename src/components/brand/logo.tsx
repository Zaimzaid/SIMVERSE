import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";

interface LogoProps {
  /** Render as a non-navigating mark, e.g. inside another Link. */
  asStatic?: boolean;
  href?: string;
  className?: string;
  /** False is retained for legacy wordmark-only call sites. */
  showMark?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "h-[26px] w-[150px]",
  md: "h-[32px] w-[184px]",
  lg: "h-[45px] w-[260px]",
} as const;

/**
 * The approved geometric K + KAVANDRO wordmark. Exact silhouette traced from
 * the official brand image and presented in official navy / white variants.
 * The legacy orbital mark is deliberately retired.
 */
export function Logo({
  asStatic = false, href = "/", className,
  showMark = true, size = "md",
}: LogoProps) {
  const artwork = showMark ? (
    <span role="img" aria-label={BRAND_NAME}
      className={cn("relative inline-block shrink-0 align-middle", SIZES[size], className)}>
      <Image src="/brand/kavandro-logo-dark.svg" alt="" aria-hidden="true"
        width={1800} height={320} unoptimized priority={size === "lg"}
        className="kavandro-wordmark-dark absolute inset-0 size-full object-contain object-left" />
      <Image src="/brand/kavandro-logo-light.svg" alt="" aria-hidden="true"
        width={1800} height={320} unoptimized priority={size === "lg"}
        className="kavandro-wordmark-light absolute inset-0 size-full object-contain object-left" />
    </span>
  ) : (
    <span className={cn("font-display font-bold tracking-[0.14em] text-foreground", className)}>
      {BRAND_NAME}
    </span>
  );
  if (asStatic) return artwork;
  return <Link href={href} aria-label={BRAND_NAME + " home"}
    className="inline-flex shrink-0 items-center">{artwork}</Link>;
}

/** Stand-alone K emblem for loading, compact controls and branded avatars. */
export function BrandMark({ className, animated = false }: {
  className?: string;
  animated?: boolean;
}) {
  return <span role="img" aria-label={BRAND_NAME}
    className={cn("relative inline-block shrink-0", animated && "kavandro-mark-float", className)}>
    <Image src="/brand/kavandro-mark-light.svg" alt="" aria-hidden="true"
      width={365} height={320} unoptimized
      className="kavandro-wordmark-dark absolute inset-0 size-full object-contain object-center" />
    <Image src="/brand/kavandro-mark.svg" alt="" aria-hidden="true"
      width={365} height={320} unoptimized
      className="kavandro-wordmark-light absolute inset-0 size-full object-contain object-center" />
  </span>;
}
