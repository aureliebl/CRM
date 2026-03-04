import crypto from "node:crypto";

type CrdtTokenPayload = {
  v: 1;
  actorId: string;
  actorName: string;
  role: "admin" | "operator";
  nodeId: string;
  canWrite: boolean;
  exp: number;
};

const DEFAULT_SECRET = "costockage-docs-crdt-dev-secret";

function getSecret() {
  return process.env.DOCS_CRDT_SECRET || process.env.APP_ENCRYPTION_KEY || DEFAULT_SECRET;
}

function encodeBase64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sign(data: string) {
  return encodeBase64Url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

export function createDocumentationCrdtToken(input: {
  actorId: string;
  actorName: string;
  role: "admin" | "operator";
  nodeId: string;
  canWrite: boolean;
  expiresInSeconds?: number;
}) {
  const expiresInSeconds = Math.max(30, input.expiresInSeconds ?? 60 * 10);
  const payload: CrdtTokenPayload = {
    v: 1,
    actorId: input.actorId,
    actorName: input.actorName,
    role: input.role,
    nodeId: input.nodeId,
    canWrite: input.canWrite,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const payloadRaw = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(payloadRaw);
  return `${payloadRaw}.${signature}`;
}

export function verifyDocumentationCrdtToken(token: string): CrdtTokenPayload | null {
  const [payloadRaw, signature] = token.split(".");
  if (!payloadRaw || !signature) return null;

  const expected = sign(payloadRaw);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadRaw).toString("utf8")) as CrdtTokenPayload;
    if (payload.v !== 1) return null;
    if (!payload.actorId || !payload.nodeId) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export type { CrdtTokenPayload };
