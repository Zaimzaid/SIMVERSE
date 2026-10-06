import type { Metadata } from "next";
import Link from "next/link";
import { Aperture, Plus } from "lucide-react";
import {
  EXPERIENCE_PRESET_TYPES, EXPERIENCE_PROFILE_STATUS_FILTERS, EXPERIENCE_SORTS,
  type ExperiencePresetType, type ExperienceProfileStatusFilter, type ExperienceSort,
} from "@/lib/experiences/constants";
import { requirePlatformContext } from "@/server/context";
import { listExperienceProfiles, listExperienceTags } from "@/server/services/experience-profile-service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { ExperienceLibraryControls } from "@/components/experiences/experience-library-controls";
import { ExperienceCard } from "@/components/experiences/experience-card";
import { ExperiencePagination } from "@/components/experiences/experience-pagination";

export const metadata: Metadata = { title: "Experience Profiles" };
type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""; }
export default async function ExperiencesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("experience.view")) return <div className="space-y-6"><PageHeader icon={Aperture} title="Experience Profiles" description="Engine-neutral presentation direction." /><EmptyState icon={Aperture} title="No access to Experience Profiles" description="Your role does not include Experience Library access." /></div>;
  const sp = await searchParams; const search = first(sp.q); const tag = first(sp.tag); const module = first(sp.module); const mode = first(sp.mode);
  const presetRaw = first(sp.preset).toUpperCase(); const preset = (EXPERIENCE_PRESET_TYPES as readonly string[]).includes(presetRaw) ? presetRaw as ExperiencePresetType : "";
  const statusRaw = first(sp.status).toUpperCase(); const status = (EXPERIENCE_PROFILE_STATUS_FILTERS as readonly string[]).includes(statusRaw) ? statusRaw as ExperienceProfileStatusFilter : "CURRENT";
  const sortRaw = first(sp.sort); const sort = (EXPERIENCE_SORTS as readonly string[]).includes(sortRaw) ? sortRaw as ExperienceSort : "updated_desc";
  const view = first(sp.view) === "list" ? "list" as const : "gallery" as const; const page = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);
  const [result, tags] = await Promise.all([listExperienceProfiles(user.id, workspace.id, { search, tag, module, mode, preset: preset || undefined, status, sort, page }), listExperienceTags(user.id, workspace.id)]);
  const hrefForPage = (nextPage: number) => { const query = new URLSearchParams(); if (search) query.set("q", search); if (tag) query.set("tag", tag); if (module) query.set("module", module); if (mode) query.set("mode", mode); if (preset) query.set("preset", preset); if (status !== "CURRENT") query.set("status", status); if (sort !== "updated_desc") query.set("sort", sort); if (view === "list") query.set("view", "list"); if (nextPage > 1) query.set("page", String(nextPage)); return query.size ? `/experiences?${query}` : "/experiences"; };
  const canManage = permissions.includes("experience.manage"); const filtered = search || tag || module || mode || preset || status !== "CURRENT";
  return <div className="space-y-6"><PageHeader icon={Aperture} title="Experience Profiles" description="Versioned direction for animation, camera, VFX, audio, HUD and presentation pacing." actions={canManage ? <Link href="/experiences/new" className={buttonClasses()}><Plus className="size-4" />Create Profile</Link> : undefined} />
    {result.total === 0 && !filtered ? <EmptyState icon={Aperture} title="No Experience Profiles yet" description="Create presentation direction without changing simulation truth." action={canManage ? <Link href="/experiences/new" className={buttonClasses()}><Plus className="size-4" />Create your first Profile</Link> : undefined} /> : <>
      <ExperienceLibraryControls tags={tags} current={{ search, preset, module, mode, status, tag, sort, view }} />
      {result.items.length ? <div className={view === "gallery" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>{result.items.map((profile) => <ExperienceCard key={profile.id} profile={profile} view={view} />)}</div> : <EmptyState icon={Aperture} title="No Profiles match these filters" description="Clear or adjust the search and filters." />}
      <ExperiencePagination page={result.page} pageCount={result.pageCount} total={result.total} hrefForPage={hrefForPage} />
    </>}
  </div>;
}
