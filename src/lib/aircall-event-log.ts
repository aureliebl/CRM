export type AircallWebhookEventLog = {
  id: string;
  event: string;
  resource: string;
  callId?: string;
  messageId?: string;
  receivedAt: string;
  payload: unknown;
};

type AircallEventLogState = {
  events: AircallWebhookEventLog[];
};

const MAX_AIRCALL_EVENT_LOGS = 500;

function getEventLogState(): AircallEventLogState {
  const globalWithLog = globalThis as typeof globalThis & {
    __costotestAircallEventLog?: AircallEventLogState;
  };

  if (!globalWithLog.__costotestAircallEventLog) {
    globalWithLog.__costotestAircallEventLog = {
      events: [],
    };
  }

  return globalWithLog.__costotestAircallEventLog;
}

function extractString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getNestedData(payload: Record<string, unknown>): Record<string, unknown> {
  const data = payload.data;
  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return payload;
}

export function logAircallWebhookEvent(payload: unknown): AircallWebhookEventLog {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = getNestedData(root);

  const event = extractString(root, ["event", "type", "name"]);
  const resource = extractString(root, ["resource", "kind"]) || "unknown";
  const callId = extractString(data, ["id", "call_id", "callId"]);
  const messageId = extractString(data, ["id", "message_id", "messageId"]);

  const entry: AircallWebhookEventLog = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    event,
    resource,
    callId: resource === "call" ? callId || undefined : undefined,
    messageId: resource === "message" ? messageId || undefined : undefined,
    receivedAt: new Date().toISOString(),
    payload,
  };

  const state = getEventLogState();
  state.events.unshift(entry);
  if (state.events.length > MAX_AIRCALL_EVENT_LOGS) {
    state.events.length = MAX_AIRCALL_EVENT_LOGS;
  }

  return entry;
}

export function getAircallWebhookEvents(limit = 50): AircallWebhookEventLog[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 50;
  return getEventLogState().events.slice(0, safeLimit);
}
