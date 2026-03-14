"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getClients } from "@/lib/mock/clients";
import type { Client } from "@/lib/types";

interface TicketVariable {
  key: string;
  value: string;
  type: "badge" | "date" | "text" | "link" | "progress";
}

interface TicketSearchItem {
  id: string;
  title: string;
  description: string | null;
  variables: TicketVariable[];
}

type SearchResult =
  | { kind: "client"; id: string; title: string; subtitle: string; client: Client }
  | { kind: "ticket"; id: string; title: string; subtitle: string; ticket: TicketSearchItem };

export function ClientSearch({
  inputId,
  placeholder,
  maxWidth,
  appearance = "default",
  visibleRoutes,
}: {
  inputId?: string;
  placeholder?: string;
  maxWidth?: string | number;
  appearance?: "default" | "embedded";
  visibleRoutes?: string[];
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [tickets, setTickets] = useState<TicketSearchItem[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const clients = getClients();
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const platform = navigator.platform || "";
    const ua = navigator.userAgent || "";
    return /Mac|iPhone|iPad|iPod/.test(platform) || /Macintosh/.test(ua);
  }, []);

  const canSearchClients = useMemo(() => {
    if (!visibleRoutes || visibleRoutes.length === 0) return true;
    return visibleRoutes.some((route) => route === "/crm" || route.startsWith("/crm/"));
  }, [visibleRoutes]);

  const canSearchTickets = useMemo(() => {
    if (!visibleRoutes || visibleRoutes.length === 0) return true;
    return visibleRoutes.some((route) => route === "/tickets" || route.startsWith("/tickets/"));
  }, [visibleRoutes]);

  const loadTickets = useCallback(async () => {
    if (!canSearchTickets || ticketsLoaded) return;
    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const cards = Array.isArray(data?.cards) ? data.cards : [];
      setTickets(
        cards.map((card: Record<string, unknown>) => ({
          id: String(card.id ?? ""),
          title: String(card.title ?? ""),
          description: card.description ? String(card.description) : null,
          variables: Array.isArray(card.variables) ? card.variables : [],
        }))
      );
      setTicketsLoaded(true);
    } catch {
      // ignore
    }
  }, [canSearchTickets, ticketsLoaded]);

  useEffect(() => {
    if (!query.trim() || !isOpen || !canSearchTickets) return;
    void loadTickets();
  }, [query, isOpen, canSearchTickets, loadTickets]);

  const filtered = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    const items: SearchResult[] = [];

    if (canSearchClients) {
      const clientResults = clients
        .filter(
          (client) =>
            client.fullName.toLowerCase().includes(lowerQuery) ||
            client.email.toLowerCase().includes(lowerQuery) ||
            client.phone?.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 5)
        .map((client) => ({
          kind: "client" as const,
          id: client.id,
          title: client.fullName,
          subtitle: `${client.email}${client.phone ? ` · ${client.phone}` : ""}`,
          client,
        }));
      items.push(...clientResults);
    }

    if (canSearchTickets) {
      const ticketResults = tickets
        .filter((ticket) => {
          const plainDescription = (ticket.description || "").replace(/<[^>]+>/g, " ");
          const variablesText = ticket.variables
            .map((variable) => `${variable.key} ${variable.value}`)
            .join(" ");
          const haystack = `${ticket.title} ${plainDescription} ${variablesText}`.toLowerCase();
          return haystack.includes(lowerQuery);
        })
        .slice(0, 5)
        .map((ticket) => ({
          kind: "ticket" as const,
          id: ticket.id,
          title: ticket.title,
          subtitle: ticket.description
            ? ticket.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90)
            : "Ticket",
          ticket,
        }));
      items.push(...ticketResults);
    }

    return items.slice(0, 8);
  }, [query, clients, tickets, canSearchClients, canSearchTickets]);

  useEffect(() => {
    if (!isOpen || filtered.length === 0) {
      setActiveIndex(-1);
      return;
    }

    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length - 1);
    }
  }, [filtered, isOpen, activeIndex]);

  const handleSelect = (result: SearchResult) => {
    if (result.kind === "client") {
      router.push(`/crm/${result.client.id}`);
    } else {
      const searchValue = encodeURIComponent(result.ticket.title);
      router.push(`/tickets?search=${searchValue}&ticketId=${encodeURIComponent(result.ticket.id)}`);
    }
    setQuery("");
    setIsOpen(false);
  };

  const inputIdentifier = inputId ?? "client-search-input";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: maxWidth ?? "600px", height: "100%" }}>
      <input
        id={inputIdentifier}
        type="text"
        placeholder={placeholder ?? "Rechercher un client..."}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
          }
          setIsOpen(true);
        }}
        onBlur={() => {
          if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
          }
          blurTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
            blurTimeoutRef.current = null;
          }, 100); // laisse le temps à un clic sur un résultat
        }}
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
            e.currentTarget.blur();
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          padding: "0.35rem 0.5rem",
          paddingRight: "3.5rem",
          borderRadius: "999px",
          border: appearance === "embedded" ? "none" : "1px solid var(--border-hover)",
          background: appearance === "embedded" ? "transparent" : "var(--search-bg)",
          color: "var(--text-primary)",
          fontSize: "0.85rem",
          lineHeight: 1,
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      {/* shortcut hint badge */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 1,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "0.75rem",
          color: "#585142",
          background: appearance === "embedded" ? "#efebe4" : "var(--dropdown-bg)",
          border: "1px solid #d6d0c4",
          borderRadius: "22px",
          padding: "3px 7px",
          pointerEvents: "none",
          lineHeight: 1,
          whiteSpace: "nowrap",
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
          {filtered.map((item) => (
            <button
              key={`${item.kind}:${item.id}`}
              type="button"
              onClick={() => handleSelect(item)}
              onMouseEnter={() => {
                const index = filtered.findIndex((candidate) => candidate.id === item.id && candidate.kind === item.kind);
                setActiveIndex(index);
              }}
              onMouseLeave={() => setActiveIndex(-1)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                textAlign: "left",
                border: "none",
                background:
                  activeIndex >= 0 &&
                  filtered[activeIndex]?.id === item.id &&
                  filtered[activeIndex]?.kind === item.kind
                    ? "var(--surface-secondary)"
                    : "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "0.85rem",
                borderBottom: "1px solid var(--border-color)",
                boxShadow:
                  activeIndex >= 0 &&
                  filtered[activeIndex]?.id === item.id &&
                  filtered[activeIndex]?.kind === item.kind
                    ? "inset 3px 0 0 var(--accent-primary)"
                    : "none",
              }}
            >
              <div
                style={{
                  fontWeight:
                    activeIndex >= 0 &&
                    filtered[activeIndex]?.id === item.id &&
                    filtered[activeIndex]?.kind === item.kind
                      ? 600
                      : 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: "0.65rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "2px 6px",
                    borderRadius: 999,
                    border: "1px solid var(--border-color)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {item.kind === "client" ? "CRM" : "Ticket"}
                </span>
                <span>{item.title}</span>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color:
                    activeIndex >= 0 &&
                    filtered[activeIndex]?.id === item.id &&
                    filtered[activeIndex]?.kind === item.kind
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  marginTop: "0.15rem",
                }}
              >
                {item.subtitle}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
