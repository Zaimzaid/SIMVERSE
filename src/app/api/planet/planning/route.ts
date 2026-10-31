import { dataResponse } from "@/server/api/response";
import { foundingPlanPublicSummary } from "@/lib/planet/founding-plan";

/**
 * Public read-only proposal catalog. NOT the authoritative country list.
 * /api/planet/countries remains the source of truth for published territory.
 */
export function GET() {
  return dataResponse(foundingPlanPublicSummary());
}
