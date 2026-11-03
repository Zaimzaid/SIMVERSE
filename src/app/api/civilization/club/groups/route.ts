import type { NextRequest } from "next/server";
import { AuthenticationError, ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  listMyClubInterestGroups, createMyClubInterestGroup, changeMyClubInterestMembership,
} from "@/server/services/district-club-interest-service";
async function who() { const u = await getSessionUser(); if (!u) throw new AuthenticationError(); return u.id; }
export async function GET() {
  try { return dataResponse(await listMyClubInterestGroups(await who())); }
  catch (e) { return errorResponse(e); }
}
export async function POST(req: NextRequest) {
  try { return dataResponse(await createMyClubInterestGroup(await who(),
    await req.json().catch(() => ({}))), 201); }
  catch (e) { return errorResponse(e); }
}
export async function PATCH(req: NextRequest) {
  try {
    const raw: unknown = await req.json().catch(() => ({}));
    if (!raw || typeof raw !== "object") throw new ValidationError("Select a group.");
    return dataResponse(await changeMyClubInterestMembership(await who(), raw));
  } catch (e) { return errorResponse(e); }
}
