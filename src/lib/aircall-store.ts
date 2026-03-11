import type { AircallCall, AircallCallDirection, AircallCallStatus } from "@/lib/aircall-types";

type AircallListener = (call: AircallCall | null) => void;

type AircallStoreState = {
  activeCall: AircallCall | null;
  listeners: Set<AircallListener>;
};

function getStoreState(): AircallStoreState {
  const globalWithStore = globalThis as typeof globalThis & {
    __costotestAircallStore?: AircallStoreState;
  };

  if (!globalWithStore.__costotestAircallStore) {
    globalWithStore.__costotestAircallStore = {
      activeCall: null,
      listeners: new Set<AircallListener>(),
    };
  }

  return globalWithStore.__costotestAircallStore;
}

function notifyListeners(call: AircallCall | null) {
  const state = getStoreState();
  state.listeners.forEach((listener) => {
    try {
      listener(call);
    } catch {
      // no-op: listener isolation
    }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

export function getAircallActiveCall(): AircallCall | null {
  return getStoreState().activeCall;
}

export function subscribeAircallState(listener: AircallListener): () => void {
  const state = getStoreState();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

export function startAircallCall(phoneNumber: string, userId: string, forcedCallId?: string): AircallCall {
  const destination = normalizePhone(phoneNumber);
  const call: AircallCall = {
    id: forcedCallId && forcedCallId.trim() ? forcedCallId : `call-${Date.now()}`,
    direction: "outbound",
    from: process.env.AIRCALL_DEFAULT_FROM_NUMBER ?? "+33123456789",
    to: destination || phoneNumber,
    status: "ringing",
    startedAt: nowIso(),
    userId,
    isMuted: false,
    isOnHold: false,
  };

  const state = getStoreState();
  state.activeCall = call;
  notifyListeners(call);
  return call;
}

export function receiveAircallCall(phoneNumber: string): AircallCall {
  const incoming = normalizePhone(phoneNumber) || phoneNumber;
  const call: AircallCall = {
    id: `call-${Date.now()}`,
    direction: "inbound",
    from: incoming,
    to: process.env.AIRCALL_DEFAULT_FROM_NUMBER ?? "+33123456789",
    status: "ringing",
    startedAt: nowIso(),
    isMuted: false,
    isOnHold: false,
  };

  const state = getStoreState();
  state.activeCall = call;
  notifyListeners(call);
  return call;
}

export function answerAircallCall(callId: string): AircallCall | null {
  const state = getStoreState();
  if (!state.activeCall || state.activeCall.id !== callId) return null;

  state.activeCall = {
    ...state.activeCall,
    status: "answered",
    isOnHold: false,
  };

  notifyListeners(state.activeCall);
  return state.activeCall;
}

export function endAircallCall(callId: string): AircallCall | null {
  const state = getStoreState();
  if (!state.activeCall || state.activeCall.id !== callId) return null;

  const ended: AircallCall = {
    ...state.activeCall,
    status: "ended",
    endedAt: nowIso(),
  };

  state.activeCall = null;
  notifyListeners(null);
  return ended;
}

export function toggleAircallMute(callId: string): AircallCall | null {
  const state = getStoreState();
  if (!state.activeCall || state.activeCall.id !== callId || state.activeCall.status !== "answered") return null;

  state.activeCall = {
    ...state.activeCall,
    isMuted: !state.activeCall.isMuted,
  };
  notifyListeners(state.activeCall);
  return state.activeCall;
}

export function toggleAircallHold(callId: string): AircallCall | null {
  const state = getStoreState();
  if (!state.activeCall || state.activeCall.id !== callId || state.activeCall.status !== "answered") return null;

  state.activeCall = {
    ...state.activeCall,
    isOnHold: !state.activeCall.isOnHold,
  };
  notifyListeners(state.activeCall);
  return state.activeCall;
}

function extractString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = payload[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return "";
}

function extractWebhookCore(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const eventName = extractString(root, ["event", "type", "name"]).toLowerCase();

  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root.call && typeof root.call === "object"
      ? (root.call as Record<string, unknown>)
      : root;

  const callId = extractString(data, ["id", "call_id", "callId"]) || `call-${Date.now()}`;
  const from = extractString(data, ["from", "from_number", "source", "source_number"]);
  const to = extractString(data, ["to", "to_number", "destination", "destination_number"]);
  const directionRaw = extractString(data, ["direction", "call_direction"]).toLowerCase();
  const statusRaw = extractString(data, ["status", "state"]).toLowerCase();

  let direction: AircallCallDirection = directionRaw === "inbound" ? "inbound" : "outbound";
  if (!directionRaw && eventName.includes("incoming")) direction = "inbound";

  let status: AircallCallStatus = "ringing";
  if (statusRaw.includes("answer") || eventName.includes("answer")) status = "answered";
  if (statusRaw.includes("end") || statusRaw.includes("hang") || eventName.includes("end") || eventName.includes("hang")) status = "ended";

  return { callId, from, to, direction, status };
}

export function applyAircallWebhook(payload: unknown): AircallCall | null {
  const parsed = extractWebhookCore(payload);
  if (!parsed) return null;

  const state = getStoreState();
  const existing = state.activeCall;

  if (parsed.status === "ended") {
    if (existing && existing.id === parsed.callId) {
      state.activeCall = null;
      notifyListeners(null);
    }
    return null;
  }

  const next: AircallCall = {
    id: parsed.callId,
    direction: parsed.direction,
    from: parsed.from || existing?.from || process.env.AIRCALL_DEFAULT_FROM_NUMBER || "+33123456789",
    to: parsed.to || existing?.to || process.env.AIRCALL_DEFAULT_FROM_NUMBER || "+33123456789",
    status: parsed.status,
    startedAt: existing?.startedAt ?? nowIso(),
    endedAt: undefined,
    userId: existing?.userId,
    isMuted: existing?.isMuted ?? false,
    isOnHold: existing?.isOnHold ?? false,
  };

  state.activeCall = next;
  notifyListeners(next);
  return next;
}
