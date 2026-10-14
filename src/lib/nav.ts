import {
  Aperture,
  BarChart3,
  Boxes,
  Clapperboard,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  Sparkles,
  Settings,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  /** If set, the item is only shown to roles holding this permission. */
  permission?: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for platform navigation. Both the desktop sidebar and
 * the mobile drawer render from this. Items may declare a permission; the shell
 * filters them against the current role (never a security boundary on its own —
 * server routes enforce authorization independently).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { label: "Create", href: "/create", icon: Sparkles, permission: "project.create" },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Anything Wars", href: "/anything-wars", icon: Swords, permission: "simulation.view" },
      { label: "Projects", href: "/projects", icon: FolderKanban, permission: "project.view" },
      { label: "Simulations", href: "/simulations", icon: Swords, permission: "simulation.view" },
      { label: "Entities", href: "/entities", icon: Boxes, permission: "entity.view" },
      { label: "Worlds", href: "/worlds", icon: Globe2, permission: "world.view" },
      { label: "Experiences", href: "/experiences", icon: Aperture, permission: "experience.view" },
      { label: "Tournaments", href: "/tournaments", icon: Trophy, permission: "tournament.view" },
    ],
  },
  {
    label: "Library",
    items: [
      { label: "Assets", href: "/assets", icon: Package, permission: "asset.view" },
      { label: "Studio", href: "/studio", icon: Clapperboard, permission: "media.view" },
      { label: "Templates", href: "/templates", icon: LayoutTemplate, permission: "project.view" },
      { label: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Team", href: "/team", icon: Users, permission: "workspace.members.view" },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Flattened list of every navigable item (for lookups / breadcrumbs). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
