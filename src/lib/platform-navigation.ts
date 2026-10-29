import {
  Compass, Hammer, House, Layers3, UserRound, WalletCards, MessagesSquare,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";

export interface PlatformArea {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Explicit ordering: top primary navigation and contextual left sidebar. */
  routes: readonly string[];
}

export const PLATFORM_AREAS: readonly PlatformArea[] = [
  {
    id: "home", label: "Home", description: "Your overview and workspace",
    icon: House, routes: ["/dashboard", "/analytics", "/team", "/settings"],
  },
  {
    id: "discover", label: "Explore", description: "Discover worlds and places",
    icon: Compass, routes: ["/earth/geography", "/worlds", "/entities", "/experiences"],
  },
  {
    id: "build", label: "Build", description: "Create and manage content",
    icon: Hammer, routes: ["/create", "/projects", "/assets", "/studio", "/animation", "/templates"],
  },
  {
    id: "simulations", label: "Play & Simulate", description: "Launch interactive experiences",
    icon: Layers3, routes: ["/simulations", "/anything-wars", "/tournaments"],
  },
  {
    id: "economy", label: "Economy", description: "Businesses and virtual careers",
    icon: WalletCards, routes: ["/economy/lab", "/profile/career", "/profile/work"],
  },
  {
    id: "marketplace", label: "Marketplace", description: "Discover and share creator assets",
    icon: Store, routes: ["/marketplace"],
  },
  {
    id: "community", label: "Community", description: "Your friends and private conversations",
    icon: MessagesSquare, routes: ["/social"],
  },
  {
    id: "identity", label: "My Life", description: "Your player identity and documents",
    icon: UserRound, routes: ["/profile", "/profile/documents", "/profile/travel"],
  },
] as const;

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function canSeeNavItem(item: NavItem, permissions: readonly Permission[]): boolean {
  return !item.permission || permissions.includes(item.permission);
}

export function visibleAreaItems(area: PlatformArea, permissions: readonly Permission[]): NavItem[] {
  return area.routes
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item) && canSeeNavItem(item!, permissions));
}

export function visibleAreas(permissions: readonly Permission[]) {
  return PLATFORM_AREAS
    .map((area) => ({ ...area, items: visibleAreaItems(area, permissions) }))
    .filter((area) => area.items.length > 0);
}

/** Longest route wins; /profile/career is Economy, not My Life. */
export function areaForPath(pathname: string): PlatformArea {
  const entries = PLATFORM_AREAS.flatMap((area) =>
    area.routes.map((href) => ({ area, href })));
  const best = entries
    .filter((item) => matches(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return best?.area ?? PLATFORM_AREAS[0]!;
}

/** Use the actual visible current page label when available. */
export function navLabelForPath(pathname: string): string {
  const match = NAV_ITEMS
    .filter((item) => matches(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "SIMVERSE";
}
