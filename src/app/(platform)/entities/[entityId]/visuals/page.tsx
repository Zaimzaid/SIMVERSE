import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, Palette } from "lucide-react";
import { isHiddenResourceError } from "@/lib/errors";
import type { VisualProfileInput } from "@/lib/visuals/profile";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EntityVisualsEditor } from "@/components/entities/entity-visuals-editor";
import { requirePlatformContext } from "@/server/context";
import { getEntity } from "@/server/services/entity-service";

export const metadata: Metadata = { title: "Entity visuals" };
interface PageProps { params: Promise<{ entityId: string }> }

export default async function EntityVisualsPage({ params }: PageProps) {
  const { entityId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();
  let entity;
  try {
    entity = await getEntity(user.id, workspace.id, entityId);
  } catch (error) {
    if (isHiddenResourceError(error)) notFound();
    throw error;
  }
  const stored = entity.visualProfile;
  const initialProfile: VisualProfileInput | null = stored ? {
    sourceType: stored.sourceType,
    portraitUrl: stored.portraitUrl,
    modelUrl: stored.modelUrl,
    archetype: stored.archetype,
    scale: stored.scale,
    rotationX: stored.rotationX,
    rotationY: stored.rotationY,
    rotationZ: stored.rotationZ,
    offsetX: stored.offsetX,
    offsetY: stored.offsetY,
    offsetZ: stored.offsetZ,
    animationProfile: stored.animationProfile,
    enabled: stored.enabled,
  } : null;

  return <div className="space-y-6">
    <div>
      <Link href={`/entities/${entity.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />{entity.name}
      </Link>
      <PageHeader icon={Palette} title={`${entity.name} visuals`}
        description="Assign a 3D identity, map professional animation clips, and inspect the asset before new runs snapshot it." />
    </div>
    <nav aria-label="Entity sections" className="flex flex-wrap gap-2 border-b border-border pb-3">
      <Link href={`/entities/${entity.id}`} className={buttonClasses({ variant: "ghost", size: "sm" })}><Boxes className="size-4" />Overview</Link>
      <span className={buttonClasses({ variant: "secondary", size: "sm" })}><Palette className="size-4" />Visuals</span>
    </nav>
    {!permissions.includes("entity.edit") ? <p className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">Your role has read-only access to this Visual Profile.</p> : null}
    <EntityVisualsEditor
      entityId={entity.id}
      entityName={entity.name}
      entityPortraitUrl={entity.imageUrl}
      initialProfile={initialProfile}
      initialRevision={stored?.revision ?? null}
      canEdit={permissions.includes("entity.edit")}
    />
  </div>;
}
