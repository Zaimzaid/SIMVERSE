"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { isImmersiveViewerPath } from "@/lib/viewer/immersive";
import { areaForPath, navLabelForPath, visibleAreaItems } from "@/lib/platform-navigation";
import { Drawer } from "@/components/ui/drawer";
import { SidebarNav } from "./sidebar-nav";
import { ContextRail } from "./context-rail";
import { TopBar } from "./top-bar-redesigned";
import type { ShellData } from "./types";

interface PlatformShellProps extends ShellData {
  children: React.ReactNode;
}

/**
 * Workspace-first cockpit.
 * Top: primary areas + role-aware search and user/workspace actions.
 * Left: focused navigation for the current area, not a permanent 25-link list.
 * Right: contextual shortcuts for normal pages (not immersive/map views).
 */
export function PlatformShell({ children, ...shell }: PlatformShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusNavExpanded, setFocusNavExpanded] = useState(false);
  const isMap = pathname === "/earth/geography";
  const isEconomyWorld = /^\/economy\/lab\/[^/]+\/world\/?$/.test(pathname);
  const isFocus = isMap || isEconomyWorld || pathname === "/social";
  const collapsed = isFocus ? !focusNavExpanded : sidebarCollapsed;
  const active = areaForPath(pathname);
  const section = navLabelForPath(pathname);

  if (isImmersiveViewerPath(pathname)) {
    return <main className="min-h-dvh w-full bg-[#030814]">{children}</main>;
  }

  return (
    <div className="simverse-scene-root min-h-screen bg-background"
      data-simverse-area={active.id} data-simverse-focus={isFocus ? "true" : "false"}>
      <div className="simverse-scene-backdrop" aria-hidden="true" />
      <aside aria-label="Desktop section navigation"
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface/95 backdrop-blur lg:flex lg:flex-col ${collapsed ? "w-14" : "w-56"}`}>
        <div className={`flex h-16 shrink-0 items-center border-b border-border ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}>
          {!collapsed && <span className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-secondary">Navigation</span>}
          <button type="button"
            onClick={() => {
              if (isFocus) setFocusNavExpanded((value) => !value);
              else setSidebarCollapsed((value) => !value);
            }}
            aria-label={collapsed ? "Expand section navigation" : "Collapse section navigation"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand section navigation" : "Collapse section navigation"}
            className="inline-flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-hover hover:text-foreground">
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>
        {collapsed ? (
          <nav aria-label="Collapsed navigation" className="flex flex-1 flex-col items-center gap-3 p-2 pt-5">
            <Link href={visibleAreaItems(active, shell.permissions)[0]?.href ?? "/dashboard"} aria-label={`Open ${active.label}`}
              className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <active.icon className="size-5" aria-hidden />
            </Link>
          </nav>
        ) : <SidebarNav permissions={shell.permissions} mode="context" />}
      </aside>

      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <SidebarNav permissions={shell.permissions} mode="all" withHeader
          onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>

      <div className={`relative z-10 flex min-h-screen min-w-0 flex-col transition-[padding-left] duration-200 ${collapsed ? "lg:pl-14" : "lg:pl-56"}`}>
        <TopBar {...shell} onMenuClick={() => setMobileNavOpen(true)} />

        <div className="flex-1 px-4 pb-8 pt-5 sm:px-6 lg:px-7">
          {!isFocus && (
            <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href="/dashboard" className="hover:text-accent">SIMVERSE</Link>
              <ChevronRight className="size-3.5" aria-hidden />
              <span className="font-semibold text-secondary">{active.label}</span>
              <ChevronRight className="size-3.5" aria-hidden />
              <span className="truncate font-medium text-foreground" aria-current="page">{section}</span>
            </nav>
          )}
          <div className={`mx-auto flex w-full min-w-0 items-start gap-6 animate-fade-in ${isFocus ? "max-w-none" : "max-w-[1700px]"}`}>
            <main id="main-content" className="min-w-0 flex-1">
              {children}
            </main>
            {!isFocus && <ContextRail permissions={shell.permissions} workspace={shell.workspace} />}
          </div>
        </div>
      </div>
    </div>
  );
}
