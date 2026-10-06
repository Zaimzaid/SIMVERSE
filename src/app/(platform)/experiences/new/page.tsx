import type { Metadata } from "next";
import Link from "next/link";
import { Aperture, ArrowLeft } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listAssets } from "@/server/services/asset-service";
import { listEntities } from "@/server/services/entity-service";
import { listWorlds } from "@/server/services/world-service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { ExperienceForm } from "@/components/experiences/experience-form";

export const metadata: Metadata = { title: "New Experience Profile" };
export default async function NewExperiencePage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("experience.manage")) return <div className="space-y-6"><PageHeader icon={Aperture} title="New Experience Profile" description="Create presentation direction." /><EmptyState icon={Aperture} title="You can’t create Experience Profiles" description="Your role does not include Experience Profile management." action={<Link href="/experiences" className={buttonClasses({ variant: "secondary" })}>Back to Profiles</Link>} /></div>;
  const [assetResult, entityResult, worldResult] = await Promise.all([listAssets(user.id, workspace.id, { status: "CURRENT", pageSize: 100, sort: "name_asc" }), listEntities(user.id, workspace.id, { status: "ACTIVE", pageSize: 100, sort: "name_asc" }), listWorlds(user.id, workspace.id, { status: "CURRENT", pageSize: 100, sort: "name_asc" })]);
  const assets = assetResult.items.map((asset) => ({ id: asset.id, name: asset.name, type: asset.type, currentVersion: asset.currentVersion }));
  const entities = entityResult.items.map((entity) => ({ id: entity.id, name: entity.name, category: entity.category }));
  const worlds = worldResult.items.map((world) => ({ worldId: world.id, worldName: world.name, version: world.currentVersion, zones: world.version.blueprint.zones.map((zone) => ({ identifier: zone.identifier, name: zone.name, type: zone.type })) }));
  return <div className="space-y-6"><div><Link href="/experiences" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Experience Profiles</Link><PageHeader icon={Aperture} title="New Experience Profile" description="Map authoritative events to reusable, engine-neutral presentation semantics." /></div><ExperienceForm mode="create" assets={assets} entities={entities} worlds={worlds} /></div>;
}
