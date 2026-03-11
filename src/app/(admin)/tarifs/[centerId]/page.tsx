"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { centers } from "@/lib/mock/centers-and-pricing";
import {
  getPricingTiersByCenter,
  getIndividualBoxesByCenter,
  updatePricingTier,
  bulkUpdatePricingTiers,
  bulkUpdateBasePrice,
  getActivePriceField,
} from "@/lib/mock/crm";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";
import type { PricingTier } from "@/lib/types";

type PercentColumn = "percentAbove20" | "percentAbove10" | "percentBelow10" | "percentBelow5";

export default function TarifsMatrixPage() {
  const params = useParams<{ centerId: string }>();
  const centerId = Array.isArray(params?.centerId) ? params.centerId[0] : params?.centerId;
  const router = useRouter();
  const { locale } = useLocale();
  const fr = locale === "fr";

  const center = centers.find((c) => c.id === centerId);
  const [tiers, setTiers] = useState<PricingTier[]>(() => centerId ? getPricingTiersByCenter(centerId) : []);
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set());

  // Track which columns to target for bulk ops
  const [bulkTargetCols, setBulkTargetCols] = useState<Set<PercentColumn>>(
    new Set(["percentAbove20", "percentAbove10", "percentBelow10", "percentBelow5"])
  );
  const [customDelta, setCustomDelta] = useState("");
  const [customMode, setCustomMode] = useState<"percent" | "absolute">("percent");
  const [roundToEuro, setRoundToEuro] = useState(false);
  const [modifyPriceDirectly, setModifyPriceDirectly] = useState(false);

  // Base price bulk modification
  const [basePriceDelta, setBasePriceDelta] = useState("");
  const [basePriceMode, setBasePriceMode] = useState<"percent" | "absolute">("percent");

  // Inline editing: all cells are always editable inputs
  const [editedValues, setEditedValues] = useState<Record<string, Record<string, string>>>({});

  const refreshTiers = useCallback(() => {
    setTiers(centerId ? [...getPricingTiersByCenter(centerId)] : []);
    setEditedValues({});
  }, [centerId]);

  // Group by floor, sort sizes ascending within each floor
  const floors = useMemo(() => [...new Set(tiers.map((t) => t.floor))].sort(), [tiers]);

  const tiersByFloor = useMemo(() => {
    const map: Record<number, PricingTier[]> = {};
    for (const f of floors) {
      map[f] = tiers.filter((t) => t.floor === f).sort((a, b) => a.boxSizeM2 - b.boxSizeM2);
    }
    return map;
  }, [tiers, floors]);

  const boxes = useMemo(() => centerId ? getIndividualBoxesByCenter(centerId) : [], [centerId]);
  const totalBoxes = boxes.length;
  const occupiedBoxes = boxes.filter((b) => b.status === "occupé").length;

  // ── Size pricing alerts: detect smaller size with higher price than larger size on same floor ──
  const sizeAlerts = useMemo(() => {
    const alerts: string[] = [];
    for (const f of floors) {
      const floorTiers = tiersByFloor[f] || [];
      for (let i = 0; i < floorTiers.length - 1; i++) {
        const small = floorTiers[i];
        const big = floorTiers[i + 1];
        const activeSmall = small[getActivePriceField(small)];
        const activeBig = big[getActivePriceField(big)];
        if (activeSmall > activeBig) {
          const floorName = f === 0 ? "RDC" : `${fr ? "Étage" : "Floor"} ${f}`;
          alerts.push(
            fr
              ? `⚠️ ${floorName} : ${small.boxSizeM2}m² (${activeSmall}€) est plus cher que ${big.boxSizeM2}m² (${activeBig}€)`
              : `⚠️ ${floorName}: ${small.boxSizeM2}m² (${activeSmall}€) is more expensive than ${big.boxSizeM2}m² (${activeBig}€)`
          );
        }
      }
    }
    return alerts;
  }, [tiers, floors, tiersByFloor, fr]);

  // ── Selection helpers ──

  const handleToggleSelect = useCallback((tierId: string) => {
    setSelectedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tierId)) next.delete(tierId);
      else next.add(tierId);
      return next;
    });
  }, []);

  const handleSelectFloor = useCallback((floor: number) => {
    const floorTierIds = tiers.filter((t) => t.floor === floor).map((t) => t.id);
    setSelectedTiers((prev) => {
      const allSelected = floorTierIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        floorTierIds.forEach((id) => next.delete(id));
      } else {
        floorTierIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [tiers]);

  // ── Inline cell edit ──

  const getCellValue = (tierId: string, field: string, original: number): string => {
    return editedValues[tierId]?.[field] ?? String(original);
  };

  const handleCellChange = (tierId: string, field: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [tierId]: { ...prev[tierId], [field]: value },
    }));
  };

  const handleCellBlur = (tierId: string, field: string) => {
    const raw = editedValues[tierId]?.[field];
    if (raw === undefined) return;
    const num = parseFloat(raw);
    if (isNaN(num)) {
      // Revert
      setEditedValues((prev) => {
        const next = { ...prev };
        if (next[tierId]) {
          const { [field]: _, ...rest } = next[tierId];
          next[tierId] = rest;
        }
        return next;
      });
      return;
    }
    const value = field === "basePrice" ? Math.round(num) : parseFloat(num.toFixed(2));
    const updates: Record<string, number> = { [field]: value };
    updatePricingTier(tierId, updates as Pick<PricingTier, "basePrice" | "percentAbove20" | "percentAbove10" | "percentBelow10" | "percentBelow5">);
    refreshTiers();
  };

  // ── Bulk update ──

  const toggleBulkCol = (col: PercentColumn) => {
    setBulkTargetCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const handleBulkUpdate = useCallback((type: "percent" | "absolute", value: number) => {
    if (selectedTiers.size === 0 || bulkTargetCols.size === 0) return;
    const action = type === "percent"
      ? { type: "percent" as const, deltaPercent: value }
      : { type: "absolute" as const, deltaAmount: value };
    bulkUpdatePricingTiers([...selectedTiers], action, [...bulkTargetCols], { roundToEuro, modifyPriceDirectly });
    refreshTiers();
  }, [selectedTiers, bulkTargetCols, refreshTiers, roundToEuro, modifyPriceDirectly]);

  const handleCustomBulk = () => {
    const val = parseFloat(customDelta);
    if (isNaN(val) || val === 0) return;
    handleBulkUpdate(customMode, val);
    setCustomDelta("");
  };

  const handleBasePriceBulk = () => {
    const val = parseFloat(basePriceDelta);
    if (isNaN(val) || val === 0 || selectedTiers.size === 0) return;
    const action = basePriceMode === "percent"
      ? { type: "percent" as const, deltaPercent: val }
      : { type: "absolute" as const, deltaAmount: val };
    bulkUpdateBasePrice([...selectedTiers], action);
    refreshTiers();
    setBasePriceDelta("");
  };

  // ── Render helpers ──

  if (!center) {
    return (
      <div>
        <h1 className="admin-page-title">{fr ? "Centre introuvable" : "Center not found"}</h1>
        <button type="button" onClick={() => router.push("/tarifs")} className="admin-btn admin-btn-secondary" style={{ marginTop: 16 }}>
          ← {fr ? "Retour" : "Back"}
        </button>
      </div>
    );
  }

  const floorLabel = (floor: number) => floor === 0 ? "RDC" : `${fr ? "Étage" : "Floor"} ${floor}`;

  const percentFields: { key: PercentColumn; label: string; short: string }[] = [
    { key: "percentAbove20", label: fr ? "> 20 disponibles" : "> 20 available", short: "> 20" },
    { key: "percentAbove10", label: fr ? "> 10 disponibles" : "> 10 available", short: "> 10" },
    { key: "percentBelow10", label: fr ? "< 10 disponibles" : "< 10 available", short: "< 10" },
    { key: "percentBelow5", label: fr ? "< 5 disponibles" : "< 5 available", short: "< 5" },
  ];

  const percentToPriceKey: Record<PercentColumn, keyof PricingTier> = {
    percentAbove20: "priceAbove20",
    percentAbove10: "priceAbove10",
    percentBelow10: "priceBelow10",
    percentBelow5: "priceBelow5",
  };

  const priceToPercentKey: Record<string, PercentColumn> = {
    priceAbove20: "percentAbove20",
    priceAbove10: "percentAbove10",
    priceBelow10: "percentBelow10",
    priceBelow5: "percentBelow5",
  };

  const activePercentField = (tier: PricingTier): PercentColumn => {
    const pf = getActivePriceField(tier);
    return priceToPercentKey[pf];
  };

  const trendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <MaterialSymbol name="trending_up" style={{ fontSize: 16, color: "var(--color-success, #16a34a)" }} />;
      case "down": return <MaterialSymbol name="trending_down" style={{ fontSize: 16, color: "var(--color-error, #dc2626)" }} />;
      default: return <MaterialSymbol name="trending_flat" style={{ fontSize: 16, color: "var(--text-tertiary, #999)" }} />;
    }
  };

  const daysSince = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const dayColor = (d: number) => d <= 7 ? "var(--color-success, #16a34a)" : d <= 30 ? "var(--color-warning, #f59e0b)" : "var(--text-tertiary, #999)";

  const percentInputStyle = (isActive: boolean): React.CSSProperties => ({
    width: 56,
    padding: "4px 4px",
    textAlign: "right",
    fontSize: 12,
    fontWeight: isActive ? 700 : 400,
    border: `1px solid ${isActive ? "var(--accent-primary)" : "var(--border-secondary, #ddd)"}`,
    borderRadius: 4,
    background: isActive ? "rgba(59,130,246,0.04)" : "var(--surface-primary, #fff)",
    color: isActive ? "var(--accent-primary)" : "var(--text-primary)",
    outline: "none",
  });

  const basePriceInputStyle: React.CSSProperties = {
    width: 64,
    padding: "4px 6px",
    textAlign: "right",
    fontSize: 13,
    fontWeight: 600,
    border: "1px solid var(--border-secondary, #ddd)",
    borderRadius: 4,
    background: "var(--surface-primary, #fff)",
    color: "var(--text-primary)",
    outline: "none",
  };

  // Check if floor has selections for showing bulk bar above its table
  const floorHasSelection = (floor: number): boolean => {
    const floorTiers = tiersByFloor[floor] || [];
    return floorTiers.some((t) => selectedTiers.has(t.id));
  };

  // Build the bulk actions bar content (reused per floor)
  const renderBulkBar = () => (
    <div style={{
      padding: "12px 16px",
      marginBottom: 0,
      borderRadius: "8px 8px 0 0",
      background: "var(--surface-highlight, rgba(59,130,246,0.06))",
      border: "1px solid var(--accent-primary)",
      borderBottom: "none",
      fontSize: 13,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontWeight: 600 }}>
          {selectedTiers.size} {fr ? "lignes sélectionnées" : "rows selected"}
        </span>
        <button type="button" onClick={() => setSelectedTiers(new Set())} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 12, marginLeft: "auto" }}>
          {fr ? "Tout désélectionner" : "Deselect all"}
        </button>
      </div>

      {/* Toggle: modify percentages vs prices */}
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
          {fr ? "Mode :" : "Mode:"}
        </span>
        <button
          type="button"
          onClick={() => setModifyPriceDirectly(false)}
          style={{
            padding: "3px 10px", fontSize: 12, borderRadius: 4, cursor: "pointer",
            border: `1px solid ${!modifyPriceDirectly ? "var(--accent-primary)" : "var(--border-primary)"}`,
            background: !modifyPriceDirectly ? "var(--accent-primary)" : "var(--surface-primary)",
            color: !modifyPriceDirectly ? "#fff" : "var(--text-primary)",
          }}
        >
          {fr ? "Modifier les %" : "Modify %"}
        </button>
        <button
          type="button"
          onClick={() => setModifyPriceDirectly(true)}
          style={{
            padding: "3px 10px", fontSize: 12, borderRadius: 4, cursor: "pointer",
            border: `1px solid ${modifyPriceDirectly ? "var(--accent-primary)" : "var(--border-primary)"}`,
            background: modifyPriceDirectly ? "var(--accent-primary)" : "var(--surface-primary)",
            color: modifyPriceDirectly ? "#fff" : "var(--text-primary)",
          }}
        >
          {fr ? "Modifier les prix" : "Modify prices"}
        </button>
      </div>

      {/* Column selector */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginRight: 8 }}>
          {fr ? "Colonnes cibles :" : "Target columns:"}
        </span>
        {percentFields.map((pf) => (
          <label key={pf.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 12, fontSize: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={bulkTargetCols.has(pf.key)}
              onChange={() => toggleBulkCol(pf.key)}
            />
            {pf.short}
          </label>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
          {modifyPriceDirectly ? (fr ? "Prix :" : "Prices:") : (fr ? "Pourcentages :" : "Percentages:")}
        </span>
        <button type="button" onClick={() => handleBulkUpdate("percent", 5)} className="admin-btn admin-btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>+5%</button>
        <button type="button" onClick={() => handleBulkUpdate("percent", -5)} className="admin-btn admin-btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }}>-5%</button>
        <button type="button" onClick={() => handleBulkUpdate("percent", 10)} className="admin-btn admin-btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>+10%</button>
        <button type="button" onClick={() => handleBulkUpdate("percent", -10)} className="admin-btn admin-btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }}>-10%</button>

        <span style={{ borderLeft: "1px solid var(--border-primary)", height: 20, margin: "0 4px" }} />

        <button type="button" onClick={() => handleBulkUpdate("absolute", 5)} className="admin-btn admin-btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>+5 €</button>
        <button type="button" onClick={() => handleBulkUpdate("absolute", -5)} className="admin-btn admin-btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }}>-5 €</button>

        <span style={{ borderLeft: "1px solid var(--border-primary)", height: 20, margin: "0 4px" }} />

        {/* Custom */}
        <select
          value={customMode}
          onChange={(e) => setCustomMode(e.target.value as "percent" | "absolute")}
          style={{ padding: "3px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border-primary)", background: "var(--surface-primary)", color: "var(--text-primary)" }}
        >
          <option value="percent">%</option>
          <option value="absolute">€</option>
        </select>
        <input
          type="number"
          value={customDelta}
          onChange={(e) => setCustomDelta(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCustomBulk()}
          placeholder={fr ? "Valeur" : "Value"}
          style={{ width: 70, padding: "3px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border-primary)", background: "var(--surface-primary)", color: "var(--text-primary)", textAlign: "right" }}
        />
        <button type="button" onClick={handleCustomBulk} className="admin-btn admin-btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>
          {fr ? "Appliquer" : "Apply"}
        </button>
      </div>

      {/* Base price modification */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10, paddingTop: 8, borderTop: "1px solid var(--border-secondary, #ddd)" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
          {fr ? "Prix directeur :" : "Director price:"}
        </span>
        <select
          value={basePriceMode}
          onChange={(e) => setBasePriceMode(e.target.value as "percent" | "absolute")}
          style={{ padding: "3px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border-primary)", background: "var(--surface-primary)", color: "var(--text-primary)" }}
        >
          <option value="percent">%</option>
          <option value="absolute">€</option>
        </select>
        <input
          type="number"
          value={basePriceDelta}
          onChange={(e) => setBasePriceDelta(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleBasePriceBulk()}
          placeholder={fr ? "Valeur" : "Value"}
          style={{ width: 70, padding: "3px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border-primary)", background: "var(--surface-primary)", color: "var(--text-primary)", textAlign: "right" }}
        />
        <button type="button" onClick={handleBasePriceBulk} className="admin-btn admin-btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>
          {fr ? "Appliquer" : "Apply"}
        </button>
      </div>

      {/* Options */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={roundToEuro} onChange={(e) => setRoundToEuro(e.target.checked)} />
          {fr ? "Arrondir à l'euro supérieur" : "Round up to next euro"}
        </label>
      </div>

      {/* Size alerts */}
      {sizeAlerts.length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid var(--color-warning, #f59e0b)", fontSize: 12, color: "var(--color-warning, #f59e0b)" }}>
          {sizeAlerts.map((a, i) => <div key={i}>{a}</div>)}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button type="button" onClick={() => router.push("/tarifs")} className="admin-btn admin-btn-secondary" style={{ padding: "4px 12px" }}>←</button>
            <h1 className="admin-page-title" style={{ margin: 0 }}>{center.name}</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
            {center.address}{center.manager ? ` · ${fr ? "Responsable" : "Manager"}: ${center.manager}` : ""}{center.phone ? ` · ${center.phone}` : ""}
          </p>
        </div>

        {/* AI auto-fill button */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
            }}
            onClick={() => {/* TODO: AI auto-fill */}}
          >
            <MaterialSymbol name="auto_awesome" style={{ fontSize: 18 }} />
            {fr ? "Remplissage auto IA" : "AI Auto-fill"}
          </button>
          <div style={{ fontSize: 10, color: "var(--text-tertiary, #999)", marginTop: 4, maxWidth: 180 }}>
            {fr
              ? "Pré-remplit les prix directeurs et les pourcentages pour un nouveau centre."
              : "Pre-fills director prices and percentages for a new center."}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap", marginTop: 12 }}>
        {[
          { label: fr ? "Total boxes" : "Total Boxes", value: totalBoxes, color: undefined },
          { label: fr ? "Occupées" : "Occupied", value: occupiedBoxes, color: "var(--accent-primary)" },
          { label: fr ? "Taux d'occupation" : "Occupancy", value: `${totalBoxes > 0 ? Math.round((occupiedBoxes / totalBoxes) * 100) : 0}%`, color: undefined },
          { label: fr ? "Étages" : "Floors", value: center.floors ?? floors.length, color: undefined },
        ].map((card) => (
          <div key={card.label} className="admin-placeholder-card" style={{ padding: "12px 20px", flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Size alerts (global) */}
      {sizeAlerts.length > 0 && selectedTiers.size === 0 && (
        <div style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid var(--color-warning, #f59e0b)", fontSize: 12, color: "var(--color-warning, #f59e0b)" }}>
          {sizeAlerts.map((a, i) => <div key={i}>{a}</div>)}
        </div>
      )}

      {/* Per-floor sections */}
      {floors.map((floor) => {
        const floorTiers = tiersByFloor[floor] || [];
        const floorSelected = floorTiers.every((t) => selectedTiers.has(t.id));
        const hasSelection = floorHasSelection(floor);

        return (
          <section key={floor} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                <MaterialSymbol name={floor === 0 ? "home" : "stairs"} style={{ fontSize: 18, verticalAlign: "middle", marginRight: 6 }} />
                {floorLabel(floor)}
              </h2>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {floorTiers.length} {fr ? "tailles" : "sizes"}
              </span>
              <label style={{ fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                <input type="checkbox" checked={floorSelected} onChange={() => handleSelectFloor(floor)} />
                {fr ? "Tout sélectionner" : "Select all"}
              </label>
            </div>

            {/* Bulk bar appears just above the table when this floor has selections */}
            {hasSelection && renderBulkBar()}

            <div className="admin-placeholder-card" style={{ padding: 0, overflow: "auto", borderRadius: hasSelection ? "0 0 8px 8px" : undefined }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-primary)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 36 }}>
                      <input type="checkbox" checked={floorSelected} onChange={() => handleSelectFloor(floor)} />
                    </th>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>{fr ? "Taille" : "Size"}</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 12 }}>{fr ? "Prix dir." : "Dir. price"}</div>
                    </th>
                    {percentFields.map((pf) => (
                      <th key={pf.key} style={{ padding: "10px 8px", textAlign: "center" }} title={pf.label}>
                        <div style={{ fontSize: 12 }}>{pf.short}</div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary, #999)", fontWeight: 400 }}>{fr ? "% → prix" : "% → price"}</div>
                      </th>
                    ))}
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>{fr ? "Dispo" : "Avail"}</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>Total</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>{fr ? "Tend." : "Trend"}</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>{fr ? "Modifié" : "Changed"}</th>
                  </tr>
                </thead>
                <tbody>
                  {floorTiers.map((tier) => {
                    const isSelected = selectedTiers.has(tier.id);
                    const activePct = activePercentField(tier);
                    const columnDays = daysSince(tier.lastColumnChangeDate);

                    return (
                      <tr
                        key={tier.id}
                        style={{
                          borderBottom: "1px solid var(--border-secondary, #eee)",
                          background: isSelected ? "var(--surface-highlight, rgba(59,130,246,0.04))" : undefined,
                        }}
                      >
                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleToggleSelect(tier.id)} />
                        </td>
                        <td style={{ padding: "6px 12px", fontWeight: 600 }}>{tier.boxSizeM2} m²</td>
                        {/* Base / director price */}
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                            <input
                              type="number"
                              value={getCellValue(tier.id, "basePrice", tier.basePrice)}
                              onChange={(e) => handleCellChange(tier.id, "basePrice", e.target.value)}
                              onBlur={() => handleCellBlur(tier.id, "basePrice")}
                              onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                              style={basePriceInputStyle}
                            />
                            <span style={{ fontSize: 11, color: "var(--text-tertiary, #999)" }}>€</span>
                          </div>
                        </td>
                        {/* Percentage columns with computed price */}
                        {percentFields.map((pf) => {
                          const isActive = pf.key === activePct;
                          const pctVal = tier[pf.key] as number;
                          const priceKey = percentToPriceKey[pf.key] as keyof PricingTier;
                          const computedPrice = tier[priceKey] as number;

                          return (
                            <td key={pf.key} style={{ padding: "6px 4px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={getCellValue(tier.id, pf.key, pctVal)}
                                  onChange={(e) => handleCellChange(tier.id, pf.key, e.target.value)}
                                  onBlur={() => handleCellBlur(tier.id, pf.key)}
                                  onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                  style={percentInputStyle(isActive)}
                                />
                                <span style={{ fontSize: 10, color: "var(--text-tertiary, #999)" }}>%</span>
                                <span style={{
                                  fontSize: 12,
                                  fontWeight: isActive ? 700 : 400,
                                  color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                                  marginLeft: 2,
                                  minWidth: 36,
                                  textAlign: "right",
                                }}>
                                  {computedPrice}€
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                          <span style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: tier.currentAvailable <= 5 ? "var(--color-error, #dc2626)" : tier.currentAvailable <= 10 ? "var(--color-warning, #f59e0b)" : "var(--color-success, #16a34a)",
                          }}>
                            {tier.currentAvailable}
                          </span>
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "center", color: "var(--text-secondary)" }}>{tier.totalUnits}</td>
                        <td style={{ padding: "6px 12px", textAlign: "center" }}>{trendIcon(tier.trend)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "center", fontSize: 12, color: dayColor(columnDays) }}>
                          {columnDays === 0 ? (fr ? "Auj." : "Today") : `${columnDays}j`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p style={{ fontSize: 11, color: "var(--text-tertiary, #999)", marginTop: 4 }}>
        {fr
          ? "Le prix directeur sert de base. Les pourcentages (positifs ou négatifs) modulent le prix en fonction du nombre de boxes disponibles. Le prix actif (en gras bleu) dépend de la disponibilité. Sélectionnez des lignes pour appliquer des modifications en masse."
          : "The director price serves as a base. Percentages (positive or negative) modulate the price based on available boxes. The active price (bold blue) depends on availability. Select rows to apply bulk changes."}
      </p>
    </div>
  );
}
