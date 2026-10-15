import { requireApiContext } from "@/server/api/context";
import { errorResponse } from "@/server/api/response";
import { renderArtifactExport } from "@/server/services/media-export-service";

interface Context { params: Promise<{ artifactId: string }> }

/**
 * GET /api/media/artifacts/[artifactId]/export?version&type&format
 *
 * Streams a portable graphic (PNG or SVG) rendered from an immutable artifact
 * version. Only approved presets are accepted — no client-supplied dimensions.
 * Auth + workspace isolation are enforced by the service (media.view).
 */
export async function GET(request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { artifactId } = await context.params;
    const params = new URL(request.url).searchParams;

    const result = await renderArtifactExport(userId, workspaceId, artifactId, {
      version: params.get("version") ?? undefined,
      exportType: params.get("type") ?? undefined,
      format: params.get("format") ?? undefined,
      ratio: params.get("ratio") ?? undefined,
    });

    return new Response(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
