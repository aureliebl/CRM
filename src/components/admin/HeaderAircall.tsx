"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getActiveCall,
  subscribeToCalls,
  answerCall,
  endCall,
  simulateIncomingCall,
  startCall,
} from "@/lib/mock/aircall";
import { getClients } from "@/lib/mock/clients";
import { getCurrentUser } from "@/lib/mock/auth";
import type { AircallCall } from "@/lib/mock/aircall";
import { useLocale } from "@/lib/use-locale";

export function HeaderAircall() {
  const { locale } = useLocale();
  const labels =
    locale === "fr"
      ? {
          incoming: "Appel entrant",
          outgoing: "Appel sortant",
          noCall: "Aucun appel",
          clientProfile: "Voir la fiche client",
          answer: "Répondre",
          hangup: "Raccrocher",
          close: "Fermer",
          testNumber: "Numéro de test",
          simulateCall: "Simuler appel",
          simulated: "Appel simulé",
          noneCreated: "Aucun appel créé",
          devHelp:
            'Dev only — saisir un numéro et cliquer « Simuler appel » pour tester la modale.',
        }
      : {
          incoming: "Incoming call",
          outgoing: "Outgoing call",
          noCall: "No call",
          clientProfile: "Open client profile",
          answer: "Answer",
          hangup: "Hang up",
          close: "Close",
          testNumber: "Test number",
          simulateCall: "Simulate call",
          simulated: "Call simulated",
          noneCreated: "No call created",
          devHelp:
            "Dev only — enter a number and click 'Simulate call' to test the modal.",
        };
  const [call, setCall] = useState<AircallCall | null>(null);
  const [open, setOpen] = useState(false);
  const [matchedClientId, setMatchedClientId] = useState<string | null>(null);
  const [simNumber, setSimNumber] = useState<string>("");
  const [simMsg, setSimMsg] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone?: string | null; type: "client" | "account" }>>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setCall(getActiveCall());
    const unsub = subscribeToCalls((c) => {
      setCall(c);
      if (c) {
        const clients = getClients();
        const client = clients.find((cl) => cl.phone === (c.direction === "inbound" ? c.from : c.to));
        setMatchedClientId(client ? client.id : null);
        // open modal automatically for inbound ringing
        if (c.direction === "inbound" && c.status === "ringing") {
          setOpen(true);
        }
      } else {
        setMatchedClientId(null);
      }
    });
    return unsub;
  }, []);

  const handleAnswer = () => {
    if (call) answerCall(call.id);
  };

  const handleDecline = () => {
    if (call) endCall(call.id);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Aircall"
        style={{
          padding: "0.4rem 0.75rem",
          borderRadius: "999px",
          border: "1px solid var(--border-hover)",
          background: "var(--button-bg)",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontSize: "0.8rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        📞 Aircall
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.5rem)",
            width: 320,
            zIndex: 1200,
            background: "var(--modal-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "0.75rem",
            padding: "0.75rem",
            boxShadow: "0 10px 40px var(--shadow-color)",
          }}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {call
                ? call.direction === "inbound"
                  ? labels.incoming
                  : labels.outgoing
                : labels.noCall}
            </div>
            <div style={{ fontWeight: 600, marginTop: "0.25rem" }}>
              {call ? (call.direction === "inbound" ? call.from : call.to) : "—"}
            </div>
          </div>

          {matchedClientId && (
            <div style={{ marginBottom: "0.5rem" }}>
              <Link href={`/crm/${matchedClientId}`} style={{ color: "var(--text-primary)" }}>
                {labels.clientProfile}
              </Link>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            {call && call.status === "ringing" && call.direction === "inbound" && (
              <button
                type="button"
                onClick={handleAnswer}
                style={{
                  padding: "0.5rem 0.9rem",
                  borderRadius: "999px",
                  border: "none",
                  background: "linear-gradient(120deg, #10b981, #059669)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {labels.answer}
              </button>
            )}
            <button
              type="button"
              onClick={handleDecline}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid var(--border-color)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              {call ? labels.hangup : labels.close}
            </button>
          </div>
        </div>
      )}

      {process.env.NODE_ENV === "development" && (
        <div style={{ position: "absolute", left: 0, top: "calc(100% + 0.5rem)", zIndex: 1200 }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                value={simNumber}
                onChange={(e) => setSimNumber(e.target.value)}
                placeholder={labels.testNumber}
                style={{ padding: "0.35rem 0.5rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!simNumber.trim()) return;
                  const c = simulateIncomingCall(simNumber.trim());
                  setOpen(true);
                  setSimMsg(c ? labels.simulated : labels.noneCreated);
                  setTimeout(() => setSimMsg(null), 2500);
                }}
                style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer" }}
              >
                {labels.simulateCall}
              </button>
            </div>
            {simMsg && <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 6 }}>{simMsg}</div>}
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {labels.devHelp}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
