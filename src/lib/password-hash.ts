import crypto from "crypto";

const SCRYPT_KEYLEN = 64;

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(plainPassword: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const [algo, salt, hashHex] = storedHash.split(":");
  if (algo !== "scrypt" || !salt || !hashHex) return false;

  const computed = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hashHex, "hex");
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}
