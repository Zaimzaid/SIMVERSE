import type { Metadata } from "next";
import Link from "next/link";
import { Globe2, Plus } from "lucide-react";
import { WORLD_BIOMES, WORLD_SORTS, WORLD_STATUS_FILTERS, type WorldBiome, type WorldSort, type WorldStatusFilter } from "@/lib/worlds/constants";
import { requirePlatformContext } from "@/server/context";
import { listWorlds, listWorldTags } from "@/server/services/world-service";
import { PageHeader } from "@/components/ui/page-header"; import { EmptyState } from "@/components/ui/empty-state"; import { buttonClasses } from "@/components/ui/button";
import { WorldLibraryControls } from "@/components/worlds/world-library-controls"; import { WorldCard } from "@/components/worlds/world-card"; import { WorldPagination } from "@/components/worlds/world-pagination";

export const metadata: Metadata = { title: "Worlds" };
type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""; }
export default async function WorldsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("world.view")) return <div className="space-y-6"><PageHeader icon={Globe2} title="Worlds" description="Versioned environment blueprints." /><EmptyState icon={Globe2} title="No access to Worlds" description="Your role does not include World Library access." /></div>;
  const sp = await searchParams; const search = first(sp.q); const category = first(sp.category); const tag = first(sp.tag);
  const biomeRaw = first(sp.biome).toUpperCase(); const biome = (WORLD_BIOMES as readonly string[]).includes(biomeRaw) ? biomeRaw as WorldBiome : "";
  const statusRaw = first(sp.status).toUpperCase(); const status = (WORLD_STATUS_FILTERS as readonly string[]).includes(statusRaw) ? statusRaw as WorldStatusFilter : "CURRENT";
  const sortRaw = first(sp.sort); const sort = (WORLD_SORTS as readonly string[]).includes(sortRaw) ? sortRaw as WorldSort : "updated_desc";
  const view = first(sp.view) === "list" ? "list" as const : "gallery" as const; const page = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);
  const [result, tags] = await Promise.all([listWorlds(user.id, workspace.id, { search, category, tag, biome: biome || undefined, status, sort, page }), listWorldTags(user.id, workspace.id)]);
  const hrefForPage = (nextPage: number) => { const query = new URLSearchParams(); if (search) query.set("q", search); if (category) query.set("category", category); if (tag) query.set("tag", tag); if (biome) query.set("biome", biome); if (status !== "CURRENT") query.set("status", status); if (sort !== "updated_desc") query.set("sort", sort); if (view === "list") query.set("view", "list"); if (nextPage > 1) query.set("page", String(nextPage)); return query.size ? `/worlds?${query}` : "/worlds"; };
  const canManage = permissions.includes("world.manage"); const filtered = search || category || tag || biome || status !== "CURRENT";
  return <div className="space-y-6"><PageHeader icon={Globe2} title="Worlds" description="Versioned, engine-neutral environment blueprints for simulations and future runtime consumers." actions={canManage ? <Link href="/worlds/new" className={buttonClasses()}><Plus className="size-4" />Create World</Link> : undefined} />
    {result.total === 0 && !filtered ? <EmptyState icon={Globe2} title="No Worlds yet" description="Create a structured environment blueprint without generating or rendering a 3D world." action={canManage ? <Link href="/worlds/new" className={buttonClasses()}><Plus className="size-4" />Create your first World</Link> : undefined} /> : <>
      <WorldLibraryControls tags={tags} current={{ search, biome, category, status, tag, sort, view }} />
      {result.items.length ? <div className={view === "gallery" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>{result.items.map((world) => <WorldCard key={world.id} world={world} view={view} />)}</div> : <EmptyState icon={Globe2} title="No Worlds match these filters" description="Clear or adjust the search and filters." />}
      <WorldPagination page={result.page} pageCount={result.pageCount} total={result.total} hrefForPage={hrefForPage} />
    </>}
  </div>;
}
