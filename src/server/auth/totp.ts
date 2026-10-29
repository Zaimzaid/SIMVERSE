import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function encodeBase32(bytes: Uint8Array): string {
  let value = 0, bits = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits -= 5)) & 31]; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function decodeBase32(secret: string): Buffer {
  let value = 0, bits = 0;
  const out: number[] = [];
  for (const char of secret.toUpperCase().replace(/=+$/, "")) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid authenticator secret.");
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits -= 8)) & 255); }
  }
  return Buffer.from(out);
}
export function createTotpSecret() { return encodeBase32(randomBytes(20)); }
export function totpAt(secret: string, timeMs: number): string {
  const counter = Math.floor(timeMs / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter), 0);
  const mac = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = (mac[19] ?? 0) & 15;
  const binary = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(binary).padStart(6, "0");
}
export function verifyTotp(secret: string, candidate: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(candidate)) return false;
  return [-1,0,1].some(step => {
    const expected = totpAt(secret, now + step * 30_000);
    return timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
  });
}
const encryptionKey = createHash("sha256").update(env.SESSION_SECRET + ":totp:v1").digest();
export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decryptSecret(sealed: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid authenticator configuration.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
export function hashRecoveryCode(userId: string, code: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update("recovery:v1:" + userId + ":" + code.replace(/[-\s]/g, "").toUpperCase()).digest("hex");
}
export function makeRecoveryCodes(userId: string) {
  const codes = Array.from({length: 8}, () => randomBytes(8).toString("hex").toUpperCase().replace(/(.{4})/g, "$1-").replace(/-$/, ""));
  return { codes, hashes: codes.map(code => hashRecoveryCode(userId, code)) };
}
