"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Bookmark, Compass, Plus, UserRound } from "lucide-react";
import { areaForPath, canSeeNavItem } from "@/lib/platform-navigation";
import { NAV_ITEMS } from "@/lib/nav";
import type { Permission } from "@/lib/permissions";
import type { ShellWorkspace } from "./types";

/**
 * A contextual third column for desktop: real routes only, filtered through
 * the same navigation permissions. This is not a notification feed.
 */
export function ContextRail({
  permissions, workspace,
}: {
  permissions: Permission[];
  workspace: ShellWorkspace;
}) {
  const pathname = usePathname();
  const active = areaForPath(pathname);
  const actionRoutesByArea: Record<string, string[]> = {
    home: ["/create", "/earth/geography", "/economy/lab", "/profile"],
    discover: ["/earth/geography", "/worlds", "/entities", "/create"],
    build: ["/create", "/projects", "/assets", "/templates", "/studio"],
    simulations: ["/anything-wars", "/simulations", "/tournaments", "/create"],
    economy: ["/economy/lab", "/profile/career", "/profile/work", "/earth/geography"],
    identity: ["/profile", "/profile/documents", "/profile/career", "/profile/travel"],
  };
  const links = (actionRoutesByArea[active.id] ?? actionRoutesByArea.home!)
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item) => item && canSeeNavItem(item, permissions))
    .slice(0, 4);

  return (
    <aside aria-label="Contextual shortcuts" className="hidden w-[14.5rem] shrink-0 xl:block">
      <div className="sticky top-36 space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-accent">
            <Bookmark className="size-4" aria-hidden />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em]">Quick access</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-secondary">
            Useful destinations in {active.label}.
          </p>
          <div className="mt-4 space-y-1.5">
            {links.map((item) => {
              if (!item) return null;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}
                  className="group flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-sm text-secondary transition hover:border-border hover:bg-surface-hover hover:text-foreground">
                  <Icon className="size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <ArrowUpRight className="size-3.5 text-muted group-hover:text-foreground" aria-hidden />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/75 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted">Workspace</p>
          <p className="mt-2 truncate text-sm font-semibold text-foreground" title={workspace.name}>{workspace.name}</p>
          <p className="mt-2 text-xs leading-relaxed text-secondary">
            Switch areas across the top without losing your work.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {permissions.includes("project.create") && (
              <Link href="/create" className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover">
                <Plus className="size-4" /> Create something
              </Link>
            )}
            <Link href="/earth/geography" className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-secondary hover:bg-surface-hover">
              <Compass className="size-4" /> Enter Earth Explorer
            </Link>
            <Link href="/profile" className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-secondary hover:bg-surface-hover">
              <UserRound className="size-4" /> My profile
            </Link>
          </div>
        </section>
      </div>
    </aside>
  );
}
