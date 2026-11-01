import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyFoundingApplicationReadiness,
  submitMyFoundingCitizenshipApplication,
  withdrawMyFoundingCitizenshipApplication,
} from "@/server/services/founding-citizenship-intake-service";

async function authenticatedId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to manage your founding-citizenship application.");
  return user.id;
}

export async function GET() {
  try { return dataResponse(await getMyFoundingApplicationReadiness(await authenticatedId())); }
  catch (error) { return errorResponse(error); }
}

/**
 * No body or caller-selected countryId: submission reads the user's saved
 * private draft and resolves an independently PUBLISHED fictional-country ID.
 */
export async function POST() {
  try { return dataResponse(await submitMyFoundingCitizenshipApplication(await authenticatedId()), 201); }
  catch (error) { return errorResponse(error); }
}

export async function DELETE() {
  try { return dataResponse(await withdrawMyFoundingCitizenshipApplication(await authenticatedId())); }
  catch (error) { return errorResponse(error); }
}
