import type { NextRequest } from "next/server";

import {
  SIMULATION_SORTS,
  SIMULATION_STATUS_FILTERS,
  type SimulationSort,
  type SimulationStatusFilter,
} from "@/lib/simulations/constants";
import {
  createSimulation,
  listSimulations,
  type ListSimulationsParams,
} from "@/server/services/simulation-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** Read the Simulation Library query controls off the URL, ignoring anything invalid. */
function parseListParams(searchParams: URLSearchParams): ListSimulationsParams {
  const params: ListSimulationsParams = {};

  const search = searchParams.get("search")?.trim();
  if (search) params.search = search;

  const projectId = searchParams.get("projectId")?.trim();
  if (projectId) params.projectId = projectId;

  const mode = searchParams.get("mode")?.trim();
  if (mode) params.mode = mode;

  const status = searchParams.get("status");
  if (status && (SIMULATION_STATUS_FILTERS as readonly string[]).includes(status)) {
    params.status = status as SimulationStatusFilter;
  }

  const sort = searchParams.get("sort");
  if (sort && (SIMULATION_SORTS as readonly string[]).includes(sort)) {
    params.sort = sort as SimulationSort;
  }

  const page = Number(searchParams.get("page"));
  if (Number.isFinite(page) && page >= 1) params.page = Math.floor(page);

  const pageSize = Number(searchParams.get("pageSize"));
  if (Number.isFinite(pageSize) && pageSize >= 1) params.pageSize = Math.floor(pageSize);

  return params;
}

/** GET /api/simulations — list simulation blueprints in the active workspace. */
export async function GET(req: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const result = await listSimulations(userId, workspaceId, parseListParams(req.nextUrl.searchParams));
    return dataResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/simulations — create a simulation *configuration* in the active
 * workspace. Always starts as DRAFT (no execution). The project and every
 * participant must belong to the workspace; config is validated server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const body = await req.json().catch(() => ({}));
    const simulation = await createSimulation(userId, workspaceId, body);
    return dataResponse({ simulation }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
