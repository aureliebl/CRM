"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getUnfinishedBookings, getQuoteRequests } from "@/lib/mock/crm";
import { centers, boxTypes } from "@/lib/mock/centers-and-pricing";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";
import { useRightPanel } from "@/components/admin/right-panel/RightPanelProvider";

type AcqTab = "unfinished" | "quotes" | "abandoned";
type ViewMode = "table" | "kanban";
type QuoteStatus = "new" | "sent" | "accepted" | "expired" | "abandoned";
type OperatorFilter = "all" | "unassigned" | string;

type OperatorAccount = {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "operator";
  profileImage?: string | null;
};

type UnfinishedBookingRow = ReturnType<typeof getUnfinishedBookings>[number] & {
  centerName: string;
  boxTypeName: string;
  priceLabel: string;
  stoppedLabel: string;
  contactLabel: string;
  assignedOperatorId?: string;
};

type QuoteRow = ReturnType<typeof getQuoteRequests>[number] & {
  centerName: string;
  sizeLabel: string;
  createdLabel: string;
  sentLabel: string;
  statusLabel: string;
  assignedOperatorId?: string;
};

type AcquisitionBoardState = {
  unfinished: Record<string, { step?: number; assignedOperatorId?: string | null }>;
  quotes: Record<string, { status?: QuoteStatus; assignedOperatorId?: string | null }>;
  operatorAbsences: Record<string, string[]>;
};

const STORAGE_KEY = "acquisition_settings_v1";

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = `${index + 1}`.padStart(2, "0");
    const monthPadded = `${month + 1}`.padStart(2, "0");
    return `${year}-${monthPadded}-${day}`;
  });
}

function getInitialUnfinishedRows() {
  const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));
  const btMap = Object.fromEntries(boxTypes.map((b) => [b.id, b]));
  return getUnfinishedBookings().map((ub) => ({
    ...ub,
    centerName: centerMap[ub.centerId]?.name ?? ub.centerId,
    boxTypeName: btMap[ub.boxTypeId]?.name ?? ub.boxTypeId,
    priceLabel: `${ub.price} €`,
    stoppedLabel: new Date(ub.stoppedAt).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    contactLabel: ub.fullName || ub.email || ub.phone || "—",
  }));
}

function getStatusLabel(status: QuoteStatus, fr: boolean) {
  if (status === "new") return fr ? "Nouveau" : "New";
  if (status === "sent") return fr ? "Envoyé" : "Sent";
  if (status === "accepted") return fr ? "Accepté" : "Accepted";
  if (status === "expired") return fr ? "Expiré" : "Expired";
  return fr ? "Abandonné" : "Abandoned";
}

function getInitialQuoteRows(fr: boolean): QuoteRow[] {
  const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));
  return getQuoteRequests().map((q) => {
    const normalizedStatus = (q.status || "new") as QuoteStatus;
    return {
      ...q,
      status: normalizedStatus,
      centerName: centerMap[q.centerId]?.name ?? q.centerId,
      sizeLabel: `${q.boxSizeWanted} m²`,
      createdLabel: new Date(q.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      sentLabel: q.sentAt ? new Date(q.sentAt).toLocaleDateString("fr-FR") : "—",
      statusLabel: getStatusLabel(normalizedStatus, fr),
    };
  });
}

function autoAssignRows<T extends { assignedOperatorId?: string }>(
  current: T[],
  availableOperators: OperatorAccount[],
  cursorRef: { current: number },
): T[] {
  const loads = new Map<string, number>();
  availableOperators.forEach((operator) => loads.set(operator.id, 0));

  let didChange = false;
  const normalized = current.map((row) => {
    if (!row.assignedOperatorId) return row;
    didChange = true;
    return { ...row, assignedOperatorId: undefined };
  });

  if (availableOperators.length === 0) {
    return didChange ? normalized : current;
  }

  const cursor = cursorRef.current % availableOperators.length;
  const rotated = [...availableOperators.slice(cursor), ...availableOperators.slice(0, cursor)];

  let assignedCount = 0;
  const next = normalized.map((row) => {
    if (row.assignedOperatorId) return row;

    let chosen = rotated[0];
    for (const candidate of rotated) {
      if ((loads.get(candidate.id) || 0) < (loads.get(chosen.id) || 0)) {
        chosen = candidate;
      }
    }

    loads.set(chosen.id, (loads.get(chosen.id) || 0) + 1);
    assignedCount += 1;
    didChange = true;
    return { ...row, assignedOperatorId: chosen.id };
  });

  if (!didChange) return current;

  if (assignedCount > 0) {
    cursorRef.current = (cursorRef.current + assignedCount) % availableOperators.length;
  }
  return next;
}

