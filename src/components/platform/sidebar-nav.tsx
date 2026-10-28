"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { Logo } from "@/components/brand/logo";
import { SidebarItem } from "@/components/ui/sidebar-item";
import { areaForPath, visibleAreas } from "@/lib/platform-navigation";

interface SidebarNavProps {
  permissions: Permission[];
  onNavigate?: () => void;
  withHeader?: boolean;
  /** Desktop shows the active area, mobile drawer shows every area. */
  mode?: "context" | "all";
}

export function SidebarNav({
  permissions, onNavigate, withHeader = false, mode = "all",
}: SidebarNavProps) {
  const pathname = usePathname();
  const areas = visibleAreas(permissions);
  const active = areaForPath(pathname);
  const shown = mode === "context"
    ? areas.filter((area) => area.id === active.id)
    : areas;
  // A role can see some pages but not the requested area's links.
  const groups = shown.length ? shown : areas.slice(0, 1);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {withHeader ? (
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <Logo href="/dashboard" size="md" />
        </div>
      ) : null}
      {mode === "context" && (
        <div className="border-b border-border px-4 pb-4 pt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Current space</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-xl border border-accent/20 bg-accent-soft p-2.5 text-accent">
              <active.icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{active.label}</p>
              <p className="line-clamp-2 text-xs text-muted">{active.description}</p>
            </div>
          </div>
        </div>
      )}
      <nav aria-label={mode === "context" ? "Section navigation" : "All SIMVERSE navigation"}
        className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.id}>
            {mode === "all" && (
              <div className="flex items-center justify-between px-3 pb-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group.label}</p>
                <ChevronRight className="size-3.5 text-muted" aria-hidden />
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem key={item.href} href={item.href}
                  icon={item.icon} label={item.label}
                  exact={item.exact} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
        {mode === "context" && (
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="text-xs font-semibold text-foreground">Need another area?</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Use the main navigation along the top to switch spaces.
            </p>
            <Link href="/dashboard" onClick={onNavigate}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              All areas <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        )}
      </nav>
      <div className="shrink-0 border-t border-border px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          One universe · Many possibilities
        </p>
      </div>
    </div>
  );
}
