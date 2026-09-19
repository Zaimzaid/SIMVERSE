"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
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

  if (isImmersiveViewerPath(pathname)) {
    return <main className="min-h-dvh w-full bg-[#030814]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface/50 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <Logo size="md" />
        </div>
        <div className="flex-1 overflow-hidden">
          <SidebarNav permissions={shell.permissions} />
        </div>
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
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <TopBar {...shell} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
