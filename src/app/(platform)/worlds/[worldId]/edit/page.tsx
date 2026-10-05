import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe2 } from "lucide-react";
import { NotFoundError } from "@/lib/errors"; import { requirePlatformContext } from "@/server/context";
import { listAssets } from "@/server/services/asset-service"; import { listEntities } from "@/server/services/entity-service"; import { getWorld } from "@/server/services/world-service";
import { PageHeader } from "@/components/ui/page-header"; import { EmptyState } from "@/components/ui/empty-state"; import { buttonClasses } from "@/components/ui/button"; import { WorldForm } from "@/components/worlds/world-form"; import { worldToFormInitial } from "@/components/worlds/world-form-model";
export const metadata: Metadata = { title: "Edit World" };
export default async function EditWorldPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params; const { user, workspace, permissions } = await requirePlatformContext();
  let world; try { world = await getWorld(user.id, workspace.id, worldId); } catch (error) { if (error instanceof NotFoundError) notFound(); throw error; }
  if (!permissions.includes("world.manage") || world.status === "ARCHIVED") return <div className="space-y-6"><PageHeader icon={Globe2} title="Edit World" description={`Update ${world.name}.`} /><EmptyState icon={Globe2} title={world.status === "ARCHIVED" ? "Restore this World to edit it" : "You can’t edit this World"} description={world.status === "ARCHIVED" ? "Archived Worlds are read-only until restored." : "Your role does not include World management."} action={<Link href={`/worlds/${world.id}`} className={buttonClasses({ variant: "secondary" })}>Back to World</Link>} /></div>;
  const [assets, entities] = await Promise.all([listAssets(user.id, workspace.id, { status: "CURRENT", pageSize: 100, sort: "name_asc" }), listEntities(user.id, workspace.id, { status: "ACTIVE", pageSize: 100, sort: "name_asc" })]);
  const assetChoices: { id: string; name: string; detail: string; currentVersion: number; type: string }[] = assets.items.map((asset) => ({ id: asset.id, name: asset.name, detail: `${asset.type} · v${asset.currentVersion}`, currentVersion: asset.currentVersion, type: asset.type }));
  for (const linked of world.assets) if (!assetChoices.some((asset) => asset.id === linked.assetId)) assetChoices.unshift({ id: linked.assetId, name: linked.assetName, detail: `${linked.assetType} · v${linked.assetVersion}`, currentVersion: linked.assetVersion, type: linked.assetType });
  const entityChoices = entities.items.map((entity) => ({ id: entity.id, name: entity.name, detail: entity.category }));
  for (const linked of world.entities) if (!entityChoices.some((entity) => entity.id === linked.entityId)) entityChoices.unshift({ id: linked.entityId, name: linked.entityName, detail: linked.entityCategory });
  return <div className="space-y-6"><div><Link href={`/worlds/${world.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />{world.name}</Link><PageHeader icon={Globe2} title="Edit World" description="Saving creates a new immutable World version." /></div><WorldForm mode="edit" initial={worldToFormInitial(world)} assets={assetChoices} entities={entityChoices} /></div>;
}
