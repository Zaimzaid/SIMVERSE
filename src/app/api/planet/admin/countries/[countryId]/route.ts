import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { updateFictionalCountryDraft } from "@/server/services/fictional-planet-service";

export async function PATCH(request: Request, context: { params: Promise<{ countryId: string }> }) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { countryId } = await context.params;
    return dataResponse(await updateFictionalCountryDraft(
      userId, workspaceId, countryId, await request.json().catch(() => ({})),
    ));
  } catch (error) {
    return errorResponse(error);
  }
}
