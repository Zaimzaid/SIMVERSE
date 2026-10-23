import { errorResponse } from "@/server/api/response";
import { renderPublicShareGraphic } from "@/server/services/media-share-service";

interface Context { params: Promise<{ publicId: string }> }

/**
 * GET /s/[publicId]/image — public, unauthenticated render of a share's pinned
 * version graphic (also used as og:image). Resolves ONLY active UNLISTED/PUBLIC
 * shares of non-archived artifacts; anything else is a safe 404. `no-store` so a
 * revoked share stops serving immediately.
 */
export async function GET(request: Request, context: Context) {
  try {
    const { publicId } = await context.params;
    const params = new URL(request.url).searchParams;
    const result = await renderPublicShareGraphic(publicId, {
      type: params.get("type"),
      format: params.get("format"),
      ratio: params.get("ratio"),
    });
    return new Response(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(result.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
