import type { NextRequest } from "next/server";
import { ASSET_SORTS, ASSET_STATUS_FILTERS, ASSET_TYPES, type AssetSort,
  type AssetStatusFilter, type AssetType } from "@/lib/assets/constants";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createAsset, listAssets, type ListAssetsParams } from "@/server/services/asset-service";

function listParams(searchParams: URLSearchParams): ListAssetsParams {
  const params: ListAssetsParams = {};
  const search = searchParams.get("search")?.trim(); if (search) params.search = search;
  const tag = searchParams.get("tag")?.trim(); if (tag) params.tag = tag;
  const entityId = searchParams.get("entityId")?.trim(); if (entityId) params.entityId = entityId;
  const type = searchParams.get("type");
  if (type && (ASSET_TYPES as readonly string[]).includes(type)) params.type = type as AssetType;
  const status = searchParams.get("status");
  if (status && (ASSET_STATUS_FILTERS as readonly string[]).includes(status)) params.status = status as AssetStatusFilter;
  const sort = searchParams.get("sort");
  if (sort && (ASSET_SORTS as readonly string[]).includes(sort)) params.sort = sort as AssetSort;
  const page = Number(searchParams.get("page")); if (Number.isFinite(page) && page >= 1) params.page = Math.floor(page);
  const pageSize = Number(searchParams.get("pageSize"));
  if (Number.isFinite(pageSize) && pageSize >= 1) params.pageSize = Math.floor(pageSize);
  return params;
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    return dataResponse(await listAssets(userId, workspaceId, listParams(request.nextUrl.searchParams)));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const asset = await createAsset(userId, workspaceId, await request.json().catch(() => ({})));
    return dataResponse({ asset }, 201);
  } catch (error) { return errorResponse(error); }
}
