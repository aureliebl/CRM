import crypto from "crypto";

export const SESSION_COOKIE_NAME = "costockage_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  userId: string;
  role: string;
  iat: number;
  exp: number;
};

function getSessionSecret(): string {
  return process.env.APP_SESSION_SECRET || process.env.APP_ENCRYPTION_KEY || "costockage-dev-session-secret";
}

function toBase64Url(value: string | Buffer): string {
  const raw = (typeof value === "string" ? Buffer.from(value, "utf8") : value).toString("base64");
  return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function signPayload(payloadB64: string): string {
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest();
  return toBase64Url(signature);
}

function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const chunks = header.split(";");
  const result: Record<string, string> = {};

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = decodeURIComponent(value);
  }

  return result;
}

export function createSessionToken(input: { userId: string; role: string }, maxAgeSeconds = SESSION_MAX_AGE_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: input.userId,
    role: input.role,
    iat: now,
    exp: now + maxAgeSeconds,
  };

  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string | null | undefined): SessionPayload | null {
  if (!token) return null;
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) return null;

  const expectedSignature = signPayload(payloadB64);
  const providedBuf = Buffer.from(signatureB64);
  const expectedBuf = Buffer.from(expectedSignature);

  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const payloadRaw = fromBase64Url(payloadB64).toString("utf8");
    const payload = JSON.parse(payloadRaw) as SessionPayload;
    if (!payload?.userId || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}
