export type AircallCallDirection = "inbound" | "outbound";

export type AircallCallStatus = "ringing" | "answered" | "ended";

export interface AircallCall {
  id: string;
  direction: AircallCallDirection;
  from: string;
  to: string;
  status: AircallCallStatus;
  startedAt: string;
  endedAt?: string;
  userId?: string;
  isMuted: boolean;
  isOnHold: boolean;
}
