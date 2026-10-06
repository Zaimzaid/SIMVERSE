import type { ExperienceProfileView } from "@/server/services/experience-profile-service";
import type { ExperienceProfileStatus } from "@/lib/experiences/constants";
import type { ExperienceDefinitionV1 } from "@/lib/experiences/schemas";

export interface ExperienceFormInitial {
  id: string; name: string; description: string; status: Exclude<ExperienceProfileStatus, "ARCHIVED">;
  tags: string[]; thumbnailReference: string; definition: ExperienceDefinitionV1;
}

export function experienceToFormInitial(profile: ExperienceProfileView): ExperienceFormInitial {
  const status = profile.status === "ARCHIVED"
    ? (profile.archivedFromStatus && profile.archivedFromStatus !== "ARCHIVED" ? profile.archivedFromStatus : "DRAFT")
    : profile.status;
  return { id: profile.id, name: profile.name, description: profile.description ?? "", status,
    tags: profile.version.tags, thumbnailReference: profile.thumbnailReference ?? "", definition: profile.version.definition };
}
