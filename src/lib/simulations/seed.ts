/**
 * Simulation seed helpers.
 *
 * A seed is metadata ONLY in Phase 2 — a stable label of the form `SV-XXXXXXXX`.
 * It is NOT consumed by any random-number generator here: there is no execution
 * engine, no seeded RNG, no runtime. Generating a seed string is just producing a
 * readable identifier the future engine (Phase 3) will use for reproducibility.
 */

export const SEED_PREFIX = "SV-";
export const SEED_BODY_LENGTH = 8;

/** Validation accepts any 8 uppercase letters/digits after the prefix. */
export const SEED_REGEX = /^SV-[0-9A-Z]{8}$/;

/**
 * Generation alphabet excludes visually ambiguous characters (0/O, 1/I) so a seed
 * can be read aloud or retyped without confusion. Validation is more permissive.
 */
const GENERATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** True if a string is a well-formed seed (SV- followed by 8 uppercase alphanumerics). */
export function isValidSeed(value: string): boolean {
  return SEED_REGEX.test(value);
}

/** Normalize user-entered seed text: trim and uppercase (does not add the prefix). */
export function normalizeSeed(value: string): string {
  return value.trim().toUpperCase();
}

/** Produce a fresh, well-formed seed label. Uses crypto when available. */
export function generateSeed(): string {
  const bytes = randomBytes(SEED_BODY_LENGTH);
  let body = "";
  for (let i = 0; i < SEED_BODY_LENGTH; i += 1) {
    const byte = bytes[i] ?? 0;
    body += GENERATION_ALPHABET.charAt(byte % GENERATION_ALPHABET.length);
  }
  return `${SEED_PREFIX}${body}`;
}

/** Cross-environment random bytes (browser + Node). Falls back to Math.random only if no crypto. */
function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const cryptoObj =
    typeof globalThis !== "undefined" && "crypto" in globalThis
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}
