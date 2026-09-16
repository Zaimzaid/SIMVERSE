"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface DropdownProps {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    id: string;
  }) => React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  /** Menu width in the horizontal direction. */
  menuClassName?: string;
}

/** Click-triggered popover menu with outside-click + Escape dismissal. */
export function Dropdown({
  trigger,
  children,
  align = "end",
  className,
  menuClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v), id })}
      {open ? (
        <div
          id={id}
          role="menu"
          className={cn(
            "animate-fade-in absolute z-50 mt-2 min-w-52 overflow-hidden rounded-xl border border-border-strong bg-surface-elevated p-1.5 shadow-2xl",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface DropdownItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

export function DropdownItem({
  className,
  destructive,
  children,
  ...props
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        destructive
          ? "text-danger hover:bg-danger-soft"
          : "text-secondary hover:bg-surface-hover hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </p>
  );
}

export function DropdownSeparator() {
  return <div className="my-1.5 h-px bg-border" role="separator" />;
}
