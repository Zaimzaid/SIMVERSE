import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aperture, ArrowLeft } from "lucide-react";
import { isHiddenResourceError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { listAssets } from "@/server/services/asset-service";
import { listEntities } from "@/server/services/entity-service";
import { getWorldVersion, listWorlds } from "@/server/services/world-service";
import { getExperienceProfile } from "@/server/services/experience-profile-service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { ExperienceForm } from "@/components/experiences/experience-form";
import { experienceToFormInitial } from "@/components/experiences/experience-form-model";

export const metadata: Metadata = { title: "Edit Experience Profile" };
export default async function EditExperiencePage({ params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params; const { user, workspace, permissions } = await requirePlatformContext();
  let profile; try { profile = await getExperienceProfile(user.id, workspace.id, experienceId); } catch (error) { if (isHiddenResourceError(error)) notFound(); throw error; }
  if (!permissions.includes("experience.manage") || profile.status === "ARCHIVED") return <div className="space-y-6"><PageHeader icon={Aperture} title="Edit Experience Profile" description={`Update ${profile.name}.`} /><EmptyState icon={Aperture} title={profile.status === "ARCHIVED" ? "Restore this Profile to edit it" : "You can’t edit this Profile"} description={profile.status === "ARCHIVED" ? "Archived Profiles are read-only until restored." : "Your role does not include Experience Profile management."} action={<Link href={`/experiences/${profile.id}`} className={buttonClasses({ variant: "secondary" })}>Back to Profile</Link>} /></div>;
  const [assetResult, entityResult, worldResult] = await Promise.all([listAssets(user.id, workspace.id, { status: "CURRENT", pageSize: 100, sort: "name_asc" }), listEntities(user.id, workspace.id, { status: "ACTIVE", pageSize: 100, sort: "name_asc" }), listWorlds(user.id, workspace.id, { status: "CURRENT", pageSize: 100, sort: "name_asc" })]);
  const assets: { id: string; name: string; type: string; currentVersion: number }[] = assetResult.items.map((asset) => ({ id: asset.id, name: asset.name, type: asset.type, currentVersion: asset.currentVersion }));
  for (const linked of profile.assets) if (!assets.some((asset) => asset.id === linked.assetId)) assets.unshift({ id: linked.assetId, name: linked.assetName, type: linked.assetType, currentVersion: linked.assetVersion });
  const entities = entityResult.items.map((entity) => ({ id: entity.id, name: entity.name, category: entity.category }));
  for (const linked of profile.entities) if (!entities.some((entity) => entity.id === linked.entityId)) entities.unshift({ id: linked.entityId, name: linked.entityName, category: linked.entityCategory });
  const worlds = worldResult.items.map((world) => ({ worldId: world.id, worldName: world.name, version: world.currentVersion, zones: world.version.blueprint.zones.map((zone) => ({ identifier: zone.identifier, name: zone.name, type: zone.type })) }));
  for (const linked of profile.worlds) if (!worlds.some((world) => world.worldId === linked.worldId && world.version === linked.worldVersion)) { const version = await getWorldVersion(user.id, workspace.id, linked.worldId, linked.worldVersion); worlds.unshift({ worldId: linked.worldId, worldName: linked.worldName, version: linked.worldVersion, zones: version.blueprint.zones.map((zone) => ({ identifier: zone.identifier, name: zone.name, type: zone.type })) }); }
  return <div className="space-y-6"><div><Link href={`/experiences/${profile.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />{profile.name}</Link><PageHeader icon={Aperture} title="Edit Experience Profile" description="Saving creates a complete new immutable Profile version." /></div><ExperienceForm mode="edit" initial={experienceToFormInitial(profile)} assets={assets} entities={entities} worlds={worlds} /></div>;
}
