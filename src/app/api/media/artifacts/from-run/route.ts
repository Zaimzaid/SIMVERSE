import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createMediaArtifactFromRun } from "@/server/services/media-artifact-service";

export async function POST(request: Request) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const artifact = await createMediaArtifactFromRun(userId, workspaceId, await request.json().catch(() => ({})));
    return dataResponse({ artifact }, 201);
  } catch (error) { return errorResponse(error); }
}
