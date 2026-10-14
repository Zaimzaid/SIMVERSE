import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createMediaArtifactVersion } from "@/server/services/media-artifact-service";

interface Context { params: Promise<{ artifactId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { artifactId } = await context.params;
    const artifact = await createMediaArtifactVersion(
      userId, workspaceId, artifactId, await request.json().catch(() => ({})),
    );
    return dataResponse({ artifact }, 201);
  } catch (error) { return errorResponse(error); }
}
