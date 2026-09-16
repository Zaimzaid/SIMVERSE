"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/** Accessible modal dialog: portal, backdrop, Escape-to-close, scroll lock. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "animate-fade-in relative w-full rounded-2xl border border-border-strong bg-surface-elevated shadow-2xl focus:outline-none",
          SIZES[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-secondary">{description}</p>
            ) : null}
          </div>
          <Button
            variant="icon"
            size="sm"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </Button>
        </div>
        {children ? <div className="px-5 pb-5">{children}</div> : null}
        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-border p-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
