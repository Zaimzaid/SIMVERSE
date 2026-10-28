"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Check,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sun,
  UserRound,
} from "lucide-react";
import { ROLE_META } from "@/lib/permissions";
import { apiFetch } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import type { ShellData } from "./types";

interface TopBarProps extends ShellData {
  onMenuClick: () => void;
}

export function TopBar({
  user,
  workspace,
  workspaces,
  role,
  onMenuClick,
}: TopBarProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const { error } = await apiFetch("/api/auth/logout", { method: "POST" });
    if (error) {
      setLoggingOut(false);
      toast({ variant: "error", title: "Couldn’t log out", description: error.message });
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  async function switchWorkspace(id: string) {
    if (id === workspace.id) return;
    const { error } = await apiFetch("/api/workspaces/active", {
      method: "POST",
      body: JSON.stringify({ workspaceId: id }),
    });
    if (error) {
      toast({ variant: "error", title: "Couldn’t switch workspace", description: error.message });
      return;
    }
    router.refresh();
  }

  const comingSoon = () =>
    toast({ variant: "info", title: "Coming soon", description: "This arrives in a future phase." });

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
      <Button
        variant="icon"
        size="sm"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      {/* Workspace selector */}
      <Dropdown
        align="start"
        trigger={({ toggle, open, id }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={id}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-hover"
          >
            <Avatar name={workspace.name} size="sm" />
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-[9rem] truncate text-sm font-semibold text-foreground">
                {workspace.name}
              </span>
              <span className="block text-xs text-muted">{ROLE_META[role].label}</span>
            </span>
          </button>
        )}
      >
        <DropdownLabel>Workspaces</DropdownLabel>
        {workspaces.map((ws) => (
          <DropdownItem key={ws.id} onClick={() => switchWorkspace(ws.id)}>
            <Avatar name={ws.name} size="sm" />
            <span className="flex-1 truncate">{ws.name}</span>
            {ws.id === workspace.id ? <Check className="size-4 text-accent" /> : null}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem onClick={comingSoon}>
          <Plus className="size-4" />
          New workspace
        </DropdownItem>
      </Dropdown>

      {/* Search (placeholder — opens nothing yet) */}
      <button
        type="button"
        onClick={comingSoon}
        className="ml-1 hidden h-9 max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted transition-colors hover:border-accent/30 hover:text-secondary md:flex"
      >
        <Search className="size-4" />
        <span>Search worlds, entities, projects…</span>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip content="Search" side="bottom" className="md:hidden">
          <Button variant="icon" size="sm" onClick={comingSoon} aria-label="Search">
            <Search className="size-5" />
          </Button>
        </Tooltip>

        <Tooltip content={theme === "dark" ? "Light mode" : "Dark mode"} side="bottom">
          <Button variant="icon" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </Tooltip>

        <Tooltip content="Help" side="bottom">
          <Button variant="icon" size="sm" onClick={comingSoon} aria-label="Help">
            <HelpCircle className="size-5" />
          </Button>
        </Tooltip>

        {/* Notifications */}
        <Dropdown
          menuClassName="w-80"
          trigger={({ toggle, open, id }) => (
            <button
              type="button"
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={id}
              aria-label="Notifications"
              className="inline-flex size-9 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Bell className="size-5" />
            </button>
          )}
        >
          <DropdownLabel>Notifications</DropdownLabel>
          <div className="p-1" onClick={(e) => e.stopPropagation()}>
            <EmptyState
              icon={Bell}
              title="You’re all caught up"
              description="Activity and alerts will appear here."
              className="border-none bg-transparent py-8"
            />
          </div>
        </Dropdown>

        {/* User menu */}
        <Dropdown
          trigger={({ toggle, open, id }) => (
            <button
              type="button"
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={id}
              className="ml-1 rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Account menu"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
            </button>
          )}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.displayName}
              </p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <DropdownSeparator />
          <Link href="/profile">
            <DropdownItem>
              <UserRound className="size-4" />
              My player profile
            </DropdownItem>
          </Link>
          <Link href="/settings">
            <DropdownItem>
              <SettingsIcon className="size-4" />
              Workspace settings
            </DropdownItem>
          </Link>
          <DropdownSeparator />
          <DropdownItem
            destructive
            onClick={handleLogout}
            className={cn(loggingOut && "pointer-events-none opacity-60")}
          >
            <LogOut className="size-4" />
            {loggingOut ? "Logging out…" : "Log out"}
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
