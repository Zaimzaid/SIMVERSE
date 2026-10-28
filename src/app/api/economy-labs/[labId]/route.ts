import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getEconomyLab, mutateEconomyLab } from "@/server/services/economy-lab-service";

type Context = { params: Promise<{ labId: string }> };
export async function GET(_request: NextRequest, ctx: Context) {
  try {
    const { labId } = await ctx.params;
    const { userId, workspaceId } = await requireApiContext();
    return dataResponse(await getEconomyLab(userId, workspaceId, labId));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest, ctx: Context) {
  try {
    const { labId } = await ctx.params;
    const { userId, workspaceId } = await requireApiContext();
    const result = await mutateEconomyLab(
      userId, workspaceId, labId, await request.json().catch(() => ({})),
    );
    return dataResponse(result);
  } catch (error) { return errorResponse(error); }
}
