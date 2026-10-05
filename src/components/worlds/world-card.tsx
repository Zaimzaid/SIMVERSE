import Link from "next/link";
import { Globe2 } from "lucide-react";
import { WORLD_BIOME_LABELS, WORLD_STATUS_LABELS, type WorldStatus } from "@/lib/worlds/constants";
import type { WorldView } from "@/server/services/world-service";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function worldStatusVariant(status: WorldStatus): BadgeVariant {
  if (status === "RUNTIME_READY") return "success";
  if (status === "VALIDATED") return "accent";
  if (status === "REVIEW" || status === "IN_DESIGN") return "warning";
  if (status === "ARCHIVED") return "neutral";
  return "outline";
}

export function WorldCard({ world, view = "gallery" }: { world: WorldView; view?: "gallery" | "list" }) {
  if (view === "list") return <Link href={`/worlds/${world.id}`} className="block"><Card interactive className="flex items-center gap-4 p-4">
    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Globe2 className="size-5" /></div>
    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{world.name}</p><p className="truncate text-sm text-muted">{WORLD_BIOME_LABELS[world.biome]} · Version {world.currentVersion}</p></div>
    <div className="hidden flex-wrap gap-1 md:flex">{world.tags.slice(0, 3).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>
    <Badge variant={worldStatusVariant(world.status)}>{WORLD_STATUS_LABELS[world.status]}</Badge><time className="hidden text-xs text-muted sm:block">{world.updatedAt.toLocaleDateString()}</time>
  </Card></Link>;
  return <Link href={`/worlds/${world.id}`} className="block h-full"><Card interactive className="flex h-full flex-col overflow-hidden">
    <div className="relative flex aspect-[16/9] items-center justify-center border-b border-border bg-gradient-to-br from-accent-soft to-surface-elevated">
      {world.thumbnailReference ? <img src={world.thumbnailReference} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : <Globe2 className="size-12 text-accent/70" />}
      <Badge variant={worldStatusVariant(world.status)} className="absolute right-3 top-3">{WORLD_STATUS_LABELS[world.status]}</Badge>
    </div>
    <div className="flex flex-1 flex-col gap-3 p-4"><div><p className="font-semibold">{world.name}</p><p className="text-sm text-muted">{WORLD_BIOME_LABELS[world.biome]} · v{world.currentVersion}</p></div>
      {world.description ? <p className="line-clamp-2 text-sm text-secondary">{world.description}</p> : null}
      <div className="mt-auto flex flex-wrap gap-1">{world.tags.slice(0, 4).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>
      <p className="text-xs text-muted">{world.assets.length} Assets · {world.version.blueprint.zones.length} zones · {world.version.blueprint.spawnSets.length} spawn sets</p>
    </div>
  </Card></Link>;
}
