import type { NextRequest } from "next/server";
import { TOURNAMENT_FORMATS, TOURNAMENT_STATUSES, TOURNAMENT_SORTS, type TournamentFormat, type TournamentSort, type TournamentStatusFilter } from "@/lib/tournaments/constants";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createTournament, listTournaments, type ListTournamentsParams } from "@/server/services/tournament-service";

function listParams(searchParams: URLSearchParams): ListTournamentsParams {
  const params: ListTournamentsParams = {};
  const search = searchParams.get("search")?.trim(); if (search) params.search = search;
  const module = searchParams.get("module")?.trim(); if (module) params.module = module;
  const projectId = searchParams.get("projectId")?.trim(); if (projectId) params.projectId = projectId;
  const creatorId = searchParams.get("creatorId")?.trim(); if (creatorId) params.creatorId = creatorId;
  const status = searchParams.get("status");
  if (status && ([...TOURNAMENT_STATUSES, "CURRENT", "ALL"] as readonly string[]).includes(status)) params.status = status as TournamentStatusFilter;
  const format = searchParams.get("format"); if (format && (TOURNAMENT_FORMATS as readonly string[]).includes(format)) params.format = format as TournamentFormat;
  const sort = searchParams.get("sort"); if (sort && (TOURNAMENT_SORTS as readonly string[]).includes(sort)) params.sort = sort as TournamentSort;
  const page = Number(searchParams.get("page")); if (Number.isFinite(page) && page > 0) params.page = Math.floor(page);
  return params;
}

export async function GET(request: NextRequest) {
  try { const { userId, workspaceId } = await requireApiContext(); return dataResponse(await listTournaments(userId, workspaceId, listParams(request.nextUrl.searchParams))); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { const { userId, workspaceId } = await requireApiContext(); return dataResponse({ tournament: await createTournament(userId, workspaceId, await request.json().catch(() => ({}))) }, 201); }
  catch (error) { return errorResponse(error); }
}
