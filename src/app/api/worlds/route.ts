import type { NextRequest } from "next/server";
import {
  WORLD_BIOMES, WORLD_SORTS, WORLD_STATUS_FILTERS,
  type WorldBiome, type WorldSort, type WorldStatusFilter,
} from "@/lib/worlds/constants";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createWorld, listWorlds, type ListWorldsParams } from "@/server/services/world-service";

function listParams(searchParams: URLSearchParams): ListWorldsParams {
  const params: ListWorldsParams = {};
  const search = searchParams.get("search")?.trim(); if (search) params.search = search;
  const tag = searchParams.get("tag")?.trim(); if (tag) params.tag = tag;
  const category = searchParams.get("category")?.trim(); if (category) params.category = category;
  const biome = searchParams.get("biome");
  if (biome && (WORLD_BIOMES as readonly string[]).includes(biome)) params.biome = biome as WorldBiome;
  const status = searchParams.get("status");
  if (status && (WORLD_STATUS_FILTERS as readonly string[]).includes(status)) params.status = status as WorldStatusFilter;
  const sort = searchParams.get("sort");
  if (sort && (WORLD_SORTS as readonly string[]).includes(sort)) params.sort = sort as WorldSort;
  const page = Number(searchParams.get("page")); if (Number.isFinite(page) && page >= 1) params.page = Math.floor(page);
  const pageSize = Number(searchParams.get("pageSize")); if (Number.isFinite(pageSize) && pageSize >= 1) params.pageSize = Math.floor(pageSize);
  return params;
}

export async function GET(request: NextRequest) {
  try { const { userId, workspaceId } = await requireApiContext(); return dataResponse(await listWorlds(userId, workspaceId, listParams(request.nextUrl.searchParams))); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { const { userId, workspaceId } = await requireApiContext(); const world = await createWorld(userId, workspaceId, await request.json().catch(() => ({}))); return dataResponse({ world }, 201); }
  catch (error) { return errorResponse(error); }
}
