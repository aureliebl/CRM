"use client";

import { useState } from "react";
import {
  getCenters,
  getBoxTypesByCenter,
  getPricingByCenter,
  bulkUpdatePricing,
  updatePricing,
} from "@/lib/mock/centers-and-pricing";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { useLocale } from "@/lib/use-locale";

export default function PricingPage() {
  const { locale } = useLocale();
  const formatLocale = locale === "fr" ? "fr-FR" : "en-US";
  const centers = getCenters();
  const [selectedCenterId, setSelectedCenterId] = useState<string | undefined>(
    undefined
  );
  const [selectedPricingIds, setSelectedPricingIds] = useState<string[]>([]);
  const [localVersion, setLocalVersion] = useState(0);

  const currentCenterId = selectedCenterId;
  const boxTypes = getBoxTypesByCenter(currentCenterId);
  const pricing = getPricingByCenter(currentCenterId);

  const centerLabel =
    centers.find((c) => c.id === currentCenterId)?.name ??
    (locale === "fr" ? "Tous les centres" : "All centers");

  const labels = locale === "fr"
    ? {
        pageTitle: "Matrice de prix",
        pageDescription:
          "Pilotage des prix des boxes par centre, taille et disponibilité. Les tendances sont calculées à partir de l'historique des prix.",
        centerSelection: "Sélection du centre",
        allCenters: "Tous les centres...",
        bulkActions: "Actions en masse :",
        selectAll: "Tout sélectionner",
        clearAll: "Tout désélectionner",
        alignRef: "Aligner sur prix de référence",
        tableDescription:
          'Sélectionnez une ou plusieurs lignes pour appliquer des actions globales. Le champ "Prix actuel" est éditable cellule par cellule.',
        center: "Centre",
        currentPrice: "Prix actuel",
        referencePrice: "Prix réf.",
        available: "Disponibles/Total",
        occupancy: "% Occupation",
        trend: "Tendance",
        updatedAt: "Dernière maj",
        trendUp: "↗ Prix en hausse",
        trendDown: "↘ Prix en baisse",
        trendStable: "→ Stable",
      }
    : {
        pageTitle: "Pricing matrix",
        pageDescription:
          "Manage box pricing by center, size and availability. Trends are computed from pricing history.",
        centerSelection: "Center selection",
        allCenters: "All centers...",
        bulkActions: "Bulk actions:",
        selectAll: "Select all",
        clearAll: "Clear selection",
        alignRef: "Align to reference price",
        tableDescription:
          'Select one or more rows to apply global actions. The "Current price" field is editable per row.',
        center: "Center",
        currentPrice: "Current price",
        referencePrice: "Ref. price",
        available: "Available/Total",
        occupancy: "% Occupancy",
        trend: "Trend",
        updatedAt: "Last update",
        trendUp: "↗ Price up",
        trendDown: "↘ Price down",
        trendStable: "→ Stable",
      };

  const toggleSelection = (pricingId: string) => {
    setSelectedPricingIds((prev) =>
      prev.includes(pricingId)
        ? prev.filter((id) => id !== pricingId)
        : [...prev, pricingId]
    );
  };

  const handleBulkPercent = (deltaPercent: number) => {
    if (selectedPricingIds.length === 0) return;
    bulkUpdatePricing(selectedPricingIds, {
      type: "percent",
      deltaPercent,
    });
    setLocalVersion((v) => v + 1);
  };

  const handleBulkAbsolute = (deltaAmount: number) => {
    if (selectedPricingIds.length === 0) return;
    bulkUpdatePricing(selectedPricingIds, {
      type: "absolute",
      deltaAmount,
    });
    setLocalVersion((v) => v + 1);
  };

  const handleBulkAlignReference = () => {
    if (selectedPricingIds.length === 0) return;
    bulkUpdatePricing(selectedPricingIds, {
      type: "alignToReference",
    });
    setLocalVersion((v) => v + 1);
  };

  const handleInlinePriceChange = (pricingId: string, value: string) => {
    const numeric = Number(value.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    updatePricing(pricingId, numeric);
    setLocalVersion((v) => v + 1);
  };

  const pricingWithBoxMeta = pricing.map((p) => ({
    ...p,
    box: boxTypes.find((b) => b.id === p.boxTypeId),
    centerLabel: centers.find((c) => c.id === p.centerId)?.name ?? p.centerId,
    availableLabel: `${p.availabilityCount} / ${p.totalUnits}`,
    occupancy:
      p.totalUnits === 0
        ? 0
        : Math.round(((p.totalUnits - p.availabilityCount) / p.totalUnits) * 100),
    trendLabel:
      p.trend === "up"
        ? labels.trendUp
        : p.trend === "down"
        ? labels.trendDown
        : labels.trendStable,
    lastUpdatedLabel: new Date(p.lastUpdated).toLocaleDateString(formatLocale),
  }));

  return (
    <div key={localVersion}>
      <h1 className="admin-page-title">{labels.pageTitle}</h1>
      <p className="admin-page-description">{labels.pageDescription}</p>

      <section
        className="admin-placeholder-card"
        style={{
          marginBottom: "1rem",
          padding: "1rem",
        }}
      >
        <div style={{ marginBottom: "0.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {labels.centerSelection}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <select
            value={currentCenterId ?? ""}
            onChange={(e) => setSelectedCenterId(e.target.value || undefined)}
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              padding: "0.4rem",
              borderRadius: "0.25rem",
              fontSize: "0.8rem",
            }}
          >
            <option value="">{labels.allCenters}</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section
        aria-label="Actions en masse"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
          fontSize: "0.8rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>{labels.bulkActions}</span>
          <button
            type="button"
            onClick={() => setSelectedPricingIds(pricing.map((p) => p.id))}
            style={{
              fontSize: "0.78rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.6)",
              backgroundColor: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            {labels.selectAll}
          </button>
          <button
            type="button"
            onClick={() => setSelectedPricingIds([])}
            style={{
              fontSize: "0.78rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.6)",
              backgroundColor: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            {labels.clearAll}
          </button>
          <button
            type="button"
            onClick={() => handleBulkPercent(5)}
            style={{
              fontSize: "0.78rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.6)",
              backgroundColor: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            +5%
          </button>
          <button
            type="button"
            onClick={() => handleBulkPercent(-5)}
            style={{
              fontSize: "0.78rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.6)",
              backgroundColor: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            -5%
          </button>
          <button
            type="button"
            onClick={() => handleBulkAbsolute(5)}
            style={{
              fontSize: "0.78rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.6)",
              backgroundColor: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            +5 €
          </button>
          <button
            type="button"
            onClick={() => handleBulkAbsolute(-5)}
            style={{
              fontSize: "0.78rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.6)",
              backgroundColor: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            -5 €
          </button>
          <button
            type="button"
            onClick={handleBulkAlignReference}
            style={{
              fontSize: "0.78rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid rgba(129,140,248,0.8)",
              background:
                "linear-gradient(120deg, rgba(30,64,175,0.9), rgba(79,70,229,0.9))",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            {labels.alignRef}
          </button>
        </div>
      </section>

      <TableWithColumnFilters
        title={`${centerLabel} — ${labels.pageTitle}`}
        description={labels.tableDescription}
        data={pricingWithBoxMeta}
        columns={[
          {
            key: "id",
            label: "",
            filterType: "none",
            render: (row) => (
              <input
                type="checkbox"
                checked={selectedPricingIds.includes(row.id)}
                onChange={() => toggleSelection(row.id)}
              />
            ),
          },
          {
            key: "boxTypeId",
            label: "Box",
            filterType: "text",
            render: (row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{row.box?.name ?? row.boxTypeId}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {row.box?.sizeM2}m² · {row.box?.features?.join(" · ")}
                </div>
              </div>
            ),
          },
          { key: "centerLabel", label: labels.center, filterType: "text" },
          {
            key: "currentPrice",
            label: labels.currentPrice,
            filterType: "text",
            render: (row) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap" }}>
                <input
                  type="number"
                  defaultValue={row.currentPrice}
                  min={0}
                  step={1}
                  onBlur={(e) => handleInlinePriceChange(row.id, e.target.value)}
                  style={{
                    width: "6rem",
                    padding: "0.2rem 0.35rem",
                    borderRadius: "0.4rem",
                    border: "1px solid rgba(148,163,184,0.6)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: "0.78rem",
                  }}
                />
                <span>€</span>
              </span>
            ),
          },
          {
            key: "referencePrice",
            label: labels.referencePrice,
            filterType: "text",
            render: (row) => `${Number(row.referencePrice).toFixed(0)} €`,
          },
          { key: "availableLabel", label: labels.available, filterType: "text" },
          {
            key: "occupancy",
            label: labels.occupancy,
            filterType: "text",
            render: (row) => `${String(row.occupancy)}%`,
          },
          {
            key: "trend",
            label: labels.trend,
            filterType: "select",
            selectOptions: [
              { value: "up", label: "Up" },
              { value: "down", label: "Down" },
              { value: "stable", label: "Stable" },
            ],
            render: (row) => (
              <span
                style={{
                  fontSize: "0.8rem",
                  color:
                    row.trend === "up"
                      ? "rgb(74,222,128)"
                      : row.trend === "down"
                      ? "rgb(248,113,113)"
                      : "var(--text-secondary)",
                }}
              >
                {row.trendLabel}
              </span>
            ),
          },
          { key: "lastUpdatedLabel", label: labels.updatedAt, filterType: "text" },
        ]}
      />
    </div>
  );
}


