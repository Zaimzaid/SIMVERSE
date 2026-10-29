import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  createFictionalCountryDraft, listFictionalCountryDrafts,
} from "@/server/services/fictional-planet-service";

export async function GET() {
  try {
    const { userId, workspaceId } = await requireApiContext();
    return dataResponse(await listFictionalCountryDrafts(userId, workspaceId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    return dataResponse(
      await createFictionalCountryDraft(userId, workspaceId, await request.json().catch(() => ({}))),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
