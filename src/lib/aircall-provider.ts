import { createHmac } from "node:crypto";

type AircallAction = "answer" | "end" | "toggleMute" | "toggleHold";

type AircallConfig = {
  baseUrl: string;
  apiId: string;
  apiToken: string;
  defaultNumberId: string;
};

type RemoteResult =
  | { ok: true; configured: boolean; callId?: string }
  | { ok: false; configured: boolean; error: string };

type RemoteContactsResult =
  | {
      ok: true;
      configured: boolean;
      contacts: Array<Record<string, unknown>>;
      total?: number;
      page?: number;
      perPage?: number;
    }
  | { ok: false; configured: boolean; error: string };

type RemoteSmsResult =
  | {
      ok: true;
      configured: boolean;
      messageId?: string;
      payload?: unknown;
    }
  | { ok: false; configured: boolean; error: string };

function getAircallConfig(): AircallConfig | null {
  const baseUrl = (process.env.AIRCALL_API_BASE_URL ?? "").trim();
  const apiId = (process.env.AIRCALL_API_ID ?? "").trim();
  const apiToken = (process.env.AIRCALL_API_TOKEN ?? "").trim();
  const defaultNumberId = (process.env.AIRCALL_API_NUMBER_ID ?? "").trim();

  if (!baseUrl || !apiId || !apiToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiId,
    apiToken,
    defaultNumberId,
  };
}

function buildAuthHeader(config: AircallConfig): string {
  const basic = Buffer.from(`${config.apiId}:${config.apiToken}`).toString("base64");
  return `Basic ${basic}`;
}

function extractCallId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;

  const fromRoot = root.id;
  if (typeof fromRoot === "string" && fromRoot.trim()) {
    return fromRoot;
  }

  const call = root.call;
  if (call && typeof call === "object") {
    const fromCall = (call as Record<string, unknown>).id;
    if (typeof fromCall === "string" && fromCall.trim()) {
      return fromCall;
    }
  }

  return undefined;
}

function resolvePathForAction(action: AircallAction, callId: string): string {
  const defaults: Record<AircallAction, string> = {
    answer: "/calls/{callId}/answer",
    end: "/calls/{callId}/hangup",
    toggleMute: "/calls/{callId}/toggle-mute",
    toggleHold: "/calls/{callId}/toggle-hold",
  };

  const customByAction: Record<AircallAction, string> = {
    answer: process.env.AIRCALL_API_ANSWER_PATH ?? "",
    end: process.env.AIRCALL_API_END_PATH ?? "",
    toggleMute: process.env.AIRCALL_API_TOGGLE_MUTE_PATH ?? "",
    toggleHold: process.env.AIRCALL_API_TOGGLE_HOLD_PATH ?? "",
  };

  const template = (customByAction[action] || defaults[action]).trim();
  return template.replaceAll("{callId}", encodeURIComponent(callId));
}

export function isAircallApiConfigured(): boolean {
  return !!getAircallConfig();
}

export async function createAircallOutboundCall(phoneNumber: string, userId: string): Promise<RemoteResult> {
  const config = getAircallConfig();
  if (!config) {
    return { ok: true, configured: false };
  }

  const path = (process.env.AIRCALL_API_START_PATH ?? "/calls").trim();
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const body: Record<string, unknown> = {
    to: phoneNumber,
    metadata: {
      actorId: userId,
    },
  };

  if (config.defaultNumberId) {
    body.number_id = config.defaultNumberId;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        error: `Aircall outbound failed (${res.status})`,
      };
    }

    const payload = await res.json().catch(() => null);
    return {
      ok: true,
      configured: true,
      callId: extractCallId(payload),
    };
  } catch {
    return {
      ok: false,
      configured: true,
      error: "Aircall outbound request failed",
    };
  }
}

export async function performAircallAction(callId: string, action: AircallAction): Promise<RemoteResult> {
  const config = getAircallConfig();
  if (!config) {
    return { ok: true, configured: false };
  }

  const path = resolvePathForAction(action, callId);
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const method = action === "end" ? "POST" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: buildAuthHeader(config),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        error: `Aircall action '${action}' failed (${res.status})`,
      };
    }

    return { ok: true, configured: true };
  } catch {
    return {
      ok: false,
      configured: true,
      error: `Aircall action '${action}' request failed`,
    };
  }
}

