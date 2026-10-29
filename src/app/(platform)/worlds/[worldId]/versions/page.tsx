import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { isHiddenResourceError } from "@/lib/errors"; import { WORLD_STATUS_LABELS } from "@/lib/worlds/constants";
import { requirePlatformContext } from "@/server/context"; import { getWorld, listWorldVersions } from "@/server/services/world-service";
import { Badge } from "@/components/ui/badge"; import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; import { PageHeader } from "@/components/ui/page-header"; import { worldStatusVariant } from "@/components/worlds/world-card";
export const metadata: Metadata = { title: "World history" };
export default async function WorldVersionsPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params; const { user, workspace } = await requirePlatformContext();
  let world; try { world = await getWorld(user.id, workspace.id, worldId); } catch (error) { if (isHiddenResourceError(error)) notFound(); throw error; }
  const versions = await listWorldVersions(user.id, workspace.id, worldId);
  return <div className="space-y-6"><div><Link href={`/worlds/${world.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />{world.name}</Link><PageHeader icon={Clock3} title="World version history" description="Every snapshot is immutable and remains inspectable." /></div>
    <div className="space-y-4">{versions.map((version) => <Card key={version.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Version {version.version}{version.version === world.currentVersion ? " · Current" : ""}</CardTitle><Badge variant={worldStatusVariant(version.status)}>{WORLD_STATUS_LABELS[version.status]}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><p>{version.changeNote ?? (version.version === 1 ? "Initial version" : "No version note")}</p><div className="grid gap-2 md:grid-cols-3"><p><span className="text-muted">Biome:</span> {version.biome}</p><p><span className="text-muted">Assets:</span> {version.assetAssociations.length}</p><p><span className="text-muted">Entities:</span> {version.entityAssociations.length}</p><p><span className="text-muted">Zones:</span> {version.blueprint.zones.length}</p><p><span className="text-muted">Spawn sets:</span> {version.blueprint.spawnSets.length}</p><p><span className="text-muted">Created:</span> {version.createdAt.toLocaleString()}</p></div><p className="break-all font-mono text-xs text-muted">{version.contentHash}</p><details><summary className="cursor-pointer font-medium">Inspect frozen blueprint</summary><pre className="mt-3 max-h-[32rem] overflow-auto rounded-lg bg-surface-elevated p-4 text-xs">{JSON.stringify({ blueprint: version.blueprint, assets: version.assetAssociations, entities: version.entityAssociations }, null, 2)}</pre></details></CardContent></Card>)}</div>
  </div>;
}
