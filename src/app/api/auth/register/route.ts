import type { NextRequest } from "next/server";
import { authClientIp, authRateLimitedResponse, takeRegistrationLimit } from "@/server/security/auth-rate-limit";
import { createSession, setActiveWorkspaceCookie } from "@/server/auth/session";
import { registerUser } from "@/server/services/auth-service";
import { dataResponse, errorResponse } from "@/server/api/response";

export async function POST(req: NextRequest) {
  try {
    const ip = authClientIp(req);
    const limit = takeRegistrationLimit(ip);
    if (!limit.allowed) return authRateLimitedResponse(limit.retryAfterSeconds);
    const body = await req.json().catch(() => ({}));
    const { user, workspaceId } = await registerUser(body);

    await createSession(user.id, {
      userAgent: req.headers.get("user-agent"),
      ipAddress: ip === "unidentified" ? null : ip,
    });
    await setActiveWorkspaceCookie(workspaceId);

    return dataResponse({ user }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
