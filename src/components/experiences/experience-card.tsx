import Link from "next/link";
import { Aperture } from "lucide-react";
import { EXPERIENCE_PROFILE_STATUS_LABELS, type ExperienceProfileStatus } from "@/lib/experiences/constants";
import type { ExperienceProfileView } from "@/server/services/experience-profile-service";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function experienceStatusVariant(status: ExperienceProfileStatus): BadgeVariant {
  if (status === "RUNTIME_READY") return "success";
  if (status === "VALIDATED") return "accent";
  if (status === "REVIEW" || status === "IN_DESIGN") return "warning";
  if (status === "ARCHIVED") return "neutral";
  return "outline";
}

export function ExperienceCard({ profile, view = "gallery" }: { profile: ExperienceProfileView; view?: "gallery" | "list" }) {
  if (view === "list") return <Link href={`/experiences/${profile.id}`} className="block"><Card interactive className="flex items-center gap-4 p-4">
    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Aperture className="size-5" /></div>
    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{profile.name}</p><p className="truncate text-sm text-muted">{profile.preset.replaceAll("_", " ")} · Version {profile.currentVersion}</p></div>
    <div className="hidden flex-wrap gap-1 md:flex">{profile.tags.slice(0, 3).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>
    <Badge variant={experienceStatusVariant(profile.status)}>{EXPERIENCE_PROFILE_STATUS_LABELS[profile.status]}</Badge><time className="hidden text-xs text-muted sm:block">{profile.updatedAt.toLocaleDateString()}</time>
  </Card></Link>;
  return <Link href={`/experiences/${profile.id}`} className="block h-full"><Card interactive className="flex h-full flex-col overflow-hidden">
    <div className="relative flex aspect-[16/9] items-center justify-center border-b border-border bg-gradient-to-br from-violet-500/15 to-surface-elevated">
      {profile.thumbnailReference ? <img src={profile.thumbnailReference} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : <Aperture className="size-12 text-accent/70" />}
      <Badge variant={experienceStatusVariant(profile.status)} className="absolute right-3 top-3">{EXPERIENCE_PROFILE_STATUS_LABELS[profile.status]}</Badge>
    </div>
    <div className="flex flex-1 flex-col gap-3 p-4"><div><p className="font-semibold">{profile.name}</p><p className="text-sm text-muted">{profile.preset.replaceAll("_", " ")} · v{profile.currentVersion}</p></div>
      {profile.description ? <p className="line-clamp-2 text-sm text-secondary">{profile.description}</p> : null}
      <div className="mt-auto flex flex-wrap gap-1">{profile.tags.slice(0, 4).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>
      <p className="text-xs text-muted">{profile.version.definition.eventBindings.length} event bindings · {profile.assets.length} Assets · {profile.worlds.length} Worlds</p>
    </div>
  </Card></Link>;
}
