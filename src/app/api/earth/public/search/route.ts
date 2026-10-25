import type { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  PUBLIC_EARTH_RATE_LIMITS,
  rateLimitedResponse,
  takePublicRateLimit,
} from "@/server/security/public-rate-limit";
import { searchPublicEarthCountries } from "@/server/services/earth-public-service";

export async function GET(request: NextRequest) {
  const rate = takePublicRateLimit(
    request,
    "earth:search",
    PUBLIC_EARTH_RATE_LIMITS.search,
  );
  if (!rate.allowed) return rateLimitedResponse(rate);
  try {
    return dataResponse(await searchPublicEarthCountries({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
