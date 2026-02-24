"use client";

import { useState, useMemo } from "react";
import { getUnfinishedBookings, getQuoteRequests } from "@/lib/mock/crm";
import { centers, boxTypes } from "@/lib/mock/centers-and-pricing";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";

type AcqTab = "unfinished" | "quotes" | "abandoned";

export default function AcquisitionPage() {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const [activeTab, setActiveTab] = useState<AcqTab>("unfinished");

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

      {activeTab === "unfinished" && <UnfinishedBookingsTab fr={fr} />}
      {activeTab === "quotes" && <QuoteRequestsTab fr={fr} />}
      {activeTab === "abandoned" && <AbandonedQuotesTab fr={fr} />}
    </div>
  );
}

// ──────────────────────────────────────────
// UNFINISHED BOOKINGS
// ──────────────────────────────────────────

function UnfinishedBookingsTab({ fr }: { fr: boolean }) {
  const bookings = useMemo(() => getUnfinishedBookings(), []);
  const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));
  const btMap = Object.fromEntries(boxTypes.map((b) => [b.id, b]));

  const rows = bookings.map((ub) => ({
    ...ub,
    centerName: centerMap[ub.centerId]?.name ?? ub.centerId,
    boxTypeName: btMap[ub.boxTypeId]?.name ?? ub.boxTypeId,
    stepLabel: `${ub.step} / ${ub.totalSteps}`,
    priceLabel: `${ub.price} €`,
    stoppedLabel: new Date(ub.stoppedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    contactLabel: ub.fullName || ub.email || ub.phone || "—",
  }));

  return (
    <TableWithColumnFilters
      title={fr ? "Bookings non finalisés" : "Unfinished Bookings"}
      description={fr ? "Prospects ayant commencé un booking sans le terminer." : "Prospects who started a booking without completing it."}
      data={rows}
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
