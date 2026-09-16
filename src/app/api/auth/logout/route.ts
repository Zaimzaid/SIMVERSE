import { destroyCurrentSession, getSessionUser } from "@/server/auth/session";
import { recordAudit } from "@/server/services/audit-service";
import { dataResponse, errorResponse } from "@/server/api/response";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (user) {
      await recordAudit({ action: "user.logged_out", actorUserId: user.id });
    }
    await destroyCurrentSession();
    return dataResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
