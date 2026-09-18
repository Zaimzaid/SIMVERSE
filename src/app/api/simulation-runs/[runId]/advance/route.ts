import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseOrThrow } from "@/lib/validation";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { advanceSimulationRun } from "@/server/services/simulation-run-service";

const advanceSchema = z.object({ maxTicks: z.number().int().min(1).max(100).default(1) }).strict();

/** A bounded server-authoritative execution batch; the browser provides only a tick cap. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { runId } = await params;
    const body = await req.json().catch(() => ({}));
    const { maxTicks } = parseOrThrow(advanceSchema, body);
    return dataResponse({ run: await advanceSimulationRun(userId, workspaceId, runId, maxTicks) });
  } catch (error) {
    return errorResponse(error);
  }
}
