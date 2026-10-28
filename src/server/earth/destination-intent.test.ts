import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  EARTH_DESTINATION_INTENT_TTL_MS,
  createEarthDestinationIntent,
  earthAuthHref,
  earthRestoreHref,
  verifyEarthDestinationIntent,
} from "./destination-intent";

const PLACE_ID = `geo_${"a".repeat(24)}`;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

describe("Earth destination intents", () => {
  it("signs a bounded fixed-purpose destination and verifies it before expiry", () => {
    const created = createEarthDestinationIntent(PLACE_ID, NOW);
    expect(created.expiresAt.getTime()).toBe(NOW + EARTH_DESTINATION_INTENT_TTL_MS);
    expect(verifyEarthDestinationIntent(created.token, NOW + 1)).toEqual({
      placeId: PLACE_ID,
      issuedAt: new Date(NOW),
      expiresAt: created.expiresAt,
    });
    expect(earthAuthHref("/login", created.token)).toContain("/login?earthIntent=");
    expect(earthAuthHref("/register", created.token)).toContain("/register?earthIntent=");
    expect(earthRestoreHref(created.token)).toContain("/earth/restore?intent=");
  });

  it("rejects tampering, expiry, malformed IDs and oversized input", () => {
    const created = createEarthDestinationIntent(PLACE_ID, NOW);
    const tampered = `${created.token[0] === "a" ? "b" : "a"}${created.token.slice(1)}`;
    expect(() => verifyEarthDestinationIntent(tampered, NOW + 1))
      .toThrow(ValidationError);
    expect(() => verifyEarthDestinationIntent(
      created.token,
      NOW + EARTH_DESTINATION_INTENT_TTL_MS,
    )).toThrow(ValidationError);
    expect(() => createEarthDestinationIntent("https://evil.example", NOW))
      .toThrow(ValidationError);
    expect(() => verifyEarthDestinationIntent("x".repeat(600), NOW))
      .toThrow(ValidationError);
    expect(earthRestoreHref("https://evil.example")).toBe("/earth");
  });
});
