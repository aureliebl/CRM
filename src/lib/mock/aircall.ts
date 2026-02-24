// Mock Aircall integration

import type { Client } from "@/lib/types";
import { getClients } from "./clients";

export interface AircallCall {
  id: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: "ringing" | "answered" | "ended";
  startedAt: string;
  endedAt?: string;
  userId?: string;
}

let activeCall: AircallCall | null = null;
const callListeners: Array<(call: AircallCall | null) => void> = [];

export function getActiveCall(): AircallCall | null {
  return activeCall;
}

export function startCall(phoneNumber: string, userId: string): AircallCall {
  const call: AircallCall = {
    id: `call-${Date.now()}`,
    direction: "outbound",
    from: "+33123456789", // Mock number
    to: phoneNumber,
    status: "ringing",
    startedAt: new Date().toISOString(),
    userId,
  };
  activeCall = call;
  notifyListeners(call);
  return call;
}

export function receiveCall(phoneNumber: string): AircallCall | null {
  // Trouver le client correspondant au numéro (normalisé)
  const clients = getClients();
  const normalize = (s?: string) => (s ? s.replace(/\D/g, "") : "");
  const target = normalize(phoneNumber);
  const client = clients.find((c) => normalize(c.phone) === target || normalize(c.phone).endsWith(target));

  if (!client) {
    console.log(`Aucun client trouvé pour le numéro ${phoneNumber} — création d'un appel non apparié`);
  }

  const call: AircallCall = {
    id: `call-${Date.now()}`,
    direction: "inbound",
    from: phoneNumber,
    to: "+33123456789",
    status: "ringing",
    startedAt: new Date().toISOString(),
  };
  activeCall = call;
  notifyListeners(call);
  return call;
}

export function answerCall(callId: string) {
  if (activeCall && activeCall.id === callId) {
    activeCall.status = "answered";
    notifyListeners(activeCall);
  }
}

export function endCall(callId: string) {
  if (activeCall && activeCall.id === callId) {
    activeCall.status = "ended";
    activeCall.endedAt = new Date().toISOString();
    const ended = activeCall;
    activeCall = null;
    notifyListeners(null);
    return ended;
  }
  return null;
}

export function subscribeToCalls(
  callback: (call: AircallCall | null) => void
): () => void {
  callListeners.push(callback);
  return () => {
    const index = callListeners.indexOf(callback);
    if (index > -1) callListeners.splice(index, 1);
  };
}

function notifyListeners(call: AircallCall | null) {
  callListeners.forEach((cb) => cb(call));
}

// Simuler un appel entrant pour les tests
export function simulateIncomingCall(phoneNumber: string) {
  return receiveCall(phoneNumber);
}
