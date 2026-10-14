import type { NextRequest } from "next/server";
import { MEDIA_ARTIFACT_STATUSES, type MediaArtifactStatus } from "@/lib/media/constants";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listMediaArtifacts } from "@/server/services/media-artifact-service";

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const rawStatus = request.nextUrl.searchParams.get("status");
    const status = rawStatus === "CURRENT" || rawStatus === "ALL" ||
      (rawStatus && (MEDIA_ARTIFACT_STATUSES as readonly string[]).includes(rawStatus))
      ? rawStatus as MediaArtifactStatus | "CURRENT" | "ALL" : undefined;
    const page = Number(request.nextUrl.searchParams.get("page"));
    const pageSize = Number(request.nextUrl.searchParams.get("pageSize"));
    return dataResponse(await listMediaArtifacts(userId, workspaceId, {
      ...(status ? { status } : {}),
      ...(Number.isSafeInteger(page) && page > 0 ? { page } : {}),
      ...(Number.isSafeInteger(pageSize) && pageSize > 0 ? { pageSize } : {}),
    }));
  } catch (error) { return errorResponse(error); }
}
