import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCHEME = "scrypt";

/**
 * Hash a plaintext password using scrypt (Node built-in, no native deps).
 * Format: `scrypt$<saltHex>$<hashHex>`. Passwords are never stored in plaintext.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${SCHEME}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash using a constant-time
 * comparison. Returns false for any malformed stored value.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== SCHEME || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;

  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}
