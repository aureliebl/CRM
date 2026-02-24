"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { centers } from "@/lib/mock/centers-and-pricing";
import {
  getPricingTiersByCenter,
  getIndividualBoxesByCenter,
  updatePricingTier,
  bulkUpdatePricingTiers,
  getActivePriceField,
} from "@/lib/mock/crm";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";
import type { PricingTier } from "@/lib/types";

type PriceColumn = "priceAbove20" | "priceAbove10" | "priceBelow10" | "priceBelow5";

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
  const [bulkTargetCols, setBulkTargetCols] = useState<Set<PriceColumn>>(
    new Set(["priceAbove20", "priceAbove10", "priceBelow10", "priceBelow5"])
  );
  const [customDelta, setCustomDelta] = useState("");
  const [customMode, setCustomMode] = useState<"percent" | "absolute">("percent");

  // Inline editing: all price cells are always editable inputs
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
    updatePricingTier(tierId, { [field]: Math.round(num) } as any);
    refreshTiers();
  };

  // ── Bulk update ──

  const toggleBulkCol = (col: PriceColumn) => {
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
    bulkUpdatePricingTiers([...selectedTiers], action, [...bulkTargetCols]);
    refreshTiers();
    setSelectedTiers(new Set());
  }, [selectedTiers, bulkTargetCols, refreshTiers]);

  const handleCustomBulk = () => {
    const val = parseFloat(customDelta);
    if (isNaN(val) || val === 0) return;
    handleBulkUpdate(customMode, val);
    setCustomDelta("");
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

  const priceFields: { key: PriceColumn; label: string; short: string }[] = [
    { key: "priceAbove20", label: fr ? "> 20 disponibles" : "> 20 available", short: "> 20" },
    { key: "priceAbove10", label: fr ? "> 10 disponibles" : "> 10 available", short: "> 10" },
    { key: "priceBelow10", label: fr ? "< 10 disponibles" : "< 10 available", short: "< 10" },
    { key: "priceBelow5", label: fr ? "< 5 disponibles" : "< 5 available", short: "< 5" },
  ];

  const trendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <MaterialSymbol name="trending_up" style={{ fontSize: 16, color: "var(--color-success, #16a34a)" }} />;
      case "down": return <MaterialSymbol name="trending_down" style={{ fontSize: 16, color: "var(--color-error, #dc2626)" }} />;
      default: return <MaterialSymbol name="trending_flat" style={{ fontSize: 16, color: "var(--text-tertiary, #999)" }} />;
    }
  };

  const daysSince = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const dayColor = (d: number) => d <= 7 ? "var(--color-success, #16a34a)" : d <= 30 ? "var(--color-warning, #f59e0b)" : "var(--text-tertiary, #999)";

  const inputStyle = (isActive: boolean): React.CSSProperties => ({
    width: 64,
    padding: "4px 6px",
    textAlign: "right",
    fontSize: 13,
    fontWeight: isActive ? 700 : 400,
    border: `1px solid ${isActive ? "var(--accent-primary)" : "var(--border-secondary, #ddd)"}`,
    borderRadius: 4,
    background: isActive ? "rgba(59,130,246,0.04)" : "var(--surface-primary, #fff)",
    color: isActive ? "var(--accent-primary)" : "var(--text-primary)",
    outline: "none",
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
        <button type="button" onClick={() => router.push("/tarifs")} className="admin-btn admin-btn-secondary" style={{ padding: "4px 12px" }}>←</button>
        <h1 className="admin-page-title" style={{ margin: 0 }}>{center.name}</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
        {center.address}{center.manager ? ` · ${fr ? "Responsable" : "Manager"}: ${center.manager}` : ""}{center.phone ? ` · ${center.phone}` : ""}
      </p>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
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

      {/* Bulk actions bar */}
      {selectedTiers.size > 0 && (
        <div style={{
          padding: "12px 16px",
          marginBottom: 20,
          borderRadius: 8,
          background: "var(--surface-highlight, rgba(59,130,246,0.06))",
          border: "1px solid var(--accent-primary)",
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

          {/* Column selector */}
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginRight: 8 }}>
              {fr ? "Colonnes cibles :" : "Target columns:"}
            </span>
            {priceFields.map((pf) => (
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
        </div>
      )}

      {/* Per-floor sections */}
      {floors.map((floor) => {
        const floorTiers = tiersByFloor[floor] || [];
        const floorSelected = floorTiers.every((t) => selectedTiers.has(t.id));

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

            <div className="admin-placeholder-card" style={{ padding: 0, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-primary)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 36 }}>
                      <input type="checkbox" checked={floorSelected} onChange={() => handleSelectFloor(floor)} />
                    </th>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>{fr ? "Taille" : "Size"}</th>
                    {priceFields.map((pf) => (
                      <th key={pf.key} style={{ padding: "10px 12px", textAlign: "center" }} title={pf.label}>
                        <div style={{ fontSize: 12 }}>{pf.short}</div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary, #999)", fontWeight: 400 }}>{fr ? "dispo" : "avail"}</div>
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
                    const activeField = getActivePriceField(tier);
                    const days = daysSince(tier.lastPriceChangeDate);

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
                        {priceFields.map((pf) => {
                          const isActive = pf.key === activeField;
                          const original = tier[pf.key] as number;

                          return (
                            <td key={pf.key} style={{ padding: "6px 8px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <input
                                  type="number"
                                  value={getCellValue(tier.id, pf.key, original)}
                                  onChange={(e) => handleCellChange(tier.id, pf.key, e.target.value)}
                                  onBlur={() => handleCellBlur(tier.id, pf.key)}
                                  onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                  style={inputStyle(isActive)}
                                />
                                <span style={{ fontSize: 11, color: "var(--text-tertiary, #999)" }}>€</span>
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
                        <td style={{ padding: "6px 12px", textAlign: "center", fontSize: 12, color: dayColor(days) }}>
                          {days === 0 ? (fr ? "Auj." : "Today") : `${days}j`}
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
          ? "Les prix sont modifiables directement dans les champs. Le prix actif (bordure bleue) dépend du nombre de boxes disponibles. Sélectionnez des lignes pour appliquer des modifications en masse sur les colonnes de votre choix."
          : "Prices are editable directly in the fields. The active price (blue border) depends on availability. Select rows to apply bulk changes to chosen columns."}
      </p>
    </div>
  );
}
