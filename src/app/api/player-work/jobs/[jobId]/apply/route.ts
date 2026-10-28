import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { applyForVirtualJob } from "@/server/services/player-work-service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to use SIMVERSE work services.");
    const { jobId } = await params;
    return dataResponse(await applyForVirtualJob(user.id, jobId, await req.json().catch(() => ({}))), 201);
  } catch (error) { return errorResponse(error); }
}
