import crypto from "node:crypto";

const DEFAULT_SECRET = "costockage-docs-crdt-dev-secret";

function getSecret() {
  return process.env.DOCS_CRDT_SECRET || process.env.APP_ENCRYPTION_KEY || DEFAULT_SECRET;
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sign(data) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function verifyCrdtToken(token) {
  const [payloadRaw, signature] = String(token || "").split(".");
  if (!payloadRaw || !signature) return null;

  const expected = sign(payloadRaw);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadRaw).toString("utf8"));
    if (payload?.v !== 1) return null;
    if (!payload?.nodeId || !payload?.actorId) return null;
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
