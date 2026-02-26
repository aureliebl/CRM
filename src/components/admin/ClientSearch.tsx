"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClients } from "@/lib/mock/clients";
import type { Client } from "@/lib/types";

export function ClientSearch({ inputId, placeholder, maxWidth }: { inputId?: string; placeholder?: string; maxWidth?: string | number }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
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

  useEffect(() => {
    if (!isOpen || filtered.length === 0) {
      setActiveIndex(-1);
      return;
    }

    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length - 1);
    }
  }, [filtered, isOpen, activeIndex]);

  const handleSelect = (client: Client) => {
    router.push(`/crm/${client.id}`);
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
        onKeyDown={(e) => {
          if (!filtered.length) return;

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIsOpen(true);
            setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIsOpen(true);
            setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
          } else if (e.key === "Enter") {
            if (activeIndex >= 0 && activeIndex < filtered.length) {
              e.preventDefault();
              handleSelect(filtered[activeIndex]);
            }
          } else if (e.key === "Escape") {
            setIsOpen(false);
            setActiveIndex(-1);
          }
        }}
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
              onMouseEnter={() => {
                const index = filtered.findIndex((c) => c.id === client.id);
                setActiveIndex(index);
              }}
              onMouseLeave={() => setActiveIndex(-1)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                textAlign: "left",
                border: "none",
                background: activeIndex >= 0 && filtered[activeIndex]?.id === client.id ? "var(--surface-secondary)" : "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "0.85rem",
                borderBottom: "1px solid var(--border-color)",
                boxShadow: activeIndex >= 0 && filtered[activeIndex]?.id === client.id ? "inset 3px 0 0 var(--accent-primary)" : "none",
              }}
            >
              <div style={{ fontWeight: activeIndex >= 0 && filtered[activeIndex]?.id === client.id ? 600 : 500 }}>{client.fullName}</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: activeIndex >= 0 && filtered[activeIndex]?.id === client.id ? "var(--text-primary)" : "var(--text-secondary)",
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
