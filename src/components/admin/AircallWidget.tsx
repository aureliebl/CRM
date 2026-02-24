"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getActiveCall,
  subscribeToCalls,
  answerCall,
  endCall,
  startCall,
  simulateIncomingCall,
} from "@/lib/mock/aircall";
import { getClients } from "@/lib/mock/clients";
import { getCurrentUser } from "@/lib/mock/auth";
import { useLocale } from "@/lib/use-locale";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import type { AircallCall } from "@/lib/mock/aircall";

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
        };
  const [call, setCall] = useState<AircallCall | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [searchContact, setSearchContact] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [simNumber, setSimNumber] = useState("");
  const router = useRouter();
  const clients = getClients();

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
    window.addEventListener("aircall:toggle", handleToggle);

    return () => {
      unsubscribe();
      window.removeEventListener("aircall:toggle", handleToggle);
    };
  }, [router, clients]);

  const handleAnswer = () => {
    if (call) answerCall(call.id);
  };

  const handleEnd = () => {
    if (call) endCall(call.id);
  };

  const handleCall = (phoneNumber: string) => {
    const user = getCurrentUser();
    if (user) {
      startCall(phoneNumber, user.id);
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
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            justifyContent: "flex-end",
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
  const handleClick = () => {
    const user = getCurrentUser();
    if (!user) {
      alert(labels.mustBeConnected);
      return;
    }
    startCall(phoneNumber, user.id);
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
