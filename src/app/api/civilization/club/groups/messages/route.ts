import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  listMyClubInterestMessages, sendMyClubInterestMessage,
} from "@/server/services/district-club-interest-service";
async function who() { const u = await getSessionUser(); if (!u) throw new AuthenticationError(); return u.id; }
export async function GET(req: NextRequest) {
  try { return dataResponse(await listMyClubInterestMessages(await who(),
    new URL(req.url).searchParams.get("groupId"))); }
  catch (e) { return errorResponse(e); }
}
export async function POST(req: NextRequest) {
  try { return dataResponse(await sendMyClubInterestMessage(await who(),
    await req.json().catch(() => ({}))), 201); }
  catch (e) { return errorResponse(e); }
}
