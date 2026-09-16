"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Match only the exact path (used for the dashboard root). */
  exact?: boolean;
  onNavigate?: () => void;
}

export function SidebarItem({
  href,
  icon: Icon,
  label,
  exact,
  onNavigate,
}: SidebarItemProps) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent-soft text-foreground"
          : "text-secondary hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
      ) : null}
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          active ? "text-accent" : "text-muted group-hover:text-foreground",
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
