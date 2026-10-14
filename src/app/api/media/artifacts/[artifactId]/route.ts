import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMediaArtifact } from "@/server/services/media-artifact-service";

interface Context { params: Promise<{ artifactId: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { artifactId } = await context.params;
    return dataResponse({ artifact: await getMediaArtifact(userId, workspaceId, artifactId) });
  } catch (error) { return errorResponse(error); }
}
