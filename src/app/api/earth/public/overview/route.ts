import type { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  PUBLIC_EARTH_RATE_LIMITS,
  rateLimitedResponse,
  takePublicRateLimit,
} from "@/server/security/public-rate-limit";
import { getPublicEarthOverview } from "@/server/services/earth-public-service";

export async function GET(request: NextRequest) {
  const rate = takePublicRateLimit(
    request,
    "earth:overview",
    PUBLIC_EARTH_RATE_LIMITS.overview,
  );
  if (!rate.allowed) return rateLimitedResponse(rate);
  try {
    const response = dataResponse(await getPublicEarthOverview());
    response.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
