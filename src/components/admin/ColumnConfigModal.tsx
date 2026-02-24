"use client";

import { useState, useEffect } from "react";
import type { DynamicTabColumnConfig, DynamicTabFieldFormat, DynamicTabPillOption, DynamicTabFormatOptions } from "@/lib/types";

interface ColumnConfigModalProps {
  isOpen: boolean;
  column: DynamicTabColumnConfig;
  /** Distinct values found for this column in the preview data (for pill config) */
  distinctValues: string[];
  onSave: (updated: DynamicTabColumnConfig) => void;
  onClose: () => void;
}

const FORMAT_OPTIONS: Array<{ value: DynamicTabFieldFormat; label: string }> = [
  { value: "text", label: "Texte" },
  { value: "date", label: "Date" },
  { value: "currency", label: "Monnaie (€)" },
  { value: "number", label: "Nombre" },
  { value: "status-pill", label: "Pillule (couleur)" },
];

const PRESET_COLORS = [
  "#16a34a", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#0ea5e9", "#64748b", "#f97316", "#14b8a6",
];

export function ColumnConfigModal({ isOpen, column, distinctValues, onSave, onClose }: ColumnConfigModalProps) {
  const [label, setLabel] = useState(column.label);
  const [format, setFormat] = useState<DynamicTabFieldFormat>(column.format);
  const [filterType, setFilterType] = useState<"text" | "select" | "date" | "number" | "none">(column.filterType ?? "text");
  const [pillOptions, setPillOptions] = useState<DynamicTabPillOption[]>(column.options ?? []);
  const [formatOptions, setFormatOptions] = useState<DynamicTabFormatOptions>(column.formatOptions ?? {});

  useEffect(() => {
    if (!isOpen) return;
    setLabel(column.label);
    setFormat(column.format);
    setFilterType(column.filterType ?? "text");
    setPillOptions(column.options ?? []);
    setFormatOptions(column.formatOptions ?? {});
  }, [isOpen, column]);

  // When switching to pill mode, pre-fill options from distinct values
  useEffect(() => {
    if (format !== "status-pill") return;
    if (pillOptions.length > 0) return;
    const newOptions: DynamicTabPillOption[] = distinctValues.slice(0, 20).map((val, i) => ({
      value: val,
      label: val,
      color: PRESET_COLORS[i % PRESET_COLORS.length],
    }));
    setPillOptions(newOptions);
  }, [format, distinctValues, pillOptions.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleSave = () => {
    onSave({
      ...column,
      label,
      format,
      filterType: format === "status-pill" ? "select" : filterType,
      options: format === "status-pill" ? pillOptions : undefined,
      formatOptions: (format === "number" || format === "currency") ? formatOptions : undefined,
    });
    onClose();
  };

  const updatePillOption = (index: number, patch: Partial<DynamicTabPillOption>) => {
    setPillOptions((prev) => prev.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)));
  };

  const removePillOption = (index: number) => {
    setPillOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const addPillOption = () => {
    setPillOptions((prev) => [
      ...prev,
      { value: "", label: "", color: PRESET_COLORS[prev.length % PRESET_COLORS.length] },
    ]);
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    padding: "0.4rem 0.55rem",
    borderRadius: "0.4rem",
    border: "1px solid var(--border-color)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: "0.82rem",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--card-bg, #1e1e2e)",
          border: "1px solid var(--border-color)",
          borderRadius: "0.75rem",
          width: "min(560px, 92vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.85rem 1rem",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
            Configuration de la colonne : {column.sourceField}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              color: "var(--text-primary)",
              cursor: "pointer",
              padding: "0.2rem",
              fontSize: "1.1rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1rem", overflowY: "auto", display: "grid", gap: "0.75rem" }}>
          {/* Label */}
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 500 }}>Nom affiché</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} />
          </label>

          {/* Format */}
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 500 }}>Format d&apos;affichage</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as DynamicTabFieldFormat)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {/* Filter type (only if not pill) */}
          {format !== "status-pill" && (
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 500 }}>Type de filtre</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "text" | "select" | "date" | "number" | "none")}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="text">Texte</option>
                <option value="select">Sélection</option>
                <option value="date">Date</option>
                <option value="number">Nombre</option>
                <option value="none">Aucun</option>
              </select>
            </label>
          )}

          {/* Number / Currency format options */}
          {(format === "number" || format === "currency") && (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 500 }}>Options de formatage</span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <label style={{ display: "grid", gap: "0.15rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Décimales</span>
                  <input type="number" min={0} max={10} value={formatOptions.decimals ?? 2} onChange={(e) => setFormatOptions((p) => ({ ...p, decimals: Number(e.target.value) }))} style={{ ...inputStyle, width: "70px" }} />
                </label>
                <label style={{ display: "grid", gap: "0.15rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Arrondi</span>
                  <select value={formatOptions.rounding ?? "round"} onChange={(e) => setFormatOptions((p) => ({ ...p, rounding: e.target.value as "round" | "floor" | "ceil" }))} style={{ ...inputStyle, width: "90px", cursor: "pointer" }}>
                    <option value="round">Round</option>
                    <option value="floor">Floor</option>
                    <option value="ceil">Ceil</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: "0.15rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Préfixe</span>
                  <input value={formatOptions.prefix ?? ""} onChange={(e) => setFormatOptions((p) => ({ ...p, prefix: e.target.value }))} style={{ ...inputStyle, width: "70px" }} />
                </label>
                <label style={{ display: "grid", gap: "0.15rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Suffixe</span>
                  <input value={formatOptions.suffix ?? ""} onChange={(e) => setFormatOptions((p) => ({ ...p, suffix: e.target.value }))} style={{ ...inputStyle, width: "70px" }} placeholder="ex: %" />
                </label>
              </div>
            </div>
          )}

          {/* Pill options */}
          {format === "status-pill" && (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                Valeurs pillule ({pillOptions.length})
              </span>
              {pillOptions.map((opt, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 44px auto",
                    gap: "0.35rem",
                    alignItems: "center",
                  }}
                >
                  <input
                    value={opt.value}
                    onChange={(e) => updatePillOption(index, { value: e.target.value })}
                    placeholder="Valeur"
                    style={inputStyle}
                  />
                  <input
                    value={opt.label}
                    onChange={(e) => updatePillOption(index, { label: e.target.value })}
                    placeholder="Libellé"
                    style={inputStyle}
                  />
                  <input
                    type="color"
                    value={opt.color}
                    onChange={(e) => updatePillOption(index, { color: e.target.value })}
                    style={{
                      width: "36px",
                      height: "32px",
                      padding: "2px",
                      border: "1px solid var(--border-color)",
                      borderRadius: "0.3rem",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removePillOption(index)}
                    style={{
                      appearance: "none",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "1rem",
                      padding: "0.2rem",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPillOption}
                style={{
                  padding: "0.3rem 0.55rem",
                  borderRadius: "0.4rem",
                  border: "1px dashed var(--border-color)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  justifySelf: "start",
                }}
              >
                + Ajouter une valeur
              </button>

              {/* Preview of pills */}
              {pillOptions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Aperçu :</span>
                  {pillOptions.map((opt, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        background: `${opt.color}22`,
                        color: opt.color,
                        border: `1px solid ${opt.color}66`,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {opt.label || opt.value || "—"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0.75rem 1rem",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.4rem 0.7rem",
              borderRadius: "0.4rem",
              border: "1px solid var(--border-color)",
              background: "transparent",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "0.82rem",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: "0.4rem 0.7rem",
              borderRadius: "0.4rem",
              border: "1px solid var(--border-color)",
              background: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 500,
            }}
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
