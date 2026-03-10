"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getUnfinishedBookings, getQuoteRequests } from "@/lib/mock/crm";
import { centers, boxTypes } from "@/lib/mock/centers-and-pricing";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";

type AcqTab = "unfinished" | "quotes" | "abandoned";
type ViewMode = "table" | "kanban";

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

const STORAGE_KEY = "acquisition_settings_v1";

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

export default function AcquisitionPage() {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const [activeTab, setActiveTab] = useState<AcqTab>("unfinished");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [unfinishedRows, setUnfinishedRows] = useState<UnfinishedBookingRow[]>(() =>
    getInitialUnfinishedRows()
  );
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(true);
  const roundRobinRef = useRef(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        viewMode?: ViewMode;
        autoAssignEnabled?: boolean;
        unfinishedAssignments?: Record<string, string>;
      };

      if (parsed.viewMode === "kanban" || parsed.viewMode === "table") {
        setViewMode(parsed.viewMode);
      }
      if (typeof parsed.autoAssignEnabled === "boolean") {
        setAutoAssignEnabled(parsed.autoAssignEnabled);
      }
      if (parsed.unfinishedAssignments) {
        setUnfinishedRows((current) =>
          current.map((row) => ({
            ...row,
            assignedOperatorId: parsed.unfinishedAssignments?.[row.id] || row.assignedOperatorId,
          }))
        );
      }
    } catch {
      // Ignore localStorage parsing issues.
    }
  }, []);

  useEffect(() => {
    const unfinishedAssignments: Record<string, string> = {};
    unfinishedRows.forEach((row) => {
      if (row.assignedOperatorId) {
        unfinishedAssignments[row.id] = row.assignedOperatorId;
      }
    });

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        viewMode,
        autoAssignEnabled,
        unfinishedAssignments,
      })
    );
  }, [viewMode, autoAssignEnabled, unfinishedRows]);

  useEffect(() => {
    let mounted = true;
    const loadOperators = async () => {
      setOperatorsLoading(true);
      try {
        const res = await fetch("/api/accounts", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const payload = (await res.json()) as OperatorAccount[];
        if (!mounted) return;
        const filtered = payload.filter((item) => item.role === "admin" || item.role === "operator");
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
    if (!autoAssignEnabled || operators.length === 0) return;

    setUnfinishedRows((current) => {
      let changed = false;
      const next = current.map((row) => {
        if (row.assignedOperatorId) return row;
        const operator = operators[roundRobinRef.current % operators.length];
        roundRobinRef.current += 1;
        changed = true;
        return {
          ...row,
          assignedOperatorId: operator?.id,
        };
      });
      return changed ? next : current;
    });
  }, [autoAssignEnabled, operators]);

  const operatorById = useMemo(() => {
    const map = new Map<string, OperatorAccount>();
    operators.forEach((operator) => map.set(operator.id, operator));
    return map;
  }, [operators]);

  const tabs: { key: AcqTab; label: string; icon: string }[] = [
    { key: "unfinished", label: fr ? "Bookings non finalisés" : "Unfinished Bookings", icon: "pending_actions" },
    { key: "quotes", label: fr ? "Demandes de devis" : "Quote Requests", icon: "request_quote" },
    { key: "abandoned", label: fr ? "Devis non finalisés" : "Abandoned Quotes", icon: "cancel" },
  ];

  return (
    <div>
      <h1 className="admin-page-title">{fr ? "Acquisition" : "Acquisition"}</h1>
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
          operators={operators}
          operatorById={operatorById}
          operatorsLoading={operatorsLoading}
        />
      )}
      {activeTab === "quotes" && <QuoteRequestsTab fr={fr} />}
      {activeTab === "abandoned" && <AbandonedQuotesTab fr={fr} />}
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
  operators,
  operatorById,
  operatorsLoading,
}: {
  fr: boolean;
  rows: UnfinishedBookingRow[];
  setRows: React.Dispatch<React.SetStateAction<UnfinishedBookingRow[]>>;
  viewMode: ViewMode;
  operators: OperatorAccount[];
  operatorById: Map<string, OperatorAccount>;
  operatorsLoading: boolean;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [openAssignMenuId, setOpenAssignMenuId] = useState<string | null>(null);

  const maxStep = useMemo(() => {
    return Math.max(1, ...rows.map((row) => row.totalSteps));
  }, [rows]);

  const columns = useMemo(() => {
    return Array.from({ length: maxStep }, (_, index) => index + 1);
  }, [maxStep]);

  const assignOperator = (leadId: string, operatorId: string | null) => {
    setRows((current) =>
      current.map((row) =>
        row.id === leadId ? { ...row, assignedOperatorId: operatorId ?? undefined } : row
      )
    );
    setOpenAssignMenuId(null);
  };

  const moveToStep = (leadId: string, nextStep: number) => {
    setRows((current) =>
      current.map((row) =>
        row.id === leadId
          ? { ...row, step: Math.max(1, Math.min(nextStep, row.totalSteps)) }
          : row
      )
    );
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
            const stepRows = rows.filter((row) => row.step === step);

            return (
              <div
                key={`step_${step}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggingId) return;
                  moveToStep(draggingId, step);
                  setDraggingId(null);
                }}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  background: "var(--card-bg)",
                  minHeight: 280,
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
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

                    return (
                      <div
                        key={row.id}
                        draggable
                        onDragStart={() => setDraggingId(row.id)}
                        onDragEnd={() => setDraggingId(null)}
                        style={{
                          border: "1px solid var(--border-color)",
                          borderRadius: 8,
                          background: "var(--surface-secondary, rgba(255,255,255,0.02))",
                          padding: "0.5rem",
                          cursor: "grab",
                          display: "grid",
                          gap: "0.35rem",
                          position: "relative",
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
                              onClick={() => setOpenAssignMenuId((current) => (current === row.id ? null : row.id))}
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
                                  onClick={() => assignOperator(row.id, null)}
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
                                      onClick={() => assignOperator(row.id, operator.id)}
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

  const tableRows = rows.map((row) => ({
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
            <button
              type="button"
              onClick={() => window.alert(fr ? `Relance simulée pour ${row.contactLabel}` : `Simulated follow-up for ${row.contactLabel}`)}
              className="admin-btn admin-btn-secondary"
              style={{ padding: "3px 10px", fontSize: 11 }}
            >
              <MaterialSymbol name="reply" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
              {fr ? "Relancer" : "Follow up"}
            </button>
          ),
        },
      ]}
    />
  );
}

// ──────────────────────────────────────────
// QUOTE REQUESTS
// ──────────────────────────────────────────

function QuoteRequestsTab({ fr }: { fr: boolean }) {
  const quotes = useMemo(() => getQuoteRequests(), []);
  const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));

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

  const rows = quotes.map((q) => ({
    ...q,
    centerName: centerMap[q.centerId]?.name ?? q.centerId,
    sizeLabel: `${q.boxSizeWanted} m²`,
    createdLabel: new Date(q.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
    sentLabel: q.sentAt ? new Date(q.sentAt).toLocaleDateString("fr-FR") : "—",
  }));

  return (
    <TableWithColumnFilters
      title={fr ? "Demandes de devis" : "Quote Requests"}
      description={fr ? "Toutes les demandes de devis reçues." : "All received quote requests."}
      data={rows}
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
          render: (row) => row.status === "new" ? (
            <button
              type="button"
              onClick={() => window.alert(fr ? `Envoi de devis simulé pour ${row.fullName}` : `Simulated quote send for ${row.fullName}`)}
              className="admin-btn admin-btn-primary"
              style={{ padding: "3px 10px", fontSize: 11 }}
            >
              <MaterialSymbol name="send" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
              {fr ? "Envoyer" : "Send"}
            </button>
          ) : null,
        },
      ]}
    />
  );
}

// ──────────────────────────────────────────
// ABANDONED QUOTES
// ──────────────────────────────────────────

function AbandonedQuotesTab({ fr }: { fr: boolean }) {
  const quotes = useMemo(() => getQuoteRequests().filter((q) => q.status === "abandoned" || q.status === "expired"), []);
  const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));

  const rows = quotes.map((q) => ({
    ...q,
    centerName: centerMap[q.centerId]?.name ?? q.centerId,
    sizeLabel: `${q.boxSizeWanted} m²`,
    createdLabel: new Date(q.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
    statusLabel: q.status === "abandoned" ? (fr ? "Abandonné" : "Abandoned") : (fr ? "Expiré" : "Expired"),
  }));

  if (rows.length === 0) {
    return (
      <div className="admin-placeholder-card" style={{ padding: 20, textAlign: "center" }}>
        <MaterialSymbol name="check_circle" style={{ fontSize: 40, color: "var(--color-success, #16a34a)", marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fr ? "Aucun devis abandonné." : "No abandoned quotes."}</p>
      </div>
    );
  }

  return (
    <TableWithColumnFilters
      title={fr ? "Devis non finalisés" : "Unfinished Quotes"}
      description={fr ? "Devis expirés ou abandonnés nécessitant un suivi." : "Expired or abandoned quotes needing follow-up."}
      data={rows}
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
            <button
              type="button"
              onClick={() => window.alert(fr ? `Relance simulée pour ${row.fullName}` : `Simulated follow-up for ${row.fullName}`)}
              className="admin-btn admin-btn-secondary"
              style={{ padding: "3px 10px", fontSize: 11 }}
            >
              <MaterialSymbol name="reply" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
              {fr ? "Relancer" : "Follow up"}
            </button>
          ),
        },
      ]}
    />
  );
}
