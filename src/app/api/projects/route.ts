import type { NextRequest } from "next/server";

import {
  PROJECT_SORTS,
  PROJECT_STATUS_FILTERS,
  type ProjectSort,
  type ProjectStatusFilter,
} from "@/lib/projects/constants";
import {
  createProject,
  listProjects,
  type ListProjectsParams,
} from "@/server/services/project-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** Read the Project Library query controls off the URL, ignoring anything invalid. */
function parseListParams(searchParams: URLSearchParams): ListProjectsParams {
  const params: ListProjectsParams = {};

  const search = searchParams.get("search")?.trim();
  if (search) params.search = search;

  const status = searchParams.get("status");
  if (status && (PROJECT_STATUS_FILTERS as readonly string[]).includes(status)) {
    params.status = status as ProjectStatusFilter;
  }

  const sort = searchParams.get("sort");
  if (sort && (PROJECT_SORTS as readonly string[]).includes(sort)) {
    params.sort = sort as ProjectSort;
  }

  const page = Number(searchParams.get("page"));
  if (Number.isFinite(page) && page >= 1) params.page = Math.floor(page);

  const pageSize = Number(searchParams.get("pageSize"));
  if (Number.isFinite(pageSize) && pageSize >= 1) params.pageSize = Math.floor(pageSize);

  return params;
}

/** GET /api/projects — list projects in the active workspace (search / filter / sort / paginate). */
export async function GET(req: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const result = await listProjects(userId, workspaceId, parseListParams(req.nextUrl.searchParams));
    return dataResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/projects — create a project in the active workspace. */
export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const body = await req.json().catch(() => ({}));
    const project = await createProject(userId, workspaceId, body);
    return dataResponse({ project }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
