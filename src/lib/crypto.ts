import crypto from "crypto";

const DEFAULT_KEY = "costockage-dev-encryption-key-32-bytes";

function getKey() {
  const raw = process.env.APP_ENCRYPTION_KEY || DEFAULT_KEY;
  const hash = crypto.createHash("sha256").update(raw).digest();
  return hash;
}

export function encryptText(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptText(value: string): string {
  const [iv64, tag64, payload64] = value.split(".");
  if (!iv64 || !tag64 || !payload64) return "";

  const key = getKey();
  const iv = Buffer.from(iv64, "base64");
  const tag = Buffer.from(tag64, "base64");
  const payload = Buffer.from(payload64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString("utf8");
}
