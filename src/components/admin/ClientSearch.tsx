"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getClients } from "@/lib/mock/clients";
import type { Client } from "@/lib/types";

export function ClientSearch({ inputId, placeholder, maxWidth }: { inputId?: string; placeholder?: string; maxWidth?: string | number }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const clients = getClients();
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const platform = navigator.platform || "";
    const ua = navigator.userAgent || "";
    return /Mac|iPhone|iPad|iPod/.test(platform) || /Macintosh/.test(ua);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.fullName.toLowerCase().includes(lowerQuery) ||
          c.email.toLowerCase().includes(lowerQuery) ||
          c.phone?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5);
  }, [query, clients]);

  const handleSelect = (client: Client) => {
    router.push(`/clients/${client.id}`);
    setQuery("");
    setIsOpen(false);
  };

  const inputIdentifier = inputId ?? "client-search-input";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: maxWidth ?? "600px" }}>
      <input
        id={inputIdentifier}
        type="text"
        placeholder={placeholder ?? "Rechercher un client..."}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        style={{
          width: "100%",
          padding: "0.5rem 0.75rem",
          paddingRight: "3rem",
          borderRadius: "999px",
          border: "1px solid var(--border-hover)",
          background: "var(--search-bg)",
          color: "var(--text-primary)",
          fontSize: "0.85rem",
          outline: "none",
        }}
      />

      {/* shortcut hint badge */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          background: "var(--dropdown-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "999px",
          padding: "2px 6px",
          pointerEvents: "none",
        }}
      >
        {isMac ? "⌘ K" : "Ctrl K"}
      </div>

      {isOpen && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            borderRadius: "0.75rem",
            border: "1px solid var(--border-color)",
            background: "var(--dropdown-bg)",
            backdropFilter: "blur(14px)",
            boxShadow: `0 10px 40px var(--shadow-color)`,
            zIndex: 1000,
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {filtered.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelect(client)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                textAlign: "left",
                border: "none",
                background: "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "0.85rem",
                borderBottom: "1px solid var(--border-color)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ fontWeight: 500 }}>{client.fullName}</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.15rem",
                }}
              >
                {client.email} {client.phone && `· ${client.phone}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
