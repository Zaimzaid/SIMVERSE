import type { NextRequest } from "next/server";

import {
  ENTITY_SORTS,
  ENTITY_STATUS_FILTERS,
  type EntitySort,
  type EntityStatusFilter,
} from "@/lib/entities/constants";
import {
  createEntity,
  listEntities,
  type ListEntitiesParams,
} from "@/server/services/entity-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** Read the Entity Library query controls off the URL, ignoring anything invalid. */
function parseListParams(searchParams: URLSearchParams): ListEntitiesParams {
  const params: ListEntitiesParams = {};

  const search = searchParams.get("search")?.trim();
  if (search) params.search = search;

  const category = searchParams.get("category")?.trim();
  if (category) params.category = category;

  const tag = searchParams.get("tag")?.trim();
  if (tag) params.tag = tag;

  const status = searchParams.get("status");
  if (status && (ENTITY_STATUS_FILTERS as readonly string[]).includes(status)) {
    params.status = status as EntityStatusFilter;
  }

  const sort = searchParams.get("sort");
  if (sort && (ENTITY_SORTS as readonly string[]).includes(sort)) {
    params.sort = sort as EntitySort;
  }

  // Project-scoped filters for the "add entities to a project" picker. Both stay
  // workspace-scoped inside the service, so a foreign projectId reveals nothing.
  const projectId = searchParams.get("projectId")?.trim();
  if (projectId) params.projectId = projectId;

  const notInProjectId = searchParams.get("notInProjectId")?.trim();
  if (notInProjectId) params.notInProjectId = notInProjectId;

  const page = Number(searchParams.get("page"));
  if (Number.isFinite(page) && page >= 1) params.page = Math.floor(page);

  const pageSize = Number(searchParams.get("pageSize"));
  if (Number.isFinite(pageSize) && pageSize >= 1) params.pageSize = Math.floor(pageSize);

  return params;
}

/** GET /api/entities — list entities in the active workspace (search / filter / sort / paginate). */
export async function GET(req: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const result = await listEntities(userId, workspaceId, parseListParams(req.nextUrl.searchParams));
    return dataResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/entities — create an entity in the active workspace. */
export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const body = await req.json().catch(() => ({}));
    const entity = await createEntity(userId, workspaceId, body);
    return dataResponse({ entity }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
