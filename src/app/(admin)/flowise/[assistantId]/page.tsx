"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { ASSISTANTS_BY_ID } from "@/lib/assistants-config";
import { useLocale } from "@/lib/use-locale";

const FullPageChat = dynamic(
  () => import("flowise-embed-react").then((module) => module.FullPageChat),
  { ssr: false },
);

/* ------------------------------------------------------------------ */
/*  Saved‑entry type                                                   */
/* ------------------------------------------------------------------ */
interface SavedEntry {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

function storageKey(assistantId: string) {
  return `flowise_entries_${assistantId}`;
}

function loadEntries(assistantId: string): SavedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(assistantId));
    return raw ? (JSON.parse(raw) as SavedEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntries(assistantId: string, entries: SavedEntry[]) {
  localStorage.setItem(storageKey(assistantId), JSON.stringify(entries));
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default function AssistantDetailPage() {
  const { assistantId } = useParams<{ assistantId: string }>();
  const assistant = ASSISTANTS_BY_ID[assistantId];
  const { t, locale } = useLocale();
  const tr = (key: string) =>
    (t as Record<string, string>)[key] ?? key;

  /* ---------- state ---------- */
  const [chatHeight, setChatHeight] = useState(420);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  /* load entries once */
  useEffect(() => {
    setEntries(loadEntries(assistantId));
  }, [assistantId]);

  useEffect(() => {
    setJsonText("");
    setJsonError(null);
    setSelectedId(null);
  }, [assistantId]);

  /* responsive chat height */
  useEffect(() => {
    const recompute = () => setChatHeight(Math.max(350, window.innerHeight - 340));
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  /* ---------- handlers ---------- */
  const handleSave = useCallback(() => {
    setJsonError(null);
    let parsed: { title?: string; description?: string };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setJsonError(tr("assistant_json_invalid"));
      return;
    }
    if (
      !parsed ||
      typeof parsed.title !== "string" ||
      typeof parsed.description !== "string"
    ) {
      setJsonError(tr("assistant_json_missing_fields"));
      return;
    }
    const entry: SavedEntry = {
      id: crypto.randomUUID(),
      title: parsed.title,
      description: parsed.description,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    saveEntries(assistantId, next);
    setJsonText("");
  }, [jsonText, entries, assistantId, t]);

  const handleDelete = useCallback(
    (id: string) => {
      const next = entries.filter((e) => e.id !== id);
      setEntries(next);
      saveEntries(assistantId, next);
      if (selectedId === id) setSelectedId(null);
    },
    [entries, assistantId, selectedId],
  );

  /* ---------- unknown assistant guard ---------- */
  if (!assistant) {
    return (
      <div style={{ padding: "2rem 1.5rem" }}>
        <Link
          href="/flowise"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--accent-primary)",
            textDecoration: "none",
            fontWeight: 500,
            marginBottom: "1rem",
          }}
        >
          <MaterialSymbol name="arrow_back" size={18} />
          {tr("assistant_back_all")}
        </Link>
        <p style={{ color: "var(--text-secondary)" }}>
          {tr("assistant_not_found")}
        </p>
      </div>
    );
  }

  /* ---------- render ---------- */
  return (
    <div style={{ padding: "0 1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* ── Back link + title ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          href="/flowise"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--accent-primary)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          <MaterialSymbol name="arrow_back" size={18} />
          {tr("assistant_back")}
        </Link>
        <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          /
        </span>
        <span
          style={{
            fontWeight: 600,
            fontSize: "1.1rem",
            color: "var(--text-primary)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <MaterialSymbol name={assistant.icon} size={20} />
          {assistant.name}
        </span>
      </div>

      {/* ── Chat embed ── */}
      <div
        style={{
          overflow: "hidden",
          borderRadius: "0.8rem",
          height: chatHeight,
          minHeight: 350,
          border: "1px solid var(--border-color)",
        }}
      >
        <FullPageChat
          key={assistantId}
          chatflowid={assistant.chatflowid}
          apiHost="/api/flowise"
          theme={{ chatWindow: { height: chatHeight } }}
        />
      </div>

      {/* ── JSON paste area ── */}
      <div
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          padding: "1rem",
          background: "var(--surface-secondary)",
        }}
      >
        <label
          style={{
            display: "block",
            fontWeight: 600,
            marginBottom: 6,
            color: "var(--text-primary)",
            fontSize: "0.95rem",
          }}
        >
          {tr("assistant_paste_label")}
        </label>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
            margin: "0 0 8px",
          }}
        >
          {tr("assistant_paste_hint")}{" "}
          <code
            style={{
              background: "var(--surface-primary)",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: "0.8rem",
            }}
          >
            {tr("assistant_format_hint_example")}
          </code>
        </p>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={4}
          placeholder={tr("assistant_placeholder")}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: "0.88rem",
            padding: "0.6rem",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            background: "var(--input-bg, var(--surface-primary))",
            color: "var(--text-primary)",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        {jsonError && (
          <p style={{ color: "#e74c3c", fontSize: "0.82rem", margin: "6px 0 0" }}>
            {jsonError}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!jsonText.trim()}
          style={{
            marginTop: 8,
            padding: "0.45rem 1.1rem",
            borderRadius: 8,
            border: "none",
            background: jsonText.trim()
              ? "var(--accent-primary)"
              : "var(--border-color)",
            color: jsonText.trim() ? "#fff" : "var(--text-secondary)",
            fontWeight: 600,
            fontSize: "0.88rem",
            cursor: jsonText.trim() ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          {tr("assistant_save")}
        </button>
      </div>

      {/* ── Table + Right panel ── */}
      {entries.length > 0 && (
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          {/* table */}
          <div
            style={{
              flex: 1,
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--surface-secondary)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--surface-primary)",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.6rem 0.8rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {tr("assistant_table_title")}
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.6rem 0.8rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      width: 140,
                    }}
                  >
                    {tr("assistant_table_date")}
                  </th>
                  <th
                    style={{
                      width: 50,
                      padding: "0.6rem 0.8rem",
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() =>
                      setSelectedId(selectedId === e.id ? null : e.id)
                    }
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-color)",
                      background:
                        selectedId === e.id
                          ? "rgba(var(--accent-rgb, 59,130,246), 0.08)"
                          : "transparent",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(ev) => {
                      if (selectedId !== e.id)
                        ev.currentTarget.style.background =
                          "rgba(var(--accent-rgb, 59,130,246), 0.04)";
                    }}
                    onMouseLeave={(ev) => {
                      if (selectedId !== e.id)
                        ev.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td
                      style={{
                        padding: "0.55rem 0.8rem",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {e.title}
                    </td>
                    <td
                      style={{
                        padding: "0.55rem 0.8rem",
                        color: "var(--text-secondary)",
                        fontSize: "0.82rem",
                      }}
                    >
                      {new Date(e.createdAt).toLocaleDateString(locale)}
                    </td>
                    <td style={{ padding: "0.55rem 0.8rem", textAlign: "center" }}>
                      <button
                        type="button"
                        title={tr("assistant_delete")}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleDelete(e.id);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          padding: 2,
                          lineHeight: 1,
                        }}
                      >
                        <MaterialSymbol name="delete" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Right side panel ── */}
          {selectedEntry && (
            <div
              style={{
                width: 380,
                minWidth: 300,
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                background: "var(--surface-secondary)",
                boxShadow: "-4px 0 20px rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                maxHeight: 480,
              }}
            >
              {/* header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "1rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {selectedEntry.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: 2,
                    lineHeight: 1,
                  }}
                >
                  <MaterialSymbol name="close" size={20} />
                </button>
              </div>
              {/* body */}
              <div
                style={{
                  padding: "1rem",
                  overflowY: "auto",
                  flex: 1,
                  fontSize: "0.9rem",
                  lineHeight: 1.55,
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedEntry.description}
              </div>
              {/* footer */}
              <div
                style={{
                  padding: "0.5rem 1rem",
                  borderTop: "1px solid var(--border-color)",
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                }}
              >
                {tr("assistant_created_at")}{" "}
                {new Date(selectedEntry.createdAt).toLocaleString(locale)}
              </div>
            </div>
          )}
        </div>
      )}

      {entries.length === 0 && (
        <p
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: "0.88rem",
            padding: "1.5rem 0",
          }}
        >
          {tr("assistant_no_entries")}
        </p>
      )}
    </div>
  );
}
