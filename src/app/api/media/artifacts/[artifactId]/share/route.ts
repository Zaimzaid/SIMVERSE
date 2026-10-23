import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getArtifactShare, revokeArtifactShare, setArtifactShare } from "@/server/services/media-share-service";

interface Context { params: Promise<{ artifactId: string }> }

/** GET the current share state for an artifact (workspace members with media.view). */
export async function GET(_request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { artifactId } = await context.params;
    return dataResponse({ share: await getArtifactShare(userId, workspaceId, artifactId) });
  } catch (error) { return errorResponse(error); }
}

/** Create or update the share (visibility / pinned version / title). Needs media.share. */
export async function POST(request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { artifactId } = await context.params;
    const share = await setArtifactShare(userId, workspaceId, artifactId, await request.json().catch(() => ({})));
    return dataResponse({ share });
  } catch (error) { return errorResponse(error); }
}

/** Revoke public access (sets PRIVATE). Needs media.share. */
export async function DELETE(_request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { artifactId } = await context.params;
    return dataResponse({ share: await revokeArtifactShare(userId, workspaceId, artifactId) });
  } catch (error) { return errorResponse(error); }
}
