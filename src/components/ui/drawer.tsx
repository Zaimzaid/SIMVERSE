"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: React.ReactNode;
  className?: string;
  label?: string;
}

/** Slide-in drawer used for the mobile navigation (and future side panels). */
export function Drawer({
  open,
  onClose,
  side = "left",
  children,
  className,
  label = "Navigation",
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] lg:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "absolute inset-y-0 flex w-[86%] max-w-xs flex-col border-border bg-surface shadow-2xl",
          side === "left"
            ? "left-0 border-r animate-in-left"
            : "right-0 border-l animate-in-right",
          className,
        )}
      >
        {children}
      </div>
      <style>{`
        @keyframes in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-in-left { animation: in-left .22s ease both; }
        .animate-in-right { animation: in-right .22s ease both; }
      `}</style>
    </div>,
    document.body,
  );
}
