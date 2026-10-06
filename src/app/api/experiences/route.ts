import type { NextRequest } from "next/server";
import {
  EXPERIENCE_PRESET_TYPES, EXPERIENCE_PROFILE_STATUS_FILTERS, EXPERIENCE_SORTS,
  type ExperiencePresetType, type ExperienceProfileStatusFilter, type ExperienceSort,
} from "@/lib/experiences/constants";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createExperienceProfile, listExperienceProfiles, type ListExperienceProfilesParams } from "@/server/services/experience-profile-service";

function listParams(searchParams: URLSearchParams): ListExperienceProfilesParams {
  const params: ListExperienceProfilesParams = {};
  const search = searchParams.get("search")?.trim(); if (search) params.search = search;
  const tag = searchParams.get("tag")?.trim(); if (tag) params.tag = tag;
  const module = searchParams.get("module")?.trim(); if (module) params.module = module;
  const mode = searchParams.get("mode")?.trim(); if (mode) params.mode = mode;
  const preset = searchParams.get("preset");
  if (preset && (EXPERIENCE_PRESET_TYPES as readonly string[]).includes(preset)) params.preset = preset as ExperiencePresetType;
  const status = searchParams.get("status");
  if (status && (EXPERIENCE_PROFILE_STATUS_FILTERS as readonly string[]).includes(status)) params.status = status as ExperienceProfileStatusFilter;
  const sort = searchParams.get("sort");
  if (sort && (EXPERIENCE_SORTS as readonly string[]).includes(sort)) params.sort = sort as ExperienceSort;
  const page = Number(searchParams.get("page")); if (Number.isFinite(page) && page >= 1) params.page = Math.floor(page);
  const pageSize = Number(searchParams.get("pageSize")); if (Number.isFinite(pageSize) && pageSize >= 1) params.pageSize = Math.floor(pageSize);
  return params;
}

export async function GET(request: NextRequest) {
  try { const { userId, workspaceId } = await requireApiContext(); return dataResponse(await listExperienceProfiles(userId, workspaceId, listParams(request.nextUrl.searchParams))); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { const { userId, workspaceId } = await requireApiContext(); const experience = await createExperienceProfile(userId, workspaceId, await request.json().catch(() => ({}))); return dataResponse({ experience }, 201); }
  catch (error) { return errorResponse(error); }
}
