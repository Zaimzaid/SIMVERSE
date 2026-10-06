import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { NotFoundError } from "@/lib/errors";
import { EXPERIENCE_PROFILE_STATUS_LABELS } from "@/lib/experiences/constants";
import { requirePlatformContext } from "@/server/context";
import { getExperienceProfile, listExperienceProfileVersions } from "@/server/services/experience-profile-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { experienceStatusVariant } from "@/components/experiences/experience-card";
export const metadata: Metadata = { title: "Experience Profile history" };
export default async function ExperienceVersionsPage({ params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params; const { user, workspace } = await requirePlatformContext();
  let profile; try { profile = await getExperienceProfile(user.id, workspace.id, experienceId); } catch (error) { if (error instanceof NotFoundError) notFound(); throw error; }
  const versions = await listExperienceProfileVersions(user.id, workspace.id, experienceId);
  return <div className="space-y-6"><div><Link href={`/experiences/${profile.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />{profile.name}</Link><PageHeader icon={Clock3} title="Experience Profile history" description="Every presentation definition is immutable and inspectable." /></div>
    <div className="space-y-4">{versions.map((version) => <Card key={version.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Version {version.version}{version.version === profile.currentVersion ? " · Current" : ""}</CardTitle><Badge variant={experienceStatusVariant(version.status)}>{EXPERIENCE_PROFILE_STATUS_LABELS[version.status]}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><p>{version.changeNote ?? (version.version === 1 ? "Initial version" : "No version note")}</p><div className="grid gap-2 md:grid-cols-3"><p><span className="text-muted">Preset:</span> {version.preset}</p><p><span className="text-muted">Bindings:</span> {version.definition.eventBindings.length}</p><p><span className="text-muted">Assets:</span> {version.definition.assetAssociations.length}</p><p><span className="text-muted">Worlds:</span> {version.definition.worldAssociations.length}</p><p><span className="text-muted">Created by:</span> {version.createdByName ?? "System"}</p><p><span className="text-muted">Created:</span> {version.createdAt.toLocaleString()}</p></div><p className="break-all font-mono text-xs text-muted">{version.contentHash}</p><details><summary className="cursor-pointer font-medium">Inspect frozen presentation definition</summary><pre className="mt-3 max-h-[32rem] overflow-auto rounded-lg bg-surface-elevated p-4 text-xs">{JSON.stringify(version.definition, null, 2)}</pre></details></CardContent></Card>)}</div>
  </div>;
}
