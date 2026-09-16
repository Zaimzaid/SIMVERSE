"use client";

import type { Permission } from "@/lib/permissions";
import { NAV_GROUPS } from "@/lib/nav";
import { Logo } from "@/components/brand/logo";
import { SidebarItem } from "@/components/ui/sidebar-item";

interface SidebarNavProps {
  permissions: Permission[];
  onNavigate?: () => void;
  /** Show the logo header (used in the mobile drawer; desktop has its own). */
  withHeader?: boolean;
}

/**
 * The navigation body shared by the desktop sidebar and the mobile drawer.
 * Items are filtered by the current role's permissions (a UX affordance — the
 * server independently authorizes every action).
 */
export function SidebarNav({
  permissions,
  onNavigate,
  withHeader = false,
}: SidebarNavProps) {
  const allowed = new Set(permissions);

  return (
    <div className="flex h-full flex-col">
      {withHeader ? (
        <div className="flex h-16 items-center border-b border-border px-5">
          <Logo size="md" />
        </div>
      ) : null}

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(
            (item) => !item.permission || allowed.has(item.permission),
          );
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <SidebarItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    exact={item.exact}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-5">
        <div className="space-y-0.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          <p>Real Worlds</p>
          <p className="text-secondary">Virtual Worlds</p>
          <p className="text-gradient font-semibold">Endless Possibilities</p>
        </div>
      </div>
    </div>
  );
}
