import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/constants";
import { env, isProduction } from "@/lib/env";
import type { SafeUser } from "@/lib/types";
import { prisma, SAFE_USER_OMIT } from "@/server/db/client";

export const SESSION_COOKIE = SESSION_COOKIE_NAME;
export const ACTIVE_WORKSPACE_COOKIE = ACTIVE_WORKSPACE_COOKIE_NAME;

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * The cookie stores an opaque random token; the database only ever stores its
 * HMAC hash (peppered with SESSION_SECRET). A database leak alone cannot be
 * used to forge a valid session cookie.
 */
function hashSessionToken(token: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
}

interface SessionMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Create a persistent session for a user and set the session cookie.
 * Must be called from a Route Handler or Server Action (it writes a cookie).
 */
export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolve the current user from the session cookie, or null. Safe to call from
 * Server Components (reads cookies only, never mutates them). Expired sessions
 * resolve to null.
 */
export async function getSessionUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { omit: SAFE_USER_OMIT } },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  return session.user;
}

/**
 * Destroy the current session (logout): delete the DB record and clear the
 * cookies. Must be called from a Route Handler or Server Action.
 */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
      .catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}

/** Read the active-workspace preference cookie (for future workspace switching). */
export async function getActiveWorkspaceIdCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
}

/**
 * Persist the active-workspace preference (workspace switching). The caller is
 * responsible for verifying the user actually belongs to this workspace first.
 * Must be called from a Route Handler or Server Action.
 */
export async function setActiveWorkspaceCookie(workspaceId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SESSION_TTL_MS),
  });
}
