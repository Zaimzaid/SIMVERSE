import { dataResponse, errorResponse } from "@/server/api/response";
import { listPublicFictionalCountries } from "@/server/services/fictional-planet-service";

/** Public fictional planet catalog: zero countries by default. */
export async function GET() {
  try {
    return dataResponse(await listPublicFictionalCountries());
  } catch (error) {
    return errorResponse(error);
  }
}
