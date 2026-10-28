import { earthZoneLifecycleActionSchema } from "@/lib/earth/land";
import { parseOrThrow } from "@/lib/validation";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  activateEarthZoneVersion,
  rollbackEarthZoneVersion,
  submitEarthZoneVersionForReview,
} from "@/server/services/earth-zone-service";

type Context = { params: Promise<{ zoneId: string; versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { zoneId, versionId } = await context.params;
    const { action } = parseOrThrow(
      earthZoneLifecycleActionSchema,
      await request.json().catch(() => ({})),
      "Invalid development-zone lifecycle action.",
    );
    if (action === "SUBMIT_FOR_REVIEW") {
      return dataResponse(await submitEarthZoneVersionForReview(
        userId, workspaceId, zoneId, versionId,
      ));
    }
    if (action === "ACTIVATE") {
      return dataResponse(await activateEarthZoneVersion(
        userId, workspaceId, zoneId, versionId,
      ));
    }
    return dataResponse(await rollbackEarthZoneVersion(
      userId, workspaceId, zoneId, versionId,
    ));
  } catch (error) {
    return errorResponse(error);
  }
}
