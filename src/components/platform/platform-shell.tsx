"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Globe2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { isImmersiveViewerPath } from "@/lib/viewer/immersive";
import { Logo } from "@/components/brand/logo";
import { Drawer } from "@/components/ui/drawer";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import type { ShellData } from "./types";

interface PlatformShellProps extends ShellData {
  children: React.ReactNode;
}

/** The authenticated app frame: fixed sidebar + top bar + scrollable main. */
export function PlatformShell({ children, ...shell }: PlatformShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const isEarthMap = pathname === "/earth/geography";
  const [earthSidebarExpanded, setEarthSidebarExpanded] = useState(false);
  const showDesktopSidebar = !isEarthMap || earthSidebarExpanded;

  if (isImmersiveViewerPath(pathname)) {
    return <main className="min-h-dvh w-full bg-[#030814]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface/90 backdrop-blur lg:flex ${showDesktopSidebar ? "w-64" : "w-14"}`}>
        {showDesktopSidebar ? (
          <>
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <Logo size="md" />
              {isEarthMap ? (
                <button type="button" onClick={() => setEarthSidebarExpanded(false)}
                  aria-label="Collapse platform navigation" title="Focus on Earth map"
                  className="rounded-lg p-2 text-secondary transition hover:bg-surface-hover hover:text-foreground">
                  <PanelLeftClose className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="flex-1 overflow-hidden">
              <SidebarNav permissions={shell.permissions} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 p-2 pt-4">
            <button type="button" onClick={() => setEarthSidebarExpanded(true)}
              aria-label="Expand platform navigation" title="Expand full SIMVERSE navigation"
              className="rounded-lg border border-border bg-surface p-2 text-secondary transition hover:text-accent"
              data-earth-platform-nav="collapsed">
              <PanelLeftOpen className="size-5" aria-hidden />
            </button>
            <Link href="/earth/geography" aria-label="Earth map"
              className="rounded-lg bg-accent-soft p-2 text-accent">
              <Globe2 className="size-5" aria-hidden />
            </Link>
          </div>
        )}
      </aside>

      {/* Mobile navigation drawer */}
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <SidebarNav
          permissions={shell.permissions}
          withHeader
          onNavigate={() => setMobileNavOpen(false)}
        />
      </Drawer>

      {/* Main column */}
      <div className={`flex min-w-0 flex-1 flex-col ${showDesktopSidebar ? "lg:pl-64" : "lg:pl-14"}`}>
        <TopBar {...shell} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className={`mx-auto w-full animate-fade-in ${isEarthMap ? "max-w-none" : "max-w-6xl"}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}
