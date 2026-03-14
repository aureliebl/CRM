import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getVaultKey(): Buffer {
  const hex = process.env.VAULT_MASTER_KEY;
  if (hex && hex.length === 64) {
    return Buffer.from(hex, "hex");
  }
  // Fallback for dev: derive a 32-byte key from a passphrase
  const fallback = process.env.VAULT_MASTER_KEY || "costockage-vault-dev-key-not-for-production";
  return crypto.createHash("sha256").update(fallback).digest();
}

export function vaultEncrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function vaultDecrypt(encrypted: string, iv: string, authTag: string): string {
  try {
    const key = getVaultKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

export function generateRandomPassword(length = 20): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateBackupCode(): string {
  return crypto.randomBytes(4).toString("hex"); // 8 chars hex
}

export function generateApiToken(): string {
  return crypto.randomBytes(32).toString("hex"); // 64 chars hex
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
