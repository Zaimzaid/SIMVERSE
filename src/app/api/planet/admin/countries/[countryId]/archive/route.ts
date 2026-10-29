import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { archiveFictionalCountry } from "@/server/services/fictional-planet-service";

export async function POST(_request: Request, context: { params: Promise<{ countryId: string }> }) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { countryId } = await context.params;
    return dataResponse(await archiveFictionalCountry(userId, workspaceId, countryId));
  } catch (error) {
    return errorResponse(error);
  }
}
