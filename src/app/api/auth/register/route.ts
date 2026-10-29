import type { NextRequest } from "next/server";
import { createSession, setActiveWorkspaceCookie } from "@/server/auth/session";
import { registerUser } from "@/server/services/auth-service";
import {issueEmailVerification} from "@/server/services/email-verification-service";
import { dataResponse, errorResponse } from "@/server/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { user, workspaceId } = await registerUser(body);

    if(user.emailVerificationRequired){
      // Never grant a session until email ownership has been verified.
      try{await issueEmailVerification(user.id);}catch{ /* resend available to recipient */ }
      return dataResponse({verificationRequired:true},201);
    }
    await createSession(user.id, {
      userAgent: req.headers.get("user-agent"),
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    await setActiveWorkspaceCookie(workspaceId);

    return dataResponse({ user }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
