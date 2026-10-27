"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight, Check, ChevronsUpDown, Command, LayoutDashboard, LogOut,
  Menu, Moon, Plus, Search, Settings as SettingsIcon, Sun, UserRound, X,
} from "lucide-react";
import { ROLE_META } from "@/lib/permissions";
import { apiFetch } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { visibleAreas, areaForPath } from "@/lib/platform-navigation";
import { useTheme } from "@/components/theme/theme-provider";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import type { ShellData } from "./types";

interface TopBarProps extends ShellData {
  onMenuClick: () => void;
}

export function TopBar({
  user, workspace, workspaces, role, permissions, onMenuClick,
}: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const areas = useMemo(() => visibleAreas(permissions), [permissions]);
  const area = areaForPath(pathname);
  const canCreate = permissions.includes("project.create");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (searchOpen && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!searchOpen && dialog.open) {
      dialog.close();
    }
  }, [searchOpen]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

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
      method: "POST", body: JSON.stringify({ workspaceId: id }),
    });
    if (error) {
      toast({ variant: "error", title: "Couldn’t switch workspace", description: error.message });
      return;
    }
    router.refresh();
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = areas.flatMap((section) =>
    section.items.filter((item) => !normalizedQuery ||
      [item.label, section.label, item.href].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      )).map((item) => ({ ...item, areaLabel: section.label })),
  );

  function navigate(href: string) {
    setSearchOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-3 sm:px-5 xl:px-7">
          <button type="button" onClick={onMenuClick} aria-label="Open all navigation"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-secondary transition hover:bg-surface-hover hover:text-foreground lg:hidden">
            <Menu className="size-5" aria-hidden />
          </button>

          <Logo href="/dashboard" size="sm" className="hidden sm:inline-flex" />

          <div className="hidden h-7 w-px bg-border sm:block" aria-hidden />

          <Dropdown align="start"
            trigger={({ toggle, open, id }) => (
              <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open}
                aria-controls={id} aria-label={`Workspace: ${workspace.name}`}
                className="flex min-w-0 max-w-[12rem] items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-left hover:border-accent/40 hover:bg-surface-hover sm:max-w-[15rem]">
                <Avatar name={workspace.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground sm:text-sm">{workspace.name}</span>
                  <span className="hidden text-[11px] text-muted sm:block">{ROLE_META[role].label}</span>
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-muted" aria-hidden />
              </button>
            )}
          >
            <DropdownLabel>Switch workspace</DropdownLabel>
            {workspaces.map((ws) => (
              <DropdownItem key={ws.id} onClick={() => void switchWorkspace(ws.id)}>
                <Avatar name={ws.name} size="sm" />
                <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                {ws.id === workspace.id ? <Check className="size-4 text-accent" /> : null}
              </DropdownItem>
            ))}
          </Dropdown>

          <button type="button" onClick={() => setSearchOpen(true)}
            aria-label="Search SIMVERSE navigation"
            className="ml-auto inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-muted transition hover:border-accent/40 hover:text-foreground md:ml-3 md:w-full md:max-w-sm md:justify-start">
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="hidden truncate text-sm md:inline">Search pages and tools</span>
            <kbd className="ml-auto hidden rounded-md border border-border-strong px-1.5 py-0.5 text-[10px] lg:inline">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:ml-auto">
            {canCreate && (
              <Link href="/create" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-accent-foreground hover:bg-accent-hover">
                <Plus className="size-4" aria-hidden />
                <span className="hidden sm:inline">Create</span>
                <span className="sr-only sm:hidden">Create</span>
              </Link>
            )}
            <button type="button" onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
              className="inline-flex size-9 items-center justify-center rounded-xl text-secondary hover:bg-surface-hover hover:text-foreground">
              {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </button>
            <Dropdown align="end" trigger={({ toggle, open, id }) => (
              <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open}
                aria-controls={id} aria-label="Open account menu"
                className="rounded-full border-2 border-border p-0.5 hover:border-accent/60">
                <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
              </button>
            )}>
              <div className="flex items-center gap-3 px-3 py-3">
                <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{user.displayName}</p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
              </div>
              <DropdownSeparator />
              <Link href="/profile"><DropdownItem><UserRound className="size-4" /> My player profile</DropdownItem></Link>
              <Link href="/settings"><DropdownItem><SettingsIcon className="size-4" /> Settings</DropdownItem></Link>
              <Link href="/dashboard"><DropdownItem><LayoutDashboard className="size-4" /> Dashboard</DropdownItem></Link>
              <DropdownSeparator />
              <DropdownItem destructive onClick={() => void handleLogout()}
                className={cn(loggingOut && "pointer-events-none opacity-60")}>
                <LogOut className="size-4" /> {loggingOut ? "Logging out…" : "Log out"}
              </DropdownItem>
            </Dropdown>
          </div>
        </div>

        <nav aria-label="Primary SIMVERSE areas"
          className="flex items-center gap-1 overflow-x-auto border-t border-border/80 px-3 [scrollbar-width:none] sm:px-5 xl:px-7">
          {areas.map((section) => {
            const active = section.id === area.id;
            const Icon = section.icon;
            const href = section.items[0]?.href ?? "/dashboard";
            return (
              <Link key={section.id} href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-3 text-xs font-semibold transition sm:text-sm",
                  active ? "bg-accent-soft/70 text-accent" : "text-secondary hover:bg-surface-hover hover:text-foreground",
                )}>
                <Icon className="size-4" aria-hidden />
                {section.label}
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>
      </header>

      <dialog ref={dialogRef} onClose={() => setSearchOpen(false)}
        onClick={(event) => { if (event.target === dialogRef.current) setSearchOpen(false); }}
        aria-label="Search SIMVERSE pages" className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/65">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Search className="size-5 shrink-0 text-accent" aria-hidden />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Search areas, pages and tools…"
            aria-label="Search available navigation"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted" />
          <button type="button" onClick={() => setSearchOpen(false)}
            aria-label="Close search" className="rounded-lg p-1.5 text-secondary hover:bg-surface-hover">
            <X className="size-5" />
          </button>
        </div>
        <nav className="max-h-[60vh] overflow-y-auto p-2" aria-label="Search results">
          {results.length ? results.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.href} type="button" onClick={() => navigate(item.href)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-surface-hover">
                <span className="rounded-lg bg-accent-soft p-2 text-accent"><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted">{item.areaLabel}</span>
                </span>
                <ArrowRight className="size-4 text-muted" />
              </button>
            );
          }) : <p className="p-6 text-center text-sm text-muted">No available pages match “{query}”.</p>}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted">
          <Command className="size-3.5" /> Search only shows tools available to your workspace role.
        </div>
      </dialog>
    </>
  );
}
