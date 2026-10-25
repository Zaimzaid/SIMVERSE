import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import {
  earthDestinationIntentTokenSchema,
} from "@/lib/earth/public";
import { earthPlaceIdSchema } from "@/lib/earth/schemas";
import { env } from "@/lib/env";

export const EARTH_DESTINATION_INTENT_TTL_MS = 10 * 60 * 1000;

const payloadSchema = z.object({
  version: z.literal(1),
  purpose: z.literal("earth-protected-destination"),
  placeId: earthPlaceIdSchema,
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
}).strict();

export interface VerifiedEarthDestinationIntent {
  placeId: string;
  issuedAt: Date;
  expiresAt: Date;
}

function signature(payload: string): Buffer {
  return createHmac("sha256", env.SESSION_SECRET).update(payload).digest();
}

function invalidIntent(): never {
  throw new ValidationError("This Earth destination is unavailable or has expired.");
}

export function createEarthDestinationIntent(
  placeIdInput: string,
  now = Date.now(),
): { token: string; expiresAt: Date } {
  const parsedPlaceId = earthPlaceIdSchema.safeParse(placeIdInput);
  if (!parsedPlaceId.success) return invalidIntent();
  const expiresAt = now + EARTH_DESTINATION_INTENT_TTL_MS;
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    purpose: "earth-protected-destination",
    placeId: parsedPlaceId.data,
    issuedAt: now,
    expiresAt,
  }), "utf8").toString("base64url");
  const token = `${payload}.${signature(payload).toString("base64url")}`;
  if (!earthDestinationIntentTokenSchema.safeParse(token).success) return invalidIntent();
  return { token, expiresAt: new Date(expiresAt) };
}

export function verifyEarthDestinationIntent(
  tokenInput: unknown,
  now = Date.now(),
): VerifiedEarthDestinationIntent {
  const tokenResult = earthDestinationIntentTokenSchema.safeParse(tokenInput);
  if (!tokenResult.success) return invalidIntent();
  const [encodedPayload, encodedSignature] = tokenResult.data.split(".");
  if (!encodedPayload || !encodedSignature) return invalidIntent();

  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return invalidIntent();
  }
  const expectedSignature = signature(encodedPayload);
  if (suppliedSignature.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignature, expectedSignature)) {
    return invalidIntent();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return invalidIntent();
  }
  const parsedPayload = payloadSchema.safeParse(payload);
  if (!parsedPayload.success) return invalidIntent();
  if (parsedPayload.data.expiresAt <= now || parsedPayload.data.issuedAt > now + 60_000) {
    return invalidIntent();
  }
  if (parsedPayload.data.expiresAt - parsedPayload.data.issuedAt !== EARTH_DESTINATION_INTENT_TTL_MS) {
    return invalidIntent();
  }
  return {
    placeId: parsedPayload.data.placeId,
    issuedAt: new Date(parsedPayload.data.issuedAt),
    expiresAt: new Date(parsedPayload.data.expiresAt),
  };
}

export function earthAuthHref(route: "/login" | "/register", token: string): string {
  const parsed = earthDestinationIntentTokenSchema.safeParse(token);
  if (!parsed.success) return route;
  return `${route}?earthIntent=${encodeURIComponent(parsed.data)}`;
}

export function earthRestoreHref(token: string): string {
  const parsed = earthDestinationIntentTokenSchema.safeParse(token);
  return parsed.success
    ? `/earth/restore?intent=${encodeURIComponent(parsed.data)}`
    : "/earth";
}
