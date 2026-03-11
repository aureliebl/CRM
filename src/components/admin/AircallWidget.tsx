"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientFromPhone, getClients } from "@/lib/mock/clients";
import { useLocale } from "@/lib/use-locale";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import type { AircallCall } from "@/lib/aircall-types";

type AircallEventLogItem = {
  id: string;
  event: string;
  resource: string;
  callId?: string;
  messageId?: string;
  receivedAt: string;
};

function getStoredSectionState(storageKey: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  const raw = window.localStorage.getItem(storageKey);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return defaultValue;
}

function formatDuration(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function fetchAircallState(): Promise<AircallCall | null> {
  const res = await fetch("/api/aircall/calls", { cache: "no-store" });
  if (!res.ok) {
    return null;
  }
  const payload = (await res.json()) as { call?: AircallCall | null };
  return payload.call ?? null;
}

async function startAircallCallRequest(phoneNumber: string): Promise<AircallCall | null> {
  const res = await fetch("/api/aircall/calls", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phoneNumber }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { call?: AircallCall | null };
  return payload.call ?? null;
}

async function sendAircallAction(callId: string, action: "answer" | "end" | "toggleMute" | "toggleHold"): Promise<AircallCall | null> {
  const res = await fetch(`/api/aircall/calls/${callId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { call?: AircallCall | null };
  return payload.call ?? null;
}

async function simulateInboundCallRequest(phoneNumber: string): Promise<AircallCall | null> {
  const res = await fetch("/api/aircall/simulate/inbound", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phoneNumber }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { call?: AircallCall | null };
  return payload.call ?? null;
}

async function sendAircallSmsRequest(input: { to: string; body: string }): Promise<boolean> {
  const res = await fetch("/api/aircall/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return res.ok;
}

async function syncAircallContactsRequest(): Promise<number | null> {
  let page = 1;
  const perPage = 100;
  let syncedCount = 0;
  let maxPages = 20;

  while (maxPages > 0) {
    const res = await fetch(`/api/aircall/contacts?page=${page}&perPage=${perPage}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as {
      contacts?: Array<Record<string, unknown>>;
      page?: number;
      perPage?: number;
      total?: number;
    };

    const contacts = payload.contacts ?? [];
    syncedCount += contacts.length;

    const total = typeof payload.total === "number" ? payload.total : undefined;
    if (contacts.length === 0) {
      break;
    }
    if (typeof total === "number" && syncedCount >= total) {
      break;
    }

    page += 1;
    maxPages -= 1;
  }

  return syncedCount;
}

async function fetchAircallEventLogsRequest(limit = 10): Promise<AircallEventLogItem[]> {
  const res = await fetch(`/api/aircall/events/logs?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return [];
  }

  const payload = (await res.json()) as { events?: AircallEventLogItem[] };
  return payload.events ?? [];
}

export function AircallWidget() {
  const SPECTRUM_BARS = 24;
  const PANEL_OPEN_STORAGE_KEY = "aircall:widget:panel-open";
  const CONTACTS_SECTION_STORAGE_KEY = "aircall:widget:contacts-open";
  const API_SECTION_STORAGE_KEY = "aircall:widget:api-open";
  const { locale } = useLocale();
  const labels =
    locale === "fr"
      ? {
          incoming: "Appel entrant",
          outgoing: "Appel sortant",
          answer: "Répondre",
          hangup: "Raccrocher",
          searchContact: "Rechercher un contact...",
          noContact: "Aucun contact trouvé",
          hide: "Masquer",
          show: "Afficher",
          simulation: "simulation",
          testNumber: "Numéro test",
          test: "Tester",
          mute: "Muet",
          unmute: "Activer micro",
          hold: "Mettre en attente",
          resume: "Reprendre",
          onHold: "En attente",
          activeCall: "Appel en cours",
          openClient: "Ouvrir la fiche",
          createClient: "Créer la fiche",
          collapse: "Réduire",
          expand: "Développer",
          userTrack: "Vous",
          clientTrack: "Client",
          contactsTitle: "Contacts",
          toolsTitle: "Aircall API",
          smsTo: "Numéro SMS",
          smsBody: "Message SMS",
          smsSend: "Envoyer SMS",
          smsSent: "SMS envoyé",
          smsFailed: "Échec envoi SMS",
          syncContacts: "Sync contacts",
          syncOk: "contacts synchronisés",
          syncFailed: "Échec sync contacts",
          eventsTitle: "Événements webhook",
          refresh: "Rafraîchir",
          noEvents: "Aucun événement",
        }
      : {
          incoming: "Incoming call",
          outgoing: "Outgoing call",
          answer: "Answer",
          hangup: "Hang up",
          searchContact: "Search a contact...",
          noContact: "No contact found",
          hide: "Hide",
          show: "Show",
          simulation: "simulation",
          testNumber: "Test number",
          test: "Test",
          mute: "Mute",
          unmute: "Unmute",
          hold: "Hold",
          resume: "Resume",
          onHold: "On hold",
          activeCall: "Active call",
          openClient: "Open client",
          createClient: "Create client",
          collapse: "Collapse",
          expand: "Expand",
          userTrack: "You",
          clientTrack: "Client",
          contactsTitle: "Contacts",
          toolsTitle: "Aircall API",
          smsTo: "SMS number",
          smsBody: "SMS body",
          smsSend: "Send SMS",
          smsSent: "SMS sent",
          smsFailed: "SMS send failed",
          syncContacts: "Sync contacts",
          syncOk: "contacts synced",
          syncFailed: "Contacts sync failed",
          eventsTitle: "Webhook events",
          refresh: "Refresh",
          noEvents: "No events",
        };
  const [call, setCall] = useState<AircallCall | null>(null);
  const [showContacts, setShowContacts] = useState(() =>
    getStoredSectionState(PANEL_OPEN_STORAGE_KEY, false)
  );
  const [searchContact, setSearchContact] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [simNumber, setSimNumber] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);
  const [localSpectrum, setLocalSpectrum] = useState<number[]>(() => Array.from({ length: SPECTRUM_BARS }, () => 0));
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [smsTo, setSmsTo] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<"" | "ok" | "error">("");
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [contactsSynced, setContactsSynced] = useState<number | null>(null);
  const [eventLogs, setEventLogs] = useState<AircallEventLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isContactsSectionOpen, setIsContactsSectionOpen] = useState(() =>
    getStoredSectionState(CONTACTS_SECTION_STORAGE_KEY, true)
  );
  const [isApiSectionOpen, setIsApiSectionOpen] = useState(() =>
    getStoredSectionState(API_SECTION_STORAGE_KEY, true)
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ringtoneContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<number | null>(null);
  const holdMusicContextRef = useRef<AudioContext | null>(null);
  const holdOscillatorRef = useRef<OscillatorNode | null>(null);
  const holdGainRef = useRef<GainNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);
  const router = useRouter();
  const clients = getClients();

  const spectrumTracks = useMemo(() => {
    const width = 300;
    const height = 56;
    const baseline = 50;
    const holdAttenuation = call?.isOnHold ? 0.2 : 1;
    const baseLevels = Array.from({ length: SPECTRUM_BARS }, (_, index) => {
      const sourceIndex = Math.floor(
        (index / Math.max(1, SPECTRUM_BARS - 1)) * Math.max(0, localSpectrum.length - 1)
      );
      return localSpectrum[sourceIndex] ?? 0;
    });

    const computeSideLevel = (value: number, index: number) => {
      const centerDistance = Math.abs(index - (SPECTRUM_BARS - 1) / 2) / ((SPECTRUM_BARS - 1) / 2);
      const centerDamping = 0.38 + centerDistance * 0.62;
      const shaped = Math.pow(Math.min(1, value), 0.8) * 0.95;
      return Math.min(1, shaped * centerDamping * holdAttenuation);
    };

    const userLevels = Array.from({ length: SPECTRUM_BARS }, (_, index) => {
      const level = computeSideLevel(baseLevels[index] ?? 0, index);
      return call?.isMuted ? 0 : level;
    });

    const clientLevels = Array.from({ length: SPECTRUM_BARS }, () => 0);

    const buildTrack = (levels: number[], xShift = 0) => {
      const points = levels.map((level, index) => {
        const isFirst = index === 0;
        const isLast = index === levels.length - 1;
        const xRaw = (index / Math.max(1, levels.length - 1)) * width + xShift;
        const x = isFirst ? 0 : isLast ? width : Math.max(0, Math.min(width, xRaw));
        const y = baseline - level * 70;
        return { x, y, level };
      });

      const linePath = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");
      const areaPath = `${linePath} L ${width} ${baseline} L 0 ${baseline} Z`;

      return { points, linePath, areaPath };
    };

    const step = width / Math.max(1, SPECTRUM_BARS - 1);
    const userTrack = buildTrack(userLevels, 0);
    const clientTrack = buildTrack(clientLevels, step * 0.45);

    return { width, height, baseline, userTrack, clientTrack };
  }, [localSpectrum, call?.isOnHold, call?.isMuted, SPECTRUM_BARS]);

  const activePhone = useMemo(() => {
    if (!call) return "";
    return call.direction === "inbound" ? call.from : call.to;
  }, [call]);

  const matchingClient = useMemo(() => {
    const normalize = (value?: string) => (value ?? "").replace(/\D/g, "");
    const target = normalize(activePhone);
    if (!target) return null;
    return clients.find((client) => {
      const candidate = normalize(client.phone);
      return candidate === target || candidate.endsWith(target) || target.endsWith(candidate);
    }) ?? null;
  }, [activePhone, clients]);

  useEffect(() => {
    const handleToggle = () => {
      setIsCollapsed(false);
      setShowContacts((prev) => !prev);
    };

    const handleOutside = (event: MouseEvent) => {
      if (!showContacts) return;
      if (call) return; // Don't close on outside click during an active call
      const node = panelRef.current;
      const target = event.target as Node | null;
      if (node && target && !node.contains(target)) {
        setShowContacts(false);
      }
    };

    window.addEventListener("aircall:toggle", handleToggle);
    window.addEventListener("mousedown", handleOutside);

    return () => {
      window.removeEventListener("aircall:toggle", handleToggle);
      window.removeEventListener("mousedown", handleOutside);
    };
  }, [showContacts, call]);

  useEffect(() => {
    let mounted = true;
    const applyCall = (nextCall: AircallCall | null) => {
      if (!mounted) return;
      // Auto-expand the widget when a new call arrives
      if (nextCall) {
        setIsCollapsed(false);
      }
      setCall(nextCall);
    };

    fetchAircallState().then((nextCall) => {
      applyCall(nextCall);
    });

    const events = new EventSource("/api/aircall/events");
    events.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { call?: AircallCall | null };
        applyCall(payload.call ?? null);
      } catch {
        // ignore malformed event payload
      }
    };

    events.onerror = () => {
      events.close();
      window.setTimeout(() => {
        if (!mounted) return;
        fetchAircallState().then((nextCall) => applyCall(nextCall));
      }, 1200);
    };

    return () => {
      mounted = false;
      events.close();
    };
  }, []);

  useEffect(() => {
    if (!call || call.direction !== "inbound") return;
    const normalize = (value?: string) => (value ?? "").replace(/\D/g, "");
    const target = normalize(call.from);
    if (!target) return;
    const client = clients.find((c) => {
      const candidate = normalize(c.phone);
      return candidate === target || candidate.endsWith(target) || target.endsWith(candidate);
    });
    if (client) {
      router.push(`/crm/${client.id}`);
    }
  }, [call?.id, call?.direction, call?.from, clients, router]);

  useEffect(() => {
    if (!call || call.status !== "answered") {
      const resetTimer = window.setTimeout(() => setCallSeconds(0), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const started = new Date(call.startedAt).getTime();
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
      setCallSeconds(elapsed);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [call?.id, call?.status, call?.startedAt]);

  useEffect(() => {
    const shouldRing = !!call && call.status === "ringing";

    const stopRinging = () => {
      if (ringtoneIntervalRef.current) {
        window.clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }
      if (ringtoneContextRef.current) {
        ringtoneContextRef.current.close().catch(() => undefined);
        ringtoneContextRef.current = null;
      }
    };

    if (!shouldRing) {
      stopRinging();
      return;
    }

    if (!ringtoneContextRef.current) {
      ringtoneContextRef.current = new AudioContext();
    }

    const context = ringtoneContextRef.current;

    const beep = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 900;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
      oscillator.stop(context.currentTime + 0.3);
    };

    beep();
    ringtoneIntervalRef.current = window.setInterval(beep, 1100);

    return stopRinging;
  }, [call?.id, call?.status]);

  useEffect(() => {
    const stopHoldMusic = () => {
      if (holdOscillatorRef.current) {
        holdOscillatorRef.current.stop();
        holdOscillatorRef.current.disconnect();
        holdOscillatorRef.current = null;
      }
      if (holdGainRef.current) {
        holdGainRef.current.disconnect();
        holdGainRef.current = null;
      }
      if (holdMusicContextRef.current) {
        holdMusicContextRef.current.close().catch(() => undefined);
        holdMusicContextRef.current = null;
      }
    };

    if (!call || call.status !== "answered" || !call.isOnHold) {
      stopHoldMusic();
      return;
    }

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 262;
    gain.gain.value = 0.03;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();

    holdMusicContextRef.current = context;
    holdOscillatorRef.current = oscillator;
    holdGainRef.current = gain;

    return stopHoldMusic;
  }, [call?.id, call?.status, call?.isOnHold]);

  useEffect(() => {
    const stopMic = () => {
      if (micRafRef.current) {
        window.cancelAnimationFrame(micRafRef.current);
        micRafRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }
      if (micAudioContextRef.current) {
        micAudioContextRef.current.close().catch(() => undefined);
        micAudioContextRef.current = null;
      }
      setLocalSpectrum(Array.from({ length: SPECTRUM_BARS }, () => 0));
    };

    if (!call || call.status !== "answered" || call.isMuted) {
      stopMic();
      return;
    }

    let disposed = false;

    const startMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.45;
        source.connect(analyser);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const timeData = new Uint8Array(analyser.fftSize);
        const update = () => {
          analyser.getByteFrequencyData(freqData);
          analyser.getByteTimeDomainData(timeData);

          let sumSquares = 0;
          for (let index = 0; index < timeData.length; index += 1) {
            const centered = (timeData[index] - 128) / 128;
            sumSquares += centered * centered;
          }
          const rms = Math.sqrt(sumSquares / Math.max(1, timeData.length));
          const loudness = Math.min(1, Math.pow(rms * 2.35, 0.95));

          const nyquist = context.sampleRate / 2;
          const hzPerBin = nyquist / freqData.length;
          const speechMinHz = 120;
          const speechMaxHz = 4200;
          const minBin = Math.max(1, Math.floor(speechMinHz / hzPerBin));
          const maxBin = Math.min(freqData.length - 1, Math.ceil(speechMaxHz / hzPerBin));

          const rawBars = Array.from({ length: SPECTRUM_BARS }, (_, barIndex) => {
            const t0 = barIndex / SPECTRUM_BARS;
            const t1 = (barIndex + 1) / SPECTRUM_BARS;
            const start = Math.floor(minBin + Math.pow(t0, 1.12) * (maxBin - minBin));
            const end = Math.floor(minBin + Math.pow(t1, 1.12) * (maxBin - minBin));
            let totalSquare = 0;
            let samples = 0;
            for (let freqIndex = start; freqIndex <= Math.max(start, end); freqIndex += 1) {
              const normalizedBin = freqData[freqIndex] / 255;
              totalSquare += normalizedBin * normalizedBin;
              samples += 1;
            }
            const bandRms = samples > 0 ? Math.sqrt(totalSquare / samples) : 0;
            return Math.min(1, Math.pow(bandRms, 0.9));
          });

          const frameMax = Math.max(0.001, ...rawBars);
          const frameMean = rawBars.reduce((sum, value) => sum + value, 0) / Math.max(1, rawBars.length);
          const denominator = Math.max(0.1, frameMax * 1.22 + frameMean * 0.35);
          const normalizedBars = rawBars.map((value) => Math.min(1, Math.pow(value / denominator, 1.08)));

          const spread = normalizedBars.map((value, index) => {
            const left = normalizedBars[index - 1] ?? value;
            const right = normalizedBars[index + 1] ?? value;
            return value * 0.5 + left * 0.25 + right * 0.25;
          });

          const withLoudness = spread.map((value) => {
            const floor = loudness * 0.22;
            const mixed = value * 0.78 + floor;
            if (loudness < 0.035) {
              return mixed * (loudness / 0.035);
            }
            return mixed;
          });

          setLocalSpectrum((previous) =>
            withLoudness.map((value, index) => {
              const prev = previous[index] ?? 0;
              const edgeFactor = Math.abs(index - (SPECTRUM_BARS - 1) / 2) / ((SPECTRUM_BARS - 1) / 2);
              if (value >= prev) {
                return prev * 0.78 + value * 0.22;
              }
              const releasePrevWeight = 0.58 - edgeFactor * 0.2;
              const releaseNextWeight = 1 - releasePrevWeight;
              const released = prev * releasePrevWeight + value * releaseNextWeight;
              return released < 0.01 ? 0 : released;
            })
          );
          micRafRef.current = window.requestAnimationFrame(update);
        };

        micStreamRef.current = stream;
        micAudioContextRef.current = context;
        update();
      } catch {
        setLocalSpectrum(Array.from({ length: SPECTRUM_BARS }, () => 0));
      }
    };

    startMic();

    return () => {
      disposed = true;
      stopMic();
    };
  }, [call?.id, call?.status, call?.isMuted]);

  const handleAnswer = async () => {
    if (!call) return;
    const nextCall = await sendAircallAction(call.id, "answer");
    if (nextCall) setCall(nextCall);
  };

  const handleEnd = async () => {
    if (!call) return;
    await sendAircallAction(call.id, "end");
    setCall(null);
  };

  const handleOpenOrCreateClient = () => {
    if (!activePhone) return;
    const client = matchingClient ?? createClientFromPhone(activePhone);
    router.push(`/crm/${client.id}`);
  };

  const handleCall = async (phoneNumber: string) => {
    const started = await startAircallCallRequest(phoneNumber);
    if (started) {
      setCall(started);
      setShowContacts(false);
      setSearchContact("");
    }
  };

  const handleToggleMute = async () => {
    if (!call) return;
    const nextCall = await sendAircallAction(call.id, "toggleMute");
    if (nextCall) setCall(nextCall);
  };

  const handleToggleHold = async () => {
    if (!call) return;
    const nextCall = await sendAircallAction(call.id, "toggleHold");
    if (nextCall) setCall(nextCall);
  };

  const handleSendSms = async () => {
    if (isSendingSms) return;
    if (!smsTo.trim() || !smsBody.trim()) {
      setSmsFeedback("error");
      return;
    }

    setIsSendingSms(true);
    setSmsFeedback("");
    const ok = await sendAircallSmsRequest({ to: smsTo.trim(), body: smsBody.trim() });
    setSmsFeedback(ok ? "ok" : "error");
    if (ok) {
      setSmsBody("");
    }
    setIsSendingSms(false);
  };

  const handleSyncContacts = async () => {
    if (isSyncingContacts) return;
    setIsSyncingContacts(true);
    const synced = await syncAircallContactsRequest();
    setContactsSynced(synced === null ? -1 : synced);
    setIsSyncingContacts(false);
  };

  const refreshEventLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    const items = await fetchAircallEventLogsRequest(8);
    setEventLogs(items);
    setIsLoadingLogs(false);
  }, []);

  useEffect(() => {
    if (!showContacts) return;
    const task = window.setTimeout(() => {
      refreshEventLogs();
    }, 0);
    return () => window.clearTimeout(task);
  }, [showContacts, refreshEventLogs]);

  useEffect(() => {
    window.localStorage.setItem(
      CONTACTS_SECTION_STORAGE_KEY,
      isContactsSectionOpen ? "1" : "0"
    );
  }, [CONTACTS_SECTION_STORAGE_KEY, isContactsSectionOpen]);

  useEffect(() => {
    window.localStorage.setItem(
      API_SECTION_STORAGE_KEY,
      isApiSectionOpen ? "1" : "0"
    );
  }, [API_SECTION_STORAGE_KEY, isApiSectionOpen]);

  useEffect(() => {
    window.localStorage.setItem(
      PANEL_OPEN_STORAGE_KEY,
      showContacts ? "1" : "0"
    );
  }, [PANEL_OPEN_STORAGE_KEY, showContacts]);

  const filteredContacts = clients.filter((c) =>
    `${c.fullName} ${c.phone}`.toLowerCase().includes(searchContact.toLowerCase())
  );

  if (isCollapsed) {
    return (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 1000,
          background: "var(--modal-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "999px",
          padding: "0.45rem",
          boxShadow: `0 10px 40px var(--shadow-color)`,
          display: "flex",
          gap: "0.35rem",
          alignItems: "center",
          animation: "aircallWidgetCollapseIn 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <button
          type="button"
          title={labels.expand}
          onClick={() => setIsCollapsed(false)}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "999px",
            border: "1px solid var(--border-color)",
            background: "var(--button-bg)",
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialSymbol name="chevron_left" size={18} weight={500} opticalSize={20} />
        </button>
        {call && (
          <button
            type="button"
            title={labels.hangup}
            onClick={handleEnd}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(120deg,#ef4444,#dc2626)",
              color: "#fff",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialSymbol name="call_end" size={16} weight={500} opticalSize={20} />
          </button>
        )}
      </div>
    );
  }

  if (call) {
    return (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 1000,
          background: "var(--modal-bg)",
          borderRadius: "1rem",
          padding: "1rem",
          border: "1px solid var(--border-color)",
          boxShadow: `0 10px 40px var(--shadow-color)`,
          minWidth: "280px",
          animation: "aircallWidgetExpandIn 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {call.direction === "inbound" ? labels.incoming : labels.outgoing}
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginTop: "0.15rem",
              }}
            >
              {call.direction === "inbound" ? call.from : call.to}
            </div>
            {call.status === "answered" && (
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                {call.isOnHold ? labels.onHold : labels.activeCall} · {formatDuration(callSeconds)}
              </div>
            )}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background:
                  call.status === "ringing"
                    ? "#f59e0b"
                    : call.status === "answered"
                    ? "#10b981"
                    : "#ef4444",
                animation: call.status === "ringing" ? "pulse 2s infinite" : "none",
              }}
            />
            <button
              type="button"
              title={labels.collapse}
              onClick={() => setIsCollapsed(true)}
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "999px",
                border: "1px solid var(--border-color)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialSymbol name="chevron_right" size={18} weight={500} opticalSize={20} />
            </button>
          </div>
        </div>

        {call.status === "answered" && (
          <div style={{ marginBottom: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.22rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{labels.userTrack}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{labels.clientTrack}</div>
            </div>
            <div style={{ borderRadius: "0.65rem", background: "var(--button-bg)", padding: "0.25rem 0.35rem" }}>
              <svg width="100%" height={spectrumTracks.height} viewBox={`0 0 ${spectrumTracks.width} ${spectrumTracks.height}`} preserveAspectRatio="none">
                <path d={spectrumTracks.userTrack.areaPath} fill="rgba(34,197,94,0.16)" />
                <path d={spectrumTracks.clientTrack.areaPath} fill="rgba(245,158,11,0.16)" />

                <path d={spectrumTracks.userTrack.linePath} fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d={spectrumTracks.clientTrack.linePath} fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

                {spectrumTracks.userTrack.points.map((point, index) => (
                  index % 2 === 0 ? (
                  <circle
                    key={`user-dot-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={1.25}
                    fill="#22c55e"
                    fillOpacity={0.45 + point.level * 0.35}
                  />
                  ) : null
                ))}

                {spectrumTracks.clientTrack.points.map((point, index) => (
                  index % 2 === 0 ? (
                  <circle
                    key={`client-dot-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={1.25}
                    fill="#f59e0b"
                    fillOpacity={0.45 + point.level * 0.35}
                  />
                  ) : null
                ))}
              </svg>
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {call.status === "ringing" && call.direction === "inbound" && (
            <button
              type="button"
              onClick={handleAnswer}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "999px",
                border: "none",
                background: "linear-gradient(120deg, #10b981, #059669)",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              {labels.answer}
            </button>
          )}

          {call.status === "answered" && (
            <>
              <button
                type="button"
                onClick={handleOpenOrCreateClient}
                style={{
                  padding: "0.5rem 0.8rem",
                  borderRadius: "999px",
                  border: "1px solid var(--border-color)",
                  background: "var(--button-bg)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <MaterialSymbol name="contact_phone" size={16} weight={500} opticalSize={20} />
                {matchingClient ? labels.openClient : labels.createClient}
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                style={{
                  padding: "0.5rem 0.8rem",
                  borderRadius: "999px",
                  border: call.isMuted ? "1px solid rgba(239,68,68,0.55)" : "1px solid var(--border-color)",
                  background: call.isMuted ? "rgba(239,68,68,0.2)" : "var(--button-bg)",
                  color: call.isMuted ? "#b91c1c" : "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: call.isMuted ? 600 : 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <MaterialSymbol
                  name={call.isMuted ? "mic_off" : "mic"}
                  size={16}
                  weight={500}
                  opticalSize={20}
                  fill={call.isMuted ? 1 : 0}
                />
                {call.isMuted ? labels.unmute : labels.mute}
              </button>

              <button
                type="button"
                onClick={handleToggleHold}
                style={{
                  padding: "0.5rem 0.8rem",
                  borderRadius: "999px",
                  border: "1px solid var(--border-color)",
                  background: call.isOnHold ? "rgba(245,158,11,0.18)" : "var(--button-bg)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <MaterialSymbol name={call.isOnHold ? "play_arrow" : "pause"} size={16} weight={500} opticalSize={20} />
                {call.isOnHold ? labels.resume : labels.hold}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleEnd}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(120deg,#ef4444,#dc2626)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {labels.hangup}
          </button>
        </div>
      </div>
    );
  }

  // No active call — only render the panel when explicitly opened via the header button
  if (!showContacts) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 1000,
        animation: "aircallWidgetExpandIn 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.5rem",
        }}
      >
        <div
            style={{
              background: "var(--modal-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "0.75rem",
              padding: "0.75rem",
              boxShadow: "0 10px 40px var(--shadow-color)",
              width: "320px",
              marginBottom: "0.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.35rem" }}>
              <button
                type="button"
                title={labels.collapse}
                onClick={() => {
                  setIsCollapsed(true);
                  setShowContacts(false);
                }}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "999px",
                  border: "1px solid var(--border-color)",
                  background: "var(--button-bg)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialSymbol name="chevron_right" size={16} weight={500} opticalSize={20} />
              </button>
            </div>

            <div style={{ marginTop: "0.2rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setIsContactsSectionOpen((prev) => !prev)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid var(--border-color)",
                  background: "var(--button-bg)",
                  color: "var(--text-primary)",
                  borderRadius: "0.5rem",
                  padding: "0.4rem 0.5rem",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {labels.contactsTitle}
                <MaterialSymbol
                  name={isContactsSectionOpen ? "expand_less" : "expand_more"}
                  size={16}
                  weight={500}
                  opticalSize={20}
                />
              </button>

              {isContactsSectionOpen && (
                <>
                  <input
                    type="text"
                    placeholder={labels.searchContact}
                    value={searchContact}
                    onChange={(e) => setSearchContact(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.5rem",
                      border: "1px solid var(--border-color)",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      marginTop: "0.45rem",
                      marginBottom: "0.5rem",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                  <div
                    style={{
                      maxHeight: "300px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    {filteredContacts.length > 0 ? (
                      filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleCall(contact.phone || "")}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.5rem",
                            border: "1px solid var(--border-color)",
                            background: "var(--button-bg)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            textAlign: "left",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--border-hover)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "var(--button-bg)";
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{contact.fullName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {contact.phone}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", padding: "0.5rem", textAlign: "center" }}>
                        {labels.noContact}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setIsApiSectionOpen((prev) => !prev)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid var(--border-color)",
                  background: "var(--button-bg)",
                  color: "var(--text-primary)",
                  borderRadius: "0.5rem",
                  padding: "0.4rem 0.5rem",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {labels.toolsTitle}
                <MaterialSymbol
                  name={isApiSectionOpen ? "expand_less" : "expand_more"}
                  size={16}
                  weight={500}
                  opticalSize={20}
                />
              </button>

              {isApiSectionOpen && (
                <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.45rem" }}>
                <input
                  type="text"
                  value={smsTo}
                  onChange={(e) => setSmsTo(e.target.value)}
                  placeholder={labels.smsTo}
                  style={{
                    width: "100%",
                    padding: "0.38rem 0.45rem",
                    borderRadius: "0.4rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: "0.75rem",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="text"
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  placeholder={labels.smsBody}
                  style={{
                    width: "100%",
                    padding: "0.38rem 0.45rem",
                    borderRadius: "0.4rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: "0.75rem",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendSms}
                  disabled={isSendingSms}
                  style={{
                    width: "100%",
                    padding: "0.38rem 0.45rem",
                    borderRadius: "0.4rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--button-bg)",
                    color: "var(--text-primary)",
                    cursor: isSendingSms ? "not-allowed" : "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  {labels.smsSend}
                </button>
                {smsFeedback !== "" && (
                  <div style={{ fontSize: "0.72rem", color: smsFeedback === "ok" ? "var(--success-text)" : "var(--error-text)" }}>
                    {smsFeedback === "ok" ? labels.smsSent : labels.smsFailed}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSyncContacts}
                  disabled={isSyncingContacts}
                  style={{
                    width: "100%",
                    padding: "0.38rem 0.45rem",
                    borderRadius: "0.4rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--button-bg)",
                    color: "var(--text-primary)",
                    cursor: isSyncingContacts ? "not-allowed" : "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  {labels.syncContacts}
                </button>
                {contactsSynced !== null && (
                  <div style={{ fontSize: "0.72rem", color: contactsSynced >= 0 ? "var(--success-text)" : "var(--error-text)" }}>
                    {contactsSynced >= 0
                      ? `${contactsSynced} ${labels.syncOk}`
                      : labels.syncFailed}
                  </div>
                )}

                <div style={{ marginTop: "0.15rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{labels.eventsTitle}</div>
                  <button
                    type="button"
                    onClick={refreshEventLogs}
                    disabled={isLoadingLogs}
                    style={{
                      border: "1px solid var(--border-color)",
                      background: "var(--button-bg)",
                      color: "var(--text-primary)",
                      borderRadius: "0.35rem",
                      fontSize: "0.68rem",
                      padding: "0.2rem 0.35rem",
                      cursor: isLoadingLogs ? "not-allowed" : "pointer",
                    }}
                  >
                    {labels.refresh}
                  </button>
                </div>
                <div style={{ maxHeight: "120px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "0.4rem", padding: "0.35rem" }}>
                  {eventLogs.length === 0 ? (
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textAlign: "center", padding: "0.3rem" }}>
                      {labels.noEvents}
                    </div>
                  ) : (
                    eventLogs.map((item) => (
                      <div key={item.id} style={{ fontSize: "0.69rem", color: "var(--text-primary)", padding: "0.2rem 0", borderBottom: "1px dashed var(--border-color)" }}>
                        <div style={{ fontWeight: 600 }}>{item.event || "event"}</div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {item.resource}
                          {item.callId ? ` • call:${item.callId}` : ""}
                          {item.messageId ? ` • msg:${item.messageId}` : ""}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setDevMode(!devMode)}
                style={{
                  width: "100%",
                  padding: "0.35rem 0.5rem",
                  borderRadius: "0.4rem",
                  border: "1px solid var(--border-color)",
                  background: "rgba(99, 102, 241, 0.1)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                {devMode ? labels.hide : labels.show} {labels.simulation}
              </button>
              {devMode && (
                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.35rem" }}>
                  <input
                    type="text"
                    value={simNumber}
                    onChange={(e) => setSimNumber(e.target.value)}
                    placeholder={labels.testNumber}
                    style={{
                      flex: 1,
                      padding: "0.3rem 0.4rem",
                      borderRadius: "0.3rem",
                      border: "1px solid var(--border-color)",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      fontSize: "0.75rem",
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (simNumber.trim()) {
                        const simulated = await simulateInboundCallRequest(simNumber.trim());
                        if (simulated) setCall(simulated);
                        setSimNumber("");
                        setShowContacts(false);
                      }
                    }}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: "0.3rem",
                      border: "1px solid var(--border-color)",
                      background: "var(--button-bg)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                    }}
                  >
                    {labels.test}
                  </button>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}

// Composant pour appeler un client depuis sa fiche
export function CallClientButton({ phoneNumber }: { phoneNumber: string }) {
  const { locale } = useLocale();
  const [isCalling, setIsCalling] = useState(false);
  const labels =
    locale === "fr"
      ? {
          mustBeConnected: "Vous devez être connecté pour passer un appel",
          call: "Appeler",
        }
      : {
          mustBeConnected: "You must be logged in to place a call",
          call: "Call",
        };
  const handleClick = async () => {
    if (isCalling) return;
    setIsCalling(true);
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) {
        alert(labels.mustBeConnected);
        return;
      }

      const payload = (await res.json()) as { authenticated?: boolean; user?: { id: string } };
      const actorId = payload?.authenticated ? payload.user?.id : undefined;
      if (!actorId) {
        alert(labels.mustBeConnected);
        return;
      }

      const started = await startAircallCallRequest(phoneNumber);
      if (!started) {
        alert(labels.mustBeConnected);
      }
    } catch {
      alert(labels.mustBeConnected);
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        padding: "0.4rem 0.75rem",
        borderRadius: "999px",
        border: "1px solid var(--border-color)",
        background: "linear-gradient(120deg, rgba(30,64,175,0.9), rgba(79,70,229,0.9))",
        color: "#ffffff",
        cursor: "pointer",
        fontSize: "0.8rem",
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
      }}
    >
      <MaterialSymbol name="call" size={16} weight={500} opticalSize={20} />
      {labels.call}
    </button>
  );
}
