import type { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  PUBLIC_EARTH_RATE_LIMITS,
  rateLimitedResponse,
  takePublicRateLimit,
} from "@/server/security/public-rate-limit";
import { createPublicEarthDestination } from "@/server/services/earth-public-service";

export async function POST(request: NextRequest) {
  const rate = takePublicRateLimit(
    request,
    "earth:intent",
    PUBLIC_EARTH_RATE_LIMITS.intent,
  );
  if (!rate.allowed) return rateLimitedResponse(rate);
  try {
    return dataResponse(
      await createPublicEarthDestination(await request.json().catch(() => ({}))),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
