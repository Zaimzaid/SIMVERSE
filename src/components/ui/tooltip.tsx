"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "right";
  className?: string;
}

/** Lightweight hover/focus tooltip (CSS-positioned, no dependencies). */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const id = useId();

  const position =
    side === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
      : side === "bottom"
        ? "top-full left-1/2 -translate-x-1/2 mt-2"
        : "left-full top-1/2 -translate-y-1/2 ml-2";

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      aria-describedby={show ? id : undefined}
    >
      {children}
      {show ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "animate-fade-in pointer-events-none absolute z-[120] whitespace-nowrap rounded-md border border-border-strong bg-surface-elevated px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xl",
            position,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