export default function AcquisitionPage() {
  const { locale } = useLocale();
  const { openPanel } = useRightPanel();
  const fr = locale === "fr";
  const [activeTab, setActiveTab] = useState<AcqTab>("unfinished");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [unfinishedRows, setUnfinishedRows] = useState<UnfinishedBookingRow[]>(() =>
    getInitialUnfinishedRows()
  );
  const [quoteRows, setQuoteRows] = useState<QuoteRow[]>(() => getInitialQuoteRows(fr));
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(true);
  const [operatorAbsences, setOperatorAbsences] = useState<Record<string, string[]>>({});
  const [presenceModalOpen, setPresenceModalOpen] = useState(false);
  const [presenceMonth, setPresenceMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [operatorFilter, setOperatorFilter] = useState<OperatorFilter>("all");
  const [boardReady, setBoardReady] = useState(false);
  const balanceCursorRef = useRef(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        viewMode?: ViewMode;
        autoAssignEnabled?: boolean;
      };

      if (parsed.viewMode === "kanban" || parsed.viewMode === "table") {
        setViewMode(parsed.viewMode);
      }
      if (typeof parsed.autoAssignEnabled === "boolean") {
        setAutoAssignEnabled(parsed.autoAssignEnabled);
      }
    } catch {
      // Ignore localStorage parsing issues.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        viewMode,
        autoAssignEnabled,
      })
    );
  }, [viewMode, autoAssignEnabled]);

  useEffect(() => {
    setQuoteRows(getInitialQuoteRows(fr));
  }, [fr]);

  useEffect(() => {
    let mounted = true;

    const applySharedState = (payload: AcquisitionBoardState) => {
      setUnfinishedRows((current) =>
        current.map((row) => {
          const override = payload.unfinished[row.id];
          if (!override) return row;
          return {
            ...row,
            step:
              typeof override.step === "number"
                ? Math.max(1, Math.min(override.step, row.totalSteps))
                : row.step,
            assignedOperatorId: override.assignedOperatorId ?? undefined,
          };
        })
      );

      setQuoteRows((current) =>
        current.map((row) => {
          const override = payload.quotes[row.id];
          if (!override) return row;
          const status = (override.status ?? row.status) as QuoteStatus;
          return {
            ...row,
            status,
            statusLabel: getStatusLabel(status, fr),
            assignedOperatorId: override.assignedOperatorId ?? undefined,
          };
        })
      );

      setOperatorAbsences(payload.operatorAbsences || {});
    };

    const loadBoard = async () => {
      try {
        const res = await fetch("/api/acquisition/board", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const payload = (await res.json()) as AcquisitionBoardState;
        if (!mounted) return;
        applySharedState(payload);
      } finally {
        if (mounted) setBoardReady(true);
      }
    };

    void loadBoard();
    const interval = window.setInterval(() => {
      void loadBoard();
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [fr]);

  useEffect(() => {
    if (!boardReady) return;

    const unfinished: AcquisitionBoardState["unfinished"] = {};
    unfinishedRows.forEach((row) => {
      unfinished[row.id] = {
        step: row.step,
        assignedOperatorId: row.assignedOperatorId ?? null,
      };
    });

    const quotes: AcquisitionBoardState["quotes"] = {};
    quoteRows.forEach((row) => {
      quotes[row.id] = {
        status: row.status as QuoteStatus,
        assignedOperatorId: row.assignedOperatorId ?? null,
      };
    });

    const timeout = window.setTimeout(() => {
      void fetch("/api/acquisition/board", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unfinished,
          quotes,
          operatorAbsences,
        } satisfies AcquisitionBoardState),
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [boardReady, unfinishedRows, quoteRows, operatorAbsences]);

  useEffect(() => {
    let mounted = true;
    const loadOperators = async () => {
      setOperatorsLoading(true);
      try {
        const res = await fetch("/api/accounts", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const payload = (await res.json()) as OperatorAccount[];
        if (!mounted) return;
        const filtered = payload.filter((item) => item.role === "operator");
        setOperators(filtered);
      } finally {
        if (mounted) setOperatorsLoading(false);
      }
    };

    void loadOperators();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedOperatorId && operators.length > 0) {
      setSelectedOperatorId(operators[0].id);
    }
    if (selectedOperatorId && operators.length > 0 && !operators.some((operator) => operator.id === selectedOperatorId)) {
      setSelectedOperatorId(operators[0].id);
    }
  }, [operators, selectedOperatorId]);

  useEffect(() => {
    if (!autoAssignEnabled || operators.length === 0) return;

    const todayKey = getTodayKey();
    const availableOperators = operators.filter(
      (operator) => !operatorAbsences[operator.id]?.includes(todayKey)
    );

    setUnfinishedRows((current) =>
      autoAssignRows(current, availableOperators, balanceCursorRef)
    );

    setQuoteRows((current) =>
      autoAssignRows(current, availableOperators, balanceCursorRef)
    );
  }, [autoAssignEnabled, operators, operatorAbsences]);

  const operatorById = useMemo(() => {
    const map = new Map<string, OperatorAccount>();
    operators.forEach((operator) => map.set(operator.id, operator));
    return map;
  }, [operators]);

  const monthDays = useMemo(() => getMonthDays(presenceMonth), [presenceMonth]);
  const selectedOperatorAbsences = selectedOperatorId
    ? operatorAbsences[selectedOperatorId] || []
    : [];

  const toggleAbsenceDay = (operatorId: string, day: string) => {
    setOperatorAbsences((current) => {
      const days = current[operatorId] || [];
      const exists = days.includes(day);
      const nextDays = exists ? days.filter((item) => item !== day) : [...days, day];
      return {
        ...current,
        [operatorId]: nextDays,
      };
    });
  };

  const tabs: { key: AcqTab; label: string; icon: string }[] = [
    { key: "unfinished", label: fr ? "Bookings non finalisés" : "Unfinished Bookings", icon: "pending_actions" },
    { key: "quotes", label: fr ? "Demandes de devis" : "Quote Requests", icon: "request_quote" },
    { key: "abandoned", label: fr ? "Devis non finalisés" : "Abandoned Quotes", icon: "cancel" },
  ];

  return (
    <div>
      <h1 className="admin-page-title">{fr ? "Lead" : "Lead"}</h1>
      <p className="admin-page-description">
        {fr
          ? "Suivi des leads en acquisition : bookings interrompus, demandes de devis et devis abandonnés."
          : "Lead acquisition tracking: interrupted bookings, quote requests, and abandoned quotes."}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
          <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => setPresenceModalOpen(true)}
          style={{ padding: "0.3rem 0.6rem", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <MaterialSymbol name="calendar_month" style={{ fontSize: 15 }} />
          {fr ? "Absences" : "Absences"}
        </button>

        <select
          value={operatorFilter}
          onChange={(event) => setOperatorFilter(event.target.value)}
          style={{
            padding: "0.3rem 0.55rem",
            borderRadius: "0.45rem",
            border: "1px solid var(--border-color)",
            background: "var(--input-bg)",
            color: "var(--text-primary)",
            fontSize: 12,
          }}
        >
          <option value="all">{fr ? "Tous les opérateurs" : "All operators"}</option>
          <option value="unassigned">{fr ? "Non attribués" : "Unassigned"}</option>
          {operators.map((operator) => (
            <option key={`filter_op_${operator.id}`} value={operator.id}>
              {operator.fullName || operator.email}
            </option>
          ))}
        </select>

        <div style={{ display: "inline-flex", border: "1px solid var(--border-color)", borderRadius: 999, padding: 2 }}>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className="admin-btn"
            style={{
              padding: "0.25rem 0.7rem",
              borderRadius: 999,
              background: viewMode === "table" ? "var(--accent-primary)" : "transparent",
              color: viewMode === "table" ? "#fff" : "var(--text-secondary)",
              border: "none",
              fontSize: 12,
            }}
          >
            {fr ? "Tableau" : "Table"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className="admin-btn"
            style={{
              padding: "0.25rem 0.7rem",
              borderRadius: 999,
              background: viewMode === "kanban" ? "var(--accent-primary)" : "transparent",
              color: viewMode === "kanban" ? "#fff" : "var(--text-secondary)",
              border: "none",
              fontSize: 12,
            }}
          >
            Kanban
          </button>
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {fr ? "Attribution auto" : "Auto assign"}
          </span>
          <span
            style={{
              position: "relative",
              width: 42,
              height: 24,
              background: autoAssignEnabled ? "#34c759" : "#d1d5db",
              borderRadius: 999,
              transition: "background 0.2s ease",
            }}
          >
            <input
              type="checkbox"
              checked={autoAssignEnabled}
              onChange={(event) => setAutoAssignEnabled(event.target.checked)}
              style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
            />
            <span
              style={{
                position: "absolute",
                top: 2,
                left: autoAssignEnabled ? 20 : 2,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                transition: "left 0.2s ease",
              }}
            />
          </span>
        </label>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "2px solid var(--border-primary)",
        marginBottom: 20,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid var(--accent-primary)" : "2px solid transparent",
              marginBottom: -2,
              color: activeTab === tab.key ? "var(--accent-primary)" : "var(--text-secondary)",
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            <MaterialSymbol name={tab.icon} style={{ fontSize: 18 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "unfinished" && (
        <UnfinishedBookingsTab
          fr={fr}
          rows={unfinishedRows}
          setRows={setUnfinishedRows}
          viewMode={viewMode}
          operatorFilter={operatorFilter}
          operators={operators}
          operatorById={operatorById}
          operatorsLoading={operatorsLoading}
          onOpenDetails={(row) =>
            openPanel({
              panelId: "acquisition.unfinishedBooking",
              contextKey: "acquisition.unfinished",
              entity: row,
            })
          }
        />
      )}
      {activeTab === "quotes" && (
        <QuoteRequestsTab
          fr={fr}
          rows={quoteRows}
          setRows={setQuoteRows}
          viewMode={viewMode}
          operatorFilter={operatorFilter}
          onOpenDetails={(row) =>
            openPanel({
              panelId: "acquisition.quoteRequest",
              contextKey: "acquisition.quotes",
              entity: row,
            })
          }
        />
      )}
      {activeTab === "abandoned" && (
        <AbandonedQuotesTab
          fr={fr}
          rows={quoteRows}
          setRows={setQuoteRows}
          viewMode={viewMode}
          operatorFilter={operatorFilter}
          onOpenDetails={(row) =>
            openPanel({
              panelId: "acquisition.quoteRequest",
              contextKey: "acquisition.abandoned",
              entity: row,
            })
          }
        />
      )}

      {presenceModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 90,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(820px, 100%)",
              maxHeight: "80vh",
              overflow: "auto",
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: "0.9rem",
              display: "grid",
              gap: "0.8rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{fr ? "Calendrier des absences" : "Absence calendar"}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {fr
                    ? "Clique sur un jour pour marquer un opérateur absent (non assignable)."
                    : "Click a day to mark an operator as unavailable (not assignable)."}
                </div>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setPresenceModalOpen(false)}
              >
                {fr ? "Fermer" : "Close"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {operators.map((operator) => {
                const active = selectedOperatorId === operator.id;
                return (
                  <button
                    key={`presence_op_${operator.id}`}
                    type="button"
                    className="admin-btn"
                    onClick={() => setSelectedOperatorId(operator.id)}
                    style={{
                      borderRadius: 999,
                      padding: "0.35rem 0.7rem",
                      border: "1px solid var(--border-color)",
                      background: active ? "var(--accent-primary)" : "transparent",
                      color: active ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {operator.fullName || operator.email}
                  </button>
                );
              })}
              {operators.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {fr ? "Aucun opérateur chargé." : "No operators loaded."}
                </span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() =>
                  setPresenceMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                  )
                }
              >
                <MaterialSymbol name="chevron_left" style={{ fontSize: 16 }} />
              </button>
              <strong>
                {presenceMonth.toLocaleDateString(fr ? "fr-FR" : "en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() =>
                  setPresenceMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                  )
                }
              >
                <MaterialSymbol name="chevron_right" style={{ fontSize: 16 }} />
              </button>
            </div>

            {selectedOperatorId ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: "0.35rem",
                }}
              >
                {monthDays.map((day) => {
                  const absent = selectedOperatorAbsences.includes(day);
                  const dayDate = new Date(`${day}T00:00:00`);
                  const isToday = day === getTodayKey();
                  const isCurrentMonth = getMonthKey(dayDate) === getMonthKey(presenceMonth);
                  if (!isCurrentMonth) return null;

                  return (
                    <button
                      key={`day_${day}`}
                      type="button"
                      onClick={() => toggleAbsenceDay(selectedOperatorId, day)}
                      className="admin-btn"
                      style={{
                        border: `1px solid ${absent ? "#ef4444" : "var(--border-color)"}`,
                        background: absent ? "#fee2e2" : "transparent",
                        color: absent ? "#991b1b" : "var(--text-primary)",
                        borderRadius: 8,
                        padding: "0.45rem 0.25rem",
                        fontSize: 12,
                        position: "relative",
                      }}
                    >
                      {dayDate.getDate()}
                      {isToday && (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 5,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--accent-primary)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {fr
                ? "Règle d'auto-attribution: uniquement opérateurs disponibles aujourd'hui, avec équilibrage de charge."
                : "Auto-assignment rule: available operators only today, with load balancing."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// UNFINISHED BOOKINGS
// ──────────────────────────────────────────

function UnfinishedBookingsTab({
  fr,
  rows,
  setRows,
  viewMode,
  operatorFilter,
  operators,
  operatorById,
  operatorsLoading,
  onOpenDetails,
}: {
  fr: boolean;
  rows: UnfinishedBookingRow[];
  setRows: React.Dispatch<React.SetStateAction<UnfinishedBookingRow[]>>;
  viewMode: ViewMode;
  operatorFilter: OperatorFilter;
  operators: OperatorAccount[];
  operatorById: Map<string, OperatorAccount>;
  operatorsLoading: boolean;
  onOpenDetails: (row: UnfinishedBookingRow) => void;
}) {
  const { openPanel } = useRightPanel();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [openAssignMenuId, setOpenAssignMenuId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertSide, setDragInsertSide] = useState<"before" | "after">("before");
  const pointerRef = useRef<{ cardId: string; x: number; y: number; moved: boolean } | null>(null);

  const maxStep = useMemo(() => {
    return Math.max(1, ...rows.map((row) => row.totalSteps));
  }, [rows]);

  const columns = useMemo(() => {
    return Array.from({ length: maxStep }, (_, index) => index + 1);
  }, [maxStep]);

  const visibleRows = useMemo(() => {
    if (operatorFilter === "all") return rows;
    if (operatorFilter === "unassigned") return rows.filter((row) => !row.assignedOperatorId);
    return rows.filter((row) => row.assignedOperatorId === operatorFilter);
  }, [rows, operatorFilter]);

  const assignOperator = (leadId: string, operatorId: string | null) => {
    setRows((current) =>
      current.map((row) =>
        row.id === leadId ? { ...row, assignedOperatorId: operatorId ?? undefined } : row
      )
    );
    setOpenAssignMenuId(null);
  };

  const moveToStep = (leadId: string, nextStep: number) => {
    setRows((current) => {
      const moving = current.find((row) => row.id === leadId);
      if (!moving) return current;

      const without = current.filter((row) => row.id !== leadId);
      const next = {
        ...moving,
        step: Math.max(1, Math.min(nextStep, moving.totalSteps)),
      };

      const lastIndexInColumn = without.reduce((acc, row, index) => (row.step === next.step ? index : acc), -1);
      const insertIndex = lastIndexInColumn >= 0 ? lastIndexInColumn + 1 : without.length;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  const moveBeforeOrAfter = (leadId: string, targetId: string, side: "before" | "after", step: number) => {
    setRows((current) => {
      const moving = current.find((row) => row.id === leadId);
      if (!moving) return current;

      const without = current.filter((row) => row.id !== leadId);
      const targetIndex = without.findIndex((row) => row.id === targetId);
      if (targetIndex < 0) return current;

      const next = {
        ...moving,
        step: Math.max(1, Math.min(step, moving.totalSteps)),
      };

      const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  if (viewMode === "kanban") {
    return (
      <div style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {fr
            ? "Déplace un ticket entre colonnes pour mettre à jour son étape."
            : "Drag a ticket between columns to update its step."}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`,
            gap: "0.6rem",
            overflowX: "auto",
            paddingBottom: "0.3rem",
          }}
        >
          {columns.map((step) => {
            const stepRows = visibleRows.filter((row) => row.step === step);

            return (
              <div
                key={`step_${step}`}
                onDragOver={(event) => { event.preventDefault(); setDragOverColumn(step); }}
                onDragLeave={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null); }}
                onDrop={() => {
                  if (!draggingId) return;
                  moveToStep(draggingId, step);
                  setDraggingId(null);
                  setDragOverColumn(null);
                  setDragOverCardId(null);
                }}
                style={{
                  border: dragOverColumn === step ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: 10,
                  background: dragOverColumn === step ? "rgba(99,102,241,0.05)" : "var(--card-bg)",
                  minHeight: 280,
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  transition: "border-color 0.12s, background 0.12s",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    padding: "0.55rem 0.7rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {fr ? `Étape ${step}` : `Step ${step}`}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stepRows.length}</span>
                </div>

                <div style={{ padding: "0.55rem", display: "grid", gap: "0.45rem", alignContent: "start" }}>
                  {stepRows.map((row) => {
                    const assigned = row.assignedOperatorId
                      ? operatorById.get(row.assignedOperatorId)
                      : undefined;
                    const insertBefore = draggingId && dragOverCardId === row.id && dragInsertSide === "before";
                    const insertAfter = draggingId && dragOverCardId === row.id && dragInsertSide === "after";

                    return (
                      <div key={row.id} style={{ display: "grid", gap: 4 }}>
                        {insertBefore ? <div className="kanban-insert-line" /> : null}
                        <div
                          draggable
                          onDragStart={() => setDraggingId(row.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverColumn(null);
                            setDragOverCardId(null);
                            pointerRef.current = null;
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const nextSide = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            if (dragOverCardId !== row.id) setDragOverCardId(row.id);
                            if (dragInsertSide !== nextSide) setDragInsertSide(nextSide);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!draggingId || draggingId === row.id) return;
                            moveBeforeOrAfter(draggingId, row.id, dragInsertSide, step);
                            setDraggingId(null);
                            setDragOverCardId(null);
                            setDragOverColumn(null);
                          }}
                          onMouseDown={(event) => {
                            pointerRef.current = { cardId: row.id, x: event.clientX, y: event.clientY, moved: false };
                          }}
                          onMouseMove={(event) => {
                            if (!pointerRef.current || pointerRef.current.cardId !== row.id) return;
                            const dx = event.clientX - pointerRef.current.x;
                            const dy = event.clientY - pointerRef.current.y;
                            if (Math.hypot(dx, dy) > 6) {
                              pointerRef.current.moved = true;
                            }
                          }}
                          onMouseUp={(event) => {
                            const pointer = pointerRef.current;
                            pointerRef.current = null;
                            if (!pointer || pointer.cardId !== row.id || pointer.moved) return;
                            const target = event.target as HTMLElement | null;
                            if (target?.closest("button, a, input, select, textarea")) return;
                            openPanel({
                              panelId: "PLD_acquisition_kanban",
                              contextKey: "acquisition.unfinished",
                              entity: row,
                            });
                          }}
                          onMouseEnter={() => setHoveredCardId(row.id)}
                          onMouseLeave={() => setHoveredCardId(null)}
                          className="ui-hover-premium"
                          style={{
                            border: hoveredCardId === row.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                            borderRadius: 8,
                            background:
                              hoveredCardId === row.id
                                ? "var(--surface-secondary, rgba(255,255,255,0.06))"
                                : "var(--surface-secondary, rgba(255,255,255,0.02))",
                            padding: "0.5rem",
                            cursor: draggingId === row.id ? "grabbing" : "grab",
                            display: "grid",
                            gap: "0.35rem",
                            position: "relative",
                            opacity: draggingId === row.id ? 0 : 1,
                          }}
                        >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.contactLabel}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.centerName}
                            </div>
                          </div>

                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); setOpenAssignMenuId((current) => (current === row.id ? null : row.id)); }}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                padding: 0,
                                lineHeight: 1,
                              }}
                            >
                              <MaterialSymbol name="more_horiz" size={16} weight={500} opticalSize={20} />
                            </button>

                            {openAssignMenuId === row.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "110%",
                                  zIndex: 20,
                                  minWidth: 210,
                                  border: "1px solid var(--border-color)",
                                  borderRadius: 8,
                                  background: "var(--card-bg)",
                                  padding: "0.35rem",
                                  boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
                                  display: "grid",
                                  gap: "0.15rem",
                                }}
                              >
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", padding: "0.2rem 0.35rem" }}>
                                  {fr ? "Attribuer à" : "Assign to"}
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); assignOperator(row.id, null); }}
                                  className="admin-btn admin-btn-secondary"
                                  style={{ justifyContent: "flex-start", fontSize: 12 }}
                                >
                                  {fr ? "Aucun" : "None"}
                                </button>
                                {operatorsLoading ? (
                                  <div style={{ fontSize: 11, color: "var(--text-secondary)", padding: "0.3rem 0.35rem" }}>
                                    {fr ? "Chargement..." : "Loading..."}
                                  </div>
                                ) : (
                                  operators.map((operator) => (
                                    <button
                                      key={`assign_${row.id}_${operator.id}`}
                                      type="button"
                                      onClick={(event) => { event.stopPropagation(); assignOperator(row.id, operator.id); }}
                                      className="admin-btn admin-btn-secondary"
                                      style={{ justifyContent: "flex-start", fontSize: 12 }}
                                    >
                                      {operator.fullName || operator.email}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.priceLabel}</span>
                          {assigned ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "var(--surface-secondary)",
                                  color: "var(--text-primary)",
                                  fontSize: 10,
                                  fontWeight: 600,
                                }}
                                title={assigned.fullName || assigned.email}
                              >
                                {assigned.profileImage ? (
                                  <img
                                    src={assigned.profileImage}
                                    alt={assigned.fullName || assigned.email}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  (assigned.fullName || assigned.email || "?").slice(0, 1).toUpperCase()
                                )}
                              </span>
                            </span>
                          ) : null}
                        </div>
                        </div>
                        {insertAfter ? <div className="kanban-insert-line" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const tableRows = visibleRows.map((row) => ({
    ...row,
    stepLabel: `${row.step} / ${row.totalSteps}`,
    assignedOperator: row.assignedOperatorId ? operatorById.get(row.assignedOperatorId) : undefined,
  }));

  return (
    <TableWithColumnFilters
      title={fr ? "Bookings non finalisés" : "Unfinished Bookings"}
      description={fr ? "Prospects ayant commencé un booking sans le terminer." : "Prospects who started a booking without completing it."}
      data={tableRows}
      columns={[
        { key: "contactLabel", label: fr ? "Contact" : "Contact", filterType: "text" },
        { key: "email", label: "Email", filterType: "text", render: (row) => <span>{row.email || "—"}</span> },
        { key: "phone", label: fr ? "Téléphone" : "Phone", filterType: "text", render: (row) => <span>{row.phone || "—"}</span> },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "boxTypeName", label: fr ? "Type de box" : "Box Type", filterType: "text" },
        {
          key: "stepLabel",
          label: fr ? "Étape" : "Step",
          filterType: "text",
          render: (row) => {
            const pct = (row.step / row.totalSteps) * 100;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 50, height: 6, borderRadius: 3, background: "var(--surface-secondary, #e5e7eb)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: pct >= 80 ? "var(--color-success, #16a34a)" : pct >= 40 ? "var(--color-warning, #f59e0b)" : "var(--color-error, #dc2626)" }} />
                </div>
                <span style={{ fontSize: 12 }}>{row.stepLabel}</span>
              </div>
            );
          },
        },
        { key: "priceLabel", label: fr ? "Prix affiché" : "Displayed Price", filterType: "text" },
        {
          key: "assignedOperator",
          label: fr ? "Opérateur" : "Operator",
          filterType: "text",
          render: (row) => {
            const assigned = row.assignedOperator as OperatorAccount | undefined;
            if (!assigned) return <span style={{ color: "var(--text-secondary)" }}>—</span>;
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    overflow: "hidden",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--surface-secondary)",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {assigned.profileImage ? (
                    <img
                      src={assigned.profileImage}
                      alt={assigned.fullName || assigned.email}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    (assigned.fullName || assigned.email || "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <span style={{ fontSize: 12 }}>{assigned.fullName || assigned.email}</span>
              </span>
            );
          },
        },
        {
          key: "source",
          label: "Source",
          filterType: "select",
          selectOptions: [
            { value: "bot-ia", label: "Bot IA" },
            { value: "landing-page", label: "Landing Page" },
            { value: "leboncoin", label: "Leboncoin" },
            { value: "site-front", label: "Site Front" },
            { value: "facebook", label: "Facebook" },
            { value: "google-ads", label: "Google Ads" },
            { value: "parrainage", label: "Parrainage" },
          ],
          render: (row) => {
            const colors: Record<string, string> = {
              "bot-ia": "#8b5cf6",
              "landing-page": "#0ea5e9",
              "leboncoin": "#f97316",
              "site-front": "#10b981",
              "facebook": "#3b82f6",
              "google-ads": "#ef4444",
              "parrainage": "#a855f7",
            };
            return (
              <span style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 500,
                background: `${colors[row.source] || "#6b7280"}18`,
                color: colors[row.source] || "#6b7280",
              }}>
                {row.source}
              </span>
            );
          },
        },
        { key: "stoppedLabel", label: fr ? "Arrêté le" : "Stopped At", filterType: "text" },
        {
          key: "id",
          label: "",
          filterType: "text",
          render: (row) => (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => onOpenDetails(row as UnfinishedBookingRow)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="info" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Details" : "Details"}
              </button>
              <button
                type="button"
                onClick={() => window.alert(fr ? `Relance simulée pour ${row.contactLabel}` : `Simulated follow-up for ${row.contactLabel}`)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="reply" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Relancer" : "Follow up"}
              </button>
            </span>
          ),
        },
      ]}
    />
  );
}

// ──────────────────────────────────────────
// QUOTE REQUESTS
// ──────────────────────────────────────────

function QuoteRequestsTab({
  fr,
  rows,
  setRows,
  viewMode,
  operatorFilter,
  onOpenDetails,
}: {
  fr: boolean;
  rows: QuoteRow[];
  setRows: React.Dispatch<React.SetStateAction<QuoteRow[]>>;
  viewMode: ViewMode;
  operatorFilter: OperatorFilter;
  onOpenDetails: (row: QuoteRow) => void;
}) {
  const { openPanel } = useRightPanel();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertSide, setDragInsertSide] = useState<"before" | "after">("before");
  const pointerRef = useRef<{ cardId: string; x: number; y: number; moved: boolean } | null>(null);
  const statusOrder: QuoteStatus[] = ["new", "sent", "accepted", "expired", "abandoned"];

  const visibleRows = useMemo(() => {
    if (operatorFilter === "all") return rows;
    if (operatorFilter === "unassigned") return rows.filter((row) => !row.assignedOperatorId);
    return rows.filter((row) => row.assignedOperatorId === operatorFilter);
  }, [rows, operatorFilter]);

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      new: { bg: "var(--badge-blue-bg, #dbeafe)", text: "var(--badge-blue-text, #1e40af)" },
      sent: { bg: "var(--badge-yellow-bg, #fef9c3)", text: "var(--badge-yellow-text, #854d0e)" },
      accepted: { bg: "var(--badge-green-bg, #dcfce7)", text: "var(--badge-green-text, #166534)" },
      expired: { bg: "var(--badge-gray-bg, #f3f4f6)", text: "var(--badge-gray-text, #374151)" },
      abandoned: { bg: "var(--badge-red-bg, #fee2e2)", text: "var(--badge-red-text, #991b1b)" },
    };
    const c = colors[status] || colors.new;
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>{status}</span>;
  };

  const moveToStatus = (quoteId: string, nextStatus: QuoteStatus) => {
    setRows((current) => {
      const moving = current.find((row) => row.id === quoteId);
      if (!moving) return current;
      const without = current.filter((row) => row.id !== quoteId);
      const next = {
        ...moving,
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus, fr),
      };
      const lastIndexInColumn = without.reduce(
        (acc, row, index) => (row.status === nextStatus ? index : acc),
        -1
      );
      const insertIndex = lastIndexInColumn >= 0 ? lastIndexInColumn + 1 : without.length;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  const moveBeforeOrAfter = (
    quoteId: string,
    targetId: string,
    side: "before" | "after",
    nextStatus: QuoteStatus
  ) => {
    setRows((current) => {
      const moving = current.find((row) => row.id === quoteId);
      if (!moving) return current;
      const without = current.filter((row) => row.id !== quoteId);
      const targetIndex = without.findIndex((row) => row.id === targetId);
      if (targetIndex < 0) return current;

      const next = {
        ...moving,
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus, fr),
      };
      const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  if (viewMode === "kanban") {
    return (
      <div style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {fr
            ? "Kanban basé sur le statut: glisse une carte d'une colonne à l'autre."
            : "Status-based Kanban: drag a card from one status column to another."}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${statusOrder.length}, minmax(220px, 1fr))`,
            gap: "0.6rem",
            overflowX: "auto",
            paddingBottom: "0.3rem",
          }}
        >
          {statusOrder.map((status) => {
            const statusRows = visibleRows.filter((row) => row.status === status);
            return (
              <div
                key={`quote_col_${status}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragOverColumn !== status) {
                    setDragOverColumn(status);
                  }
                }}
                onDragLeave={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null); }}
                onDrop={() => {
                  if (!draggingId) return;
                  moveToStatus(draggingId, status);
                  setDraggingId(null);
                  setDragOverColumn(null);
                  setDragOverCardId(null);
                }}
                style={{
                  border: dragOverColumn === status ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: 10,
                  background: dragOverColumn === status ? "rgba(99,102,241,0.05)" : "var(--card-bg)",
                  minHeight: 260,
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  transition: "border-color 0.12s, background 0.12s",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    padding: "0.55rem 0.7rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{getStatusLabel(status, fr)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{statusRows.length}</span>
                </div>

                <div style={{ padding: "0.55rem", display: "grid", gap: "0.45rem", alignContent: "start" }}>
                  {statusRows.map((row) => {
                    const insertBefore = draggingId && dragOverCardId === row.id && dragInsertSide === "before";
                    const insertAfter = draggingId && dragOverCardId === row.id && dragInsertSide === "after";

                    return (
                      <div key={row.id} style={{ display: "grid", gap: 4 }}>
                        {insertBefore ? <div className="kanban-insert-line" /> : null}
                        <div
                          draggable
                          onDragStart={() => setDraggingId(row.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverColumn(null);
                            setDragOverCardId(null);
                            pointerRef.current = null;
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const nextSide = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            if (dragOverCardId !== row.id) setDragOverCardId(row.id);
                            if (dragInsertSide !== nextSide) setDragInsertSide(nextSide);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!draggingId || draggingId === row.id) return;
                            moveBeforeOrAfter(draggingId, row.id, dragInsertSide, status);
                            setDraggingId(null);
                            setDragOverCardId(null);
                            setDragOverColumn(null);
                          }}
                          onMouseDown={(event) => {
                            pointerRef.current = { cardId: row.id, x: event.clientX, y: event.clientY, moved: false };
                          }}
                          onMouseMove={(event) => {
                            if (!pointerRef.current || pointerRef.current.cardId !== row.id) return;
                            const dx = event.clientX - pointerRef.current.x;
                            const dy = event.clientY - pointerRef.current.y;
                            if (Math.hypot(dx, dy) > 6) {
                              pointerRef.current.moved = true;
                            }
                          }}
                          onMouseUp={(event) => {
                            const pointer = pointerRef.current;
                            pointerRef.current = null;
                            if (!pointer || pointer.cardId !== row.id || pointer.moved) return;
                            const target = event.target as HTMLElement | null;
                            if (target?.closest("button, a, input, select, textarea")) return;
                            openPanel({
                              panelId: "PLD_acquisition_kanban",
                              contextKey: "acquisition.quotes",
                              entity: row,
                            });
                          }}
                          onMouseEnter={() => setHoveredCardId(row.id)}
                          onMouseLeave={() => setHoveredCardId(null)}
                          className="ui-hover-premium"
                          style={{
                            border:
                              hoveredCardId === row.id
                                ? "1px solid var(--accent-primary)"
                                : "1px solid var(--border-color)",
                            borderRadius: 8,
                            background:
                              hoveredCardId === row.id
                                ? "var(--surface-secondary, rgba(255,255,255,0.06))"
                                : "var(--surface-secondary, rgba(255,255,255,0.02))",
                            padding: "0.5rem",
                            cursor: draggingId === row.id ? "grabbing" : "grab",
                            display: "grid",
                            gap: "0.3rem",
                            opacity: draggingId === row.id ? 0 : 1,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{row.fullName}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.centerName}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.sizeLabel}</div>
                        </div>
                        {insertAfter ? <div className="kanban-insert-line" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <TableWithColumnFilters
      title={fr ? "Demandes de devis" : "Quote Requests"}
      description={fr ? "Toutes les demandes de devis reçues." : "All received quote requests."}
      data={visibleRows}
      columns={[
        { key: "fullName", label: fr ? "Nom" : "Name", filterType: "text" },
        { key: "email", label: "Email", filterType: "text" },
        { key: "phone", label: fr ? "Téléphone" : "Phone", filterType: "text", render: (row) => <span>{row.phone || "—"}</span> },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "sizeLabel", label: fr ? "Taille" : "Size", filterType: "text" },
        {
          key: "status",
          label: fr ? "Statut" : "Status",
          filterType: "select",
          selectOptions: [
            { value: "new", label: fr ? "Nouveau" : "New" },
            { value: "sent", label: fr ? "Envoyé" : "Sent" },
            { value: "accepted", label: fr ? "Accepté" : "Accepted" },
            { value: "expired", label: fr ? "Expiré" : "Expired" },
            { value: "abandoned", label: fr ? "Abandonné" : "Abandoned" },
          ],
          render: (row) => statusBadge(row.status),
        },
        { key: "createdLabel", label: fr ? "Créé le" : "Created", filterType: "text" },
        { key: "sentLabel", label: fr ? "Envoyé le" : "Sent", filterType: "text" },
        {
          key: "message",
          label: "Message",
          filterType: "text",
          render: (row) => (
            <span style={{ fontSize: 12, maxWidth: 200, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.message || "—"}
            </span>
          ),
        },
        {
          key: "id",
          label: "",
          filterType: "text",
          render: (row) => (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => onOpenDetails(row as QuoteRow)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="info" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Details" : "Details"}
              </button>
              {row.status === "new" ? (
                <button
                  type="button"
                  onClick={() => window.alert(fr ? `Envoi de devis simulé pour ${row.fullName}` : `Simulated quote send for ${row.fullName}`)}
                  className="admin-btn admin-btn-primary"
                  style={{ padding: "3px 10px", fontSize: 11 }}
                >
                  <MaterialSymbol name="send" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                  {fr ? "Envoyer" : "Send"}
                </button>
              ) : null}
            </span>
          ),
        },
      ]}
    />
  );
}

// ──────────────────────────────────────────
// ABANDONED QUOTES
// ──────────────────────────────────────────

function AbandonedQuotesTab({
  fr,
  rows,
  setRows,
  viewMode,
  operatorFilter,
  onOpenDetails,
}: {
  fr: boolean;
  rows: QuoteRow[];
  setRows: React.Dispatch<React.SetStateAction<QuoteRow[]>>;
  viewMode: ViewMode;
  operatorFilter: OperatorFilter;
  onOpenDetails: (row: QuoteRow) => void;
}) {
  const { openPanel } = useRightPanel();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertSide, setDragInsertSide] = useState<"before" | "after">("before");
  const pointerRef = useRef<{ cardId: string; x: number; y: number; moved: boolean } | null>(null);
  const filteredRows = useMemo(() => {
    const base = rows.filter((q) => q.status === "abandoned" || q.status === "expired");
    if (operatorFilter === "all") return base;
    if (operatorFilter === "unassigned") return base.filter((row) => !row.assignedOperatorId);
    return base.filter((row) => row.assignedOperatorId === operatorFilter);
  }, [rows, operatorFilter]);
  const statusOrder: QuoteStatus[] = ["expired", "abandoned"];

  const moveToStatus = (quoteId: string, nextStatus: QuoteStatus) => {
    if (nextStatus !== "expired" && nextStatus !== "abandoned") return;
    setRows((current) => {
      const moving = current.find((row) => row.id === quoteId);
      if (!moving) return current;
      const without = current.filter((row) => row.id !== quoteId);
      const next = {
        ...moving,
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus, fr),
      };
      const lastIndexInColumn = without.reduce(
        (acc, row, index) => (row.status === nextStatus ? index : acc),
        -1
      );
      const insertIndex = lastIndexInColumn >= 0 ? lastIndexInColumn + 1 : without.length;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  const moveBeforeOrAfter = (
    quoteId: string,
    targetId: string,
    side: "before" | "after",
    nextStatus: QuoteStatus
  ) => {
    if (nextStatus !== "expired" && nextStatus !== "abandoned") return;
    setRows((current) => {
      const moving = current.find((row) => row.id === quoteId);
      if (!moving) return current;
      const without = current.filter((row) => row.id !== quoteId);
      const targetIndex = without.findIndex((row) => row.id === targetId);
      if (targetIndex < 0) return current;

      const next = {
        ...moving,
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus, fr),
      };
      const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  if (filteredRows.length === 0) {
    return (
      <div className="admin-placeholder-card" style={{ padding: 20, textAlign: "center" }}>
        <MaterialSymbol name="check_circle" style={{ fontSize: 40, color: "var(--color-success, #16a34a)", marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fr ? "Aucun devis abandonné." : "No abandoned quotes."}</p>
      </div>
    );
  }

  if (viewMode === "kanban") {
    return (
      <div style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {fr
            ? "Kanban basé sur la colonne statut (Expiré / Abandonné)."
            : "Kanban based on status column (Expired / Abandoned)."}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(240px, 1fr))",
            gap: "0.6rem",
            overflowX: "auto",
            paddingBottom: "0.3rem",
          }}
        >
          {statusOrder.map((status) => {
            const statusRows = filteredRows.filter((row) => row.status === status);
            return (
              <div
                key={`abandoned_col_${status}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragOverColumn !== status) {
                    setDragOverColumn(status);
                  }
                }}
                onDragLeave={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null); }}
                onDrop={() => {
                  if (!draggingId) return;
                  moveToStatus(draggingId, status);
                  setDraggingId(null);
                  setDragOverColumn(null);
                  setDragOverCardId(null);
                }}
                style={{
                  border: dragOverColumn === status ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: 10,
                  background: dragOverColumn === status ? "rgba(99,102,241,0.05)" : "var(--card-bg)",
                  minHeight: 260,
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  transition: "border-color 0.12s, background 0.12s",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    padding: "0.55rem 0.7rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{getStatusLabel(status, fr)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{statusRows.length}</span>
                </div>

                <div style={{ padding: "0.55rem", display: "grid", gap: "0.45rem", alignContent: "start" }}>
                  {statusRows.map((row) => {
                    const insertBefore = draggingId && dragOverCardId === row.id && dragInsertSide === "before";
                    const insertAfter = draggingId && dragOverCardId === row.id && dragInsertSide === "after";

                    return (
                      <div key={row.id} style={{ display: "grid", gap: 4 }}>
                        {insertBefore ? <div className="kanban-insert-line" /> : null}
                        <div
                          draggable
                          onDragStart={() => setDraggingId(row.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverColumn(null);
                            setDragOverCardId(null);
                            pointerRef.current = null;
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const nextSide = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            if (dragOverCardId !== row.id) setDragOverCardId(row.id);
                            if (dragInsertSide !== nextSide) setDragInsertSide(nextSide);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!draggingId || draggingId === row.id) return;
                            moveBeforeOrAfter(draggingId, row.id, dragInsertSide, status);
                            setDraggingId(null);
                            setDragOverCardId(null);
                            setDragOverColumn(null);
                          }}
                          onMouseDown={(event) => {
                            pointerRef.current = { cardId: row.id, x: event.clientX, y: event.clientY, moved: false };
                          }}
                          onMouseMove={(event) => {
                            if (!pointerRef.current || pointerRef.current.cardId !== row.id) return;
                            const dx = event.clientX - pointerRef.current.x;
                            const dy = event.clientY - pointerRef.current.y;
                            if (Math.hypot(dx, dy) > 6) {
                              pointerRef.current.moved = true;
                            }
                          }}
                          onMouseUp={(event) => {
                            const pointer = pointerRef.current;
                            pointerRef.current = null;
                            if (!pointer || pointer.cardId !== row.id || pointer.moved) return;
                            const target = event.target as HTMLElement | null;
                            if (target?.closest("button, a, input, select, textarea")) return;
                            openPanel({
                              panelId: "PLD_acquisition_kanban",
                              contextKey: "acquisition.abandoned",
                              entity: row,
                            });
                          }}
                          onMouseEnter={() => setHoveredCardId(row.id)}
                          onMouseLeave={() => setHoveredCardId(null)}
                          className="ui-hover-premium"
                          style={{
                            border:
                              hoveredCardId === row.id
                                ? "1px solid var(--accent-primary)"
                                : "1px solid var(--border-color)",
                            borderRadius: 8,
                            background:
                              hoveredCardId === row.id
                                ? "var(--surface-secondary, rgba(255,255,255,0.06))"
                                : "var(--surface-secondary, rgba(255,255,255,0.02))",
                            padding: "0.5rem",
                            cursor: draggingId === row.id ? "grabbing" : "grab",
                            display: "grid",
                            gap: "0.3rem",
                            opacity: draggingId === row.id ? 0 : 1,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{row.fullName}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.centerName}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.sizeLabel}</div>
                        </div>
                        {insertAfter ? <div className="kanban-insert-line" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <TableWithColumnFilters
      title={fr ? "Devis non finalisés" : "Unfinished Quotes"}
      description={fr ? "Devis expirés ou abandonnés nécessitant un suivi." : "Expired or abandoned quotes needing follow-up."}
      data={filteredRows}
      columns={[
        { key: "fullName", label: fr ? "Nom" : "Name", filterType: "text" },
        { key: "email", label: "Email", filterType: "text" },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "sizeLabel", label: fr ? "Taille" : "Size", filterType: "text" },
        {
          key: "status",
          label: fr ? "Statut" : "Status",
          filterType: "select",
          selectOptions: [
            { value: "abandoned", label: fr ? "Abandonné" : "Abandoned" },
            { value: "expired", label: fr ? "Expiré" : "Expired" },
          ],
          render: (row) => (
            <span style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: row.status === "abandoned" ? "var(--badge-red-bg, #fee2e2)" : "var(--badge-gray-bg, #f3f4f6)",
              color: row.status === "abandoned" ? "var(--badge-red-text, #991b1b)" : "var(--badge-gray-text, #374151)",
            }}>
              {row.statusLabel}
            </span>
          ),
        },
        { key: "createdLabel", label: fr ? "Créé le" : "Created", filterType: "text" },
        {
          key: "id",
          label: "",
          filterType: "text",
          render: (row) => (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => onOpenDetails(row as QuoteRow)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="info" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Details" : "Details"}
              </button>
              <button
                type="button"
                onClick={() => window.alert(fr ? `Relance simulée pour ${row.fullName}` : `Simulated follow-up for ${row.fullName}`)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="reply" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Relancer" : "Follow up"}
              </button>
            </span>
          ),
        },
      ]}
    />
  );
}
