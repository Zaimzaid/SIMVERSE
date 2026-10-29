import { dataResponse, errorResponse } from "@/server/api/response";
import { getPublicFictionalCountry } from "@/server/services/fictional-planet-service";

export async function GET(_request: Request, context: { params: Promise<{ countryId: string }> }) {
  try {
    const { countryId } = await context.params;
    return dataResponse(await getPublicFictionalCountry(countryId));
  } catch (error) {
    return errorResponse(error);
  }
}
