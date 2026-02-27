"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getActiveCall,
  subscribeToCalls,
  answerCall,
  endCall,
  startCall,
  simulateIncomingCall,
  toggleHold,
  toggleMute,
} from "@/lib/mock/aircall";
import { getClients } from "@/lib/mock/clients";
import { useLocale } from "@/lib/use-locale";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import type { AircallCall } from "@/lib/mock/aircall";

type SessionActor = {
  id: string;
  role: string;
};

function formatDuration(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function AircallWidget() {
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
          listeningLevel: "Votre micro",
          remoteLevel: "Interlocuteur",
          onHold: "En attente",
          activeCall: "Appel en cours",
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
          listeningLevel: "Your mic",
          remoteLevel: "Remote",
          onHold: "On hold",
          activeCall: "Active call",
        };
  const [call, setCall] = useState<AircallCall | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [searchContact, setSearchContact] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [simNumber, setSimNumber] = useState("");
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [localLevel, setLocalLevel] = useState(0);
  const [remoteLevel, setRemoteLevel] = useState(0);
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

  const remoteBars = useMemo(() => {
    const count = 14;
    return Array.from({ length: count }, (_, index) => {
      const jitter = ((index % 3) + 1) * 0.06;
      const value = Math.min(1, remoteLevel + jitter);
      return `${16 + value * 34}px`;
    });
  }, [remoteLevel]);

  const localBars = useMemo(() => {
    const count = 14;
    return Array.from({ length: count }, (_, index) => {
      const jitter = ((index % 4) + 1) * 0.05;
      const value = Math.min(1, localLevel + jitter);
      return `${16 + value * 34}px`;
    });
  }, [localLevel]);

  useEffect(() => {
    const loadActor = async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) {
        setActor(null);
        return;
      }
      const payload = (await res.json()) as { authenticated?: boolean; user?: SessionActor };
      setActor(payload.authenticated ? payload.user ?? null : null);
    };

    loadActor();
  }, []);

  useEffect(() => {
    setCall(getActiveCall());
    const unsubscribe = subscribeToCalls((newCall) => {
      setCall(newCall);
      if (newCall && newCall.direction === "inbound") {
        const client = clients.find((c) => c.phone === newCall.from);
        if (client) {
          router.push(`/crm/${client.id}`);
        }
      }
    });

    const handleToggle = () => {
      setShowContacts((prev) => !prev);
    };

    const handleOutside = (event: MouseEvent) => {
      if (!showContacts) return;
      const node = panelRef.current;
      const target = event.target as Node | null;
      if (node && target && !node.contains(target)) {
        setShowContacts(false);
      }
    };

    window.addEventListener("aircall:toggle", handleToggle);
    window.addEventListener("mousedown", handleOutside);

    return () => {
      unsubscribe();
      window.removeEventListener("aircall:toggle", handleToggle);
      window.removeEventListener("mousedown", handleOutside);
    };
  }, [router, clients, showContacts]);

  useEffect(() => {
    if (!call || call.status !== "answered") {
      setCallSeconds(0);
      return;
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
      setLocalLevel(0);
    };

    if (!call || call.status !== "answered") {
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
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const update = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let index = 0; index < data.length; index += 1) {
            sum += data[index];
          }
          const avg = sum / data.length / 255;
          const gated = call?.isMuted ? 0 : avg;
          setLocalLevel(gated);
          micRafRef.current = window.requestAnimationFrame(update);
        };

        micStreamRef.current = stream;
        micAudioContextRef.current = context;
        update();
      } catch {
        setLocalLevel(0);
      }
    };

    startMic();

    return () => {
      disposed = true;
      stopMic();
    };
  }, [call?.id, call?.status, call?.isMuted]);

  useEffect(() => {
    if (!call || call.status !== "answered") {
      setRemoteLevel(0);
      return;
    }

    const interval = window.setInterval(() => {
      if (call.isOnHold) {
        setRemoteLevel(0.08);
        return;
      }
      const base = 0.2 + Math.random() * 0.55;
      setRemoteLevel(base);
    }, 140);

    return () => window.clearInterval(interval);
  }, [call?.id, call?.status, call?.isOnHold]);

  const handleAnswer = () => {
    if (call) answerCall(call.id);
  };

  const handleEnd = () => {
    if (call) endCall(call.id);
  };

  const handleCall = (phoneNumber: string) => {
    if (actor) {
      startCall(phoneNumber, actor.id);
      setShowContacts(false);
      setSearchContact("");
    }
  };

  const filteredContacts = clients.filter((c) =>
    `${c.fullName} ${c.phone}`.toLowerCase().includes(searchContact.toLowerCase())
  );

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
              animation:
                call.status === "ringing" ? "pulse 2s infinite" : "none",
            }}
          />
        </div>

        {call.status === "answered" && (
          <div style={{ marginBottom: "0.8rem", display: "grid", gap: "0.5rem" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#f59e0b", marginBottom: "0.2rem" }}>{labels.remoteLevel}</div>
              <div style={{ display: "flex", alignItems: "end", gap: "0.2rem", height: "56px" }}>
                {remoteBars.map((height, index) => (
                  <div
                    key={`remote-${index}`}
                    style={{
                      width: "7px",
                      height,
                      borderRadius: "999px",
                      background: "linear-gradient(180deg, #f59e0b, #fb923c)",
                      transition: "height 120ms linear",
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "#22c55e", marginBottom: "0.2rem" }}>{labels.listeningLevel}</div>
              <div style={{ display: "flex", alignItems: "end", gap: "0.2rem", height: "56px" }}>
                {localBars.map((height, index) => (
                  <div
                    key={`local-${index}`}
                    style={{
                      width: "7px",
                      height,
                      borderRadius: "999px",
                      background: "linear-gradient(180deg, #22c55e, #16a34a)",
                      transition: "height 120ms linear",
                    }}
                  />
                ))}
              </div>
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
                onClick={() => toggleMute(call.id)}
                style={{
                  padding: "0.5rem 0.8rem",
                  borderRadius: "999px",
                  border: "1px solid var(--border-color)",
                  background: call.isMuted ? "rgba(239,68,68,0.15)" : "var(--button-bg)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <MaterialSymbol name={call.isMuted ? "mic_off" : "mic"} size={16} weight={500} opticalSize={20} />
                {call.isMuted ? labels.unmute : labels.mute}
              </button>

              <button
                type="button"
                onClick={() => toggleHold(call.id)}
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
              border: "1px solid var(--border-color)",
              background: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {labels.hangup}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 1000,
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
        {showContacts && (
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

            {process.env.NODE_ENV === "development" && (
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
                      onClick={() => {
                        if (simNumber.trim()) {
                          simulateIncomingCall(simNumber.trim());
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
            )}
          </div>
        )}
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

      startCall(phoneNumber, actorId);
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