export async function fetchAircallContacts(page = 1, perPage = 50): Promise<RemoteContactsResult> {
  const config = getAircallConfig();
  if (!config) {
    return {
      ok: true,
      configured: false,
      contacts: [],
      total: 0,
      page,
      perPage,
    };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.max(1, Math.min(100, Math.floor(perPage)));
  const url = `${config.baseUrl}/contacts?page=${safePage}&per_page=${safePerPage}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: buildAuthHeader(config),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        error: `Aircall contacts sync failed (${res.status})`,
      };
    }

    const payload = (await res.json().catch(() => null)) as
      | {
          contacts?: Array<Record<string, unknown>>;
          meta?: { total?: number; current_page?: number; per_page?: number };
        }
      | null;

    return {
      ok: true,
      configured: true,
      contacts: payload?.contacts ?? [],
      total: payload?.meta?.total,
      page: payload?.meta?.current_page ?? safePage,
      perPage: payload?.meta?.per_page ?? safePerPage,
    };
  } catch {
    return {
      ok: false,
      configured: true,
      error: "Aircall contacts sync request failed",
    };
  }
}

export async function sendAircallSms(input: {
  to: string;
  body: string;
  numberId?: string;
}): Promise<RemoteSmsResult> {
  const config = getAircallConfig();
  if (!config) {
    return { ok: true, configured: false };
  }

  const numberId =
    (input.numberId ?? "").trim() ||
    (process.env.AIRCALL_API_SMS_NUMBER_ID ?? "").trim() ||
    config.defaultNumberId;

  if (!numberId) {
    return {
      ok: false,
      configured: true,
      error: "Missing Aircall SMS number id",
    };
  }

  const to = input.to.trim();
  const body = input.body.trim();
  if (!to || !body) {
    return {
      ok: false,
      configured: true,
      error: "Missing SMS recipient or body",
    };
  }

  const url = `${config.baseUrl}/numbers/${encodeURIComponent(numberId)}/messages/send`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, body }),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        error: `Aircall SMS send failed (${res.status})`,
      };
    }

    const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const idCandidate =
      (payload?.message as Record<string, unknown> | undefined)?.id ??
      payload?.id;

    return {
      ok: true,
      configured: true,
      messageId: typeof idCandidate === "string" ? idCandidate : undefined,
      payload,
    };
  } catch {
    return {
      ok: false,
      configured: true,
      error: "Aircall SMS send request failed",
    };
  }
}

function safeCompare(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return mismatch === 0;
}

function trimHeader(value: string | null): string {
  return (value ?? "").trim();
}

function extractWebhookTokenFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;

  const directCandidates = ["webhook_token", "webhookToken", "token"];
  for (const key of directCandidates) {
    const candidate = root[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const webhookObj = root.webhook;
  if (webhookObj && typeof webhookObj === "object") {
    const webhookToken = (webhookObj as Record<string, unknown>).token;
    if (typeof webhookToken === "string" && webhookToken.trim()) {
      return webhookToken.trim();
    }
  }

  return "";
}

function verifyAircallWebhookToken(req: Request, payload: unknown): boolean {
  const expectedToken = (process.env.AIRCALL_WEBHOOK_TOKEN ?? "").trim();
  if (!expectedToken) {
    return true;
  }

  const payloadToken = extractWebhookTokenFromPayload(payload);
  if (payloadToken) {
    return safeCompare(expectedToken, payloadToken);
  }

  const headerCandidates = [
    trimHeader(req.headers.get("x-aircall-webhook-token")),
    trimHeader(req.headers.get("x-webhook-token")),
  ].filter(Boolean);

  return headerCandidates.some((value) => safeCompare(expectedToken, value));
}

function verifyAircallWebhookHmac(req: Request, rawBody: string): boolean {
  const secret = (process.env.AIRCALL_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    return true;
  }

  const candidateHeaders = [
    trimHeader(req.headers.get("x-aircall-signature")),
    trimHeader(req.headers.get("x-signature")),
  ].filter(Boolean);

  if (candidateHeaders.length === 0) {
    return false;
  }

  const hmacHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const hmacBase64 = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  return candidateHeaders.some((headerValue) => {
    const normalized = headerValue.startsWith("sha256=")
      ? headerValue.slice("sha256=".length)
      : headerValue;
    return safeCompare(hmacHex, normalized) || safeCompare(hmacBase64, normalized);
  });
}

export function verifyAircallWebhookRequest(req: Request, rawBody: string, payload: unknown): boolean {
  if (!verifyAircallWebhookToken(req, payload)) {
    return false;
  }

  if (!verifyAircallWebhookHmac(req, rawBody)) {
    return false;
  }

  return true;
}