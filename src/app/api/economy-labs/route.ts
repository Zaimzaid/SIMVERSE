import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createEconomyLab, listEconomyLabs } from "@/server/services/economy-lab-service";

export async function GET() {
  try {
    const { userId, workspaceId } = await requireApiContext();
    return dataResponse(await listEconomyLabs(userId, workspaceId));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const lab = await createEconomyLab(userId, workspaceId, await request.json().catch(() => ({})));
    return dataResponse(lab, 201);
  } catch (error) { return errorResponse(error); }
}
