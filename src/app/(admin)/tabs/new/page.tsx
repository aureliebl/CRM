"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { IconPickerModal } from "@/components/admin/IconPickerModal";
import { ColumnConfigModal } from "@/components/admin/ColumnConfigModal";
import { AsyncButton } from "@/components/admin/AsyncButton";
import { APP_MATERIAL_SYMBOLS } from "@/lib/material-symbols";
import { useLocale } from "@/lib/use-locale";
import { getCurrentUser } from "@/lib/mock/auth";
import type { DynamicTabConfig, DynamicTabColumnConfig, DynamicTabFieldFormat, DynamicTabSource, DynamicTabMultiJoinEntry, DynamicTabComputedColumn, UserGroup } from "@/lib/types";

const SOURCE_OPTIONS: Array<{ value: DynamicTabSource; label: string }> = [
  { value: "centers", label: "Centers" },
  { value: "clients", label: "Clients" },
  { value: "bookings", label: "Bookings" },
  { value: "external", label: "External" },
];

function toTitleLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferFormat(type: string): DynamicTabFieldFormat {
  const l = type.toLowerCase();
  if (l.includes("date") || l.includes("time") || l.includes("timestamp")) return "date";
  return "text";
}

type PreviewRow = Record<string, string | number | boolean | null | undefined> & { id: string };

export default function NewTabPage() {
  const { locale } = useLocale();
  const user = getCurrentUser();

  // ── Basic fields ─────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState<string>(APP_MATERIAL_SYMBOLS.navigation.components);
  const [source, setSource] = useState<DynamicTabSource>("centers");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // ── External connector ───────────────────────────────────────
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string; provider: "mock" | "bigquery"; enabled: boolean }>>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState("");
  const [externalTable, setExternalTable] = useState("");
  const [availableTables, setAvailableTables] = useState<Array<{ table: string; rowCount?: number }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  // ── Joins (multi) ─────────────────────────────────────────────
  const [joins, setJoins] = useState<Array<DynamicTabMultiJoinEntry & { _schema: Array<{ name: string; type: string }> }>>([]);
  const [joinAvailableTables, setJoinAvailableTables] = useState<Array<{ table: string; rowCount?: number }>>([]);

  // ── Columns ──────────────────────────────────────────────────
  const [columns, setColumns] = useState<DynamicTabColumnConfig[]>([]);
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);

  // ── Computed columns ─────────────────────────────────────────
  const [computedColumns, setComputedColumns] = useState<DynamicTabComputedColumn[]>([]);

  // ── Preview ──────────────────────────────────────────────────
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ── Groups & save ────────────────────────────────────────────
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ── Primary schema ───────────────────────────────────────────
  const [primarySchema, setPrimarySchema] = useState<Array<{ name: string; type: string }>>([]);

  const labels = locale === "fr"
    ? {
        title: "Créer un onglet",
        description: "Configurez la source, les colonnes, les jointures et l'affichage de votre onglet dynamique.",
        forbidden: "Seuls les admins peuvent créer des onglets.",
        titleLabel: "Titre", subtitleLabel: "Sous-titre", slugLabel: "Slug",
        iconLabel: "Icône de l'onglet", iconHelp: "Cliquez sur l'icône pour la changer.", iconPreview: "Aperçu",
        sourceLabel: "Source", connectorLabel: "Connecteur",
        externalTableLabel: "Table principale",
        loadingTables: "Chargement...", selectTable: "Sélectionner une table",
        externalRequired: "Sélectionnez un connecteur et une table",
        joinLabel: "Jointures", joinTableLabel: "Table à joindre",
        joinLeftLabel: "Clé table principale", joinRightLabel: "Clé table jointe",
        joinColumnsLabel: "Colonnes à afficher depuis la jointure",
        addJoin: "Ajouter une jointure", removeJoin: "Retirer",
        visibilityLabel: "Groupes autorisés",
        submit: "Créer l'onglet", saving: "Création...", success: "Onglet créé", error: "Erreur lors de la création",
        columnsTitle: "Colonnes", preview: "Aperçu des données", loadPreview: "Charger l'aperçu",
        column: "Colonne source", displayName: "Nom affiché", format: "Format",
        configure: "Configurer", remove: "Retirer",
        noColumns: "Aucune colonne. Sélectionnez une source/table.",
        noPreview: "Cliquez sur « Charger l'aperçu » pour voir les données.",
        computedTitle: "Champs calculés",
        addComputed: "Ajouter un champ",
        computedName: "Nom",
        computedFormula: "Formule",
        computedFormat: "Format",
        computedHelp: "Syntaxe : colonnes, +, -, *, /, %, CONCAT(), ROUND(), IF(cond, alors, sinon), ABS(), MIN(), MAX()",
        noComputed: "Aucun champ calculé.",
      }
    : {
        title: "Create tab",
        description: "Configure the source, columns, joins and display for your dynamic tab.",
        forbidden: "Only admins can create tabs.",
        titleLabel: "Title", subtitleLabel: "Subtitle", slugLabel: "Slug",
        iconLabel: "Tab icon", iconHelp: "Click the icon to change it.", iconPreview: "Preview",
        sourceLabel: "Source", connectorLabel: "Connector",
        externalTableLabel: "Primary table",
        loadingTables: "Loading...", selectTable: "Select a table",
        externalRequired: "Select a connector and an external table",
        joinLabel: "Joins", joinTableLabel: "Join table",
        joinLeftLabel: "Primary table key", joinRightLabel: "Join table key",
        joinColumnsLabel: "Columns to display from join",
        addJoin: "Add join", removeJoin: "Remove",
        visibilityLabel: "Allowed groups",
        submit: "Create tab", saving: "Creating...", success: "Tab created", error: "Failed to create tab",
        columnsTitle: "Columns", preview: "Data preview", loadPreview: "Load preview",
        column: "Source column", displayName: "Display name", format: "Format",
        configure: "Configure", remove: "Remove",
        noColumns: "No columns. Select a source/table.",
        noPreview: "Click \"Load preview\" to see data.",
        computedTitle: "Computed fields",
        addComputed: "Add field",
        computedName: "Name",
        computedFormula: "Formula",
        computedFormat: "Format",
        computedHelp: "Syntax: columns, +, -, *, /, %, CONCAT(), ROUND(), IF(cond, then, else), ABS(), MIN(), MAX()",
        noComputed: "No computed fields.",
      };

  /* ═══ Effects ═══ */

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(`/api/security/groups?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
        if (res.ok) setGroups(await res.json());
      } catch { /* ignore */ }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(`/api/connectors?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setConnectors(data.filter((c: { enabled: boolean }) => c.enabled));
        }
      } catch { setConnectors([]); }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (source !== "external" || selectedConnectorId || connectors.length === 0) return;
    setSelectedConnectorId(connectors[0].id);
  }, [source, selectedConnectorId, connectors]);

  const loadTablesForConnector = useCallback(async (connectorId: string) => {
    if (!user || !connectorId) { setAvailableTables([]); return; }
    setLoadingTables(true);
    try {
      const res = await fetch(
        `/api/connectors/tables?userId=${encodeURIComponent(user.id)}&connectorId=${encodeURIComponent(connectorId)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableTables(data.tables ?? []);
        setJoinAvailableTables(data.tables ?? []);
      } else { setAvailableTables([]); }
    } finally { setLoadingTables(false); }
  }, [user]);

  useEffect(() => {
    if (source !== "external" || !selectedConnectorId) return;
    loadTablesForConnector(selectedConnectorId);
  }, [source, selectedConnectorId, loadTablesForConnector]);

  // Import schema when primary table changes
  useEffect(() => {
    if (source !== "external" || !selectedConnectorId || !externalTable) {
      if (source === "external") { setColumns([]); setPrimarySchema([]); }
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/connectors/schema?userId=${encodeURIComponent(user!.id)}&connectorId=${encodeURIComponent(selectedConnectorId)}&table=${encodeURIComponent(externalTable)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = await res.json();
          const schema: Array<{ name: string; type: string }> = data.columns ?? [];
          setPrimarySchema(schema);
          setColumns(schema.map((c) => ({
            key: c.name, sourceField: c.name, label: toTitleLabel(c.name),
            format: inferFormat(c.type), filterType: "text" as const,
          })));
        }
      } catch { /* ignore */ }
    })();
  }, [source, selectedConnectorId, externalTable, user?.id]);

  // Built-in source columns
  useEffect(() => {
    if (source === "external") return;
    const builtinColumns: Record<string, DynamicTabColumnConfig[]> = {
      centers: [
        { key: "name", sourceField: "name", label: "Center", format: "text", filterType: "text" },
        { key: "city", sourceField: "city", label: "City", format: "text", filterType: "text" },
        { key: "code", sourceField: "code", label: "Code", format: "text", filterType: "text" },
      ],
      clients: [
        { key: "fullName", sourceField: "fullName", label: "Client", format: "text", filterType: "text" },
        { key: "email", sourceField: "email", label: "Email", format: "text", filterType: "text" },
        { key: "status", sourceField: "status", label: "Status", format: "status-pill", filterType: "select",
          options: [
            { value: "active", label: "Active", color: "#16a34a" },
            { value: "lead", label: "Lead", color: "#f59e0b" },
            { value: "churned", label: "Churned", color: "#ef4444" },
          ] },
      ],
      bookings: [
        { key: "id", sourceField: "id", label: "Booking", format: "text", filterType: "text" },
        { key: "createdAt", sourceField: "createdAt", label: "Date", format: "date", filterType: "text" },
        { key: "status", sourceField: "status", label: "Status", format: "status-pill", filterType: "select",
          options: [
            { value: "confirmed", label: "Confirmed", color: "#16a34a" },
            { value: "new", label: "New", color: "#2563eb" },
            { value: "expired", label: "Expired", color: "#f59e0b" },
            { value: "cancelled", label: "Cancelled", color: "#ef4444" },
          ] },
        { key: "amount", sourceField: "amount", label: "Amount", format: "currency", filterType: "text" },
      ],
    };
    setColumns(builtinColumns[source] ?? []);
    setPrimarySchema([]);
  }, [source]);

  // Load schema for a join entry
  const loadJoinSchema = useCallback(async (table: string): Promise<Array<{ name: string; type: string }>> => {
    if (source === "external" && selectedConnectorId) {
      try {
        const res = await fetch(
          `/api/connectors/schema?userId=${encodeURIComponent(user!.id)}&connectorId=${encodeURIComponent(selectedConnectorId)}&table=${encodeURIComponent(table)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = await res.json();
          return data.columns ?? [];
        }
      } catch { /* ignore */ }
      return [];
    }
    const builtinFields: Record<string, string[]> = {
      clients: ["id", "fullName", "email", "phone", "status", "createdAt", "segment"],
      centers: ["id", "name", "city", "code", "isKostokOwned"],
      bookings: ["id", "clientId", "centerId", "status", "createdAt", "amount", "channel"],
    };
    return (builtinFields[table] ?? []).map((n) => ({ name: n, type: "STRING" }));
  }, [source, selectedConnectorId, user?.id]);

  /* ═══ Build config ═══ */

  const buildConfig = useCallback((): DynamicTabConfig => {
    // Add columns from each join
    const joinCols: DynamicTabColumnConfig[] = [];
    for (const j of joins) {
      const prefix = `j${j.id}_`;
      for (const colName of j.columns) {
        joinCols.push({
          key: `${prefix}${colName}`, sourceField: `${prefix}${colName}`, label: `${toTitleLabel(j.table)}.${toTitleLabel(colName)}`,
          format: "text" as const, filterType: "text" as const,
        });
      }
    }

    const config: DynamicTabConfig = {
      source, columns: [...columns, ...joinCols],
      rowNavigation: { enabled: true, idField: "id", hrefBasePath: source === "external" ? "/" : `/${source}` },
    };
    if (source === "external") { config.connectorId = selectedConnectorId; config.externalTable = externalTable; }
    if (joins.length > 0) {
      config.joins = joins.map((j) => ({ id: j.id, table: j.table, leftKey: j.leftKey, rightKey: j.rightKey, columns: j.columns }));
    }
    if (computedColumns.length > 0) {
      config.computedColumns = computedColumns;
    }
    return config;
  }, [source, columns, selectedConnectorId, externalTable, joins, computedColumns]);

  /* ═══ Preview ═══ */

  const loadPreview = useCallback(async () => {
    if (!user) return;
    setLoadingPreview(true); setPreviewError(null);
    try {
      const config = buildConfig();
      const res = await fetch(`/api/tabs/preview?userId=${encodeURIComponent(user.id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPreviewError(err.error ?? labels.error); setPreviewRows([]); return;
      }
      const data = await res.json();
      setPreviewRows(data.rows ?? []);
      setPreviewLoaded(true);
      setTimeout(() => setPreviewLoaded(false), 900);
    } catch (e) { setPreviewError(String(e)); } finally { setLoadingPreview(false); }
  }, [user, buildConfig, labels.error]);

  const normalizedSlug = useMemo(
    () => slug.trim().toLowerCase().replace(/[^a-z0-9-\s]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-"),
    [slug],
  );

  /* ═══ Create ═══ */

  const handleCreate = async () => {
    if (!user || !title.trim() || !normalizedSlug) return;
    if (source === "external" && (!selectedConnectorId || !externalTable.trim())) {
      setMessage(labels.externalRequired); return;
    }
    const config = buildConfig();
    setSaving(true); setMessage(null);
    try {
      const res = await fetch(`/api/tabs?userId=${encodeURIComponent(user.id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: normalizedSlug, title: title.trim(), subtitle: subtitle.trim() || undefined, icon: icon.trim() || undefined, config, groupIds: selectedGroupIds }),
      });
      if (!res.ok) { setMessage(labels.error); return; }
      setTitle(""); setSubtitle(""); setSlug(""); setIcon(APP_MATERIAL_SYMBOLS.navigation.components);
      setSelectedConnectorId(""); setExternalTable(""); setAvailableTables([]);
      setSelectedGroupIds([]); setColumns([]); setPreviewRows([]); setJoins([]);
      setMessage(labels.success); window.dispatchEvent(new Event("tabs:refresh"));
      setSaved(true);
      setTimeout(() => setSaved(false), 900);
    } finally { setSaving(false); }
  };

  /* ═══ Column helpers ═══ */

  const removeColumn = (i: number) => setColumns((p) => p.filter((_, idx) => idx !== i));
  const updateColumn = (i: number, u: DynamicTabColumnConfig) => setColumns((p) => p.map((c, idx) => idx === i ? u : c));

  const getDistinctValues = (key: string): string[] => {
    const s = new Set<string>();
    for (const r of previewRows) { const v = r[key]; if (v != null && v !== "") s.add(String(v)); if (s.size > 30) break; }
    return Array.from(s);
  };

  const renderCell = (col: DynamicTabColumnConfig, value: unknown) => {
    if (value == null || value === "") return "-";
    if (col.format === "date") {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }
    if (col.format === "currency") {
      const n = Number(value);
      return Number.isNaN(n) ? String(value) : n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
    }
    if (col.format === "number") {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      const opts = col.formatOptions;
      let result = n;
      if (opts?.rounding === "floor") result = Math.floor(result * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0);
      else if (opts?.rounding === "ceil") result = Math.ceil(result * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0);
      const formatted = result.toLocaleString("fr-FR", { minimumFractionDigits: opts?.decimals ?? 0, maximumFractionDigits: opts?.decimals ?? 2 });
      return `${opts?.prefix ?? ""}${formatted}${opts?.suffix ?? ""}`;
    }
    if (col.format === "status-pill") {
      const raw = String(value); const opt = col.options?.find((o) => o.value === raw);
      const lbl = opt?.label ?? raw; const color = opt?.color ?? "#64748b";
      return <span style={{ display: "inline-flex", alignItems: "center", padding: "0.15rem 0.5rem", borderRadius: "999px", background: `${color}22`, color, border: `1px solid ${color}66`, fontSize: "0.75rem", fontWeight: 600 }}>{lbl}</span>;
    }
    return String(value);
  };

  /* ═══ Join options ═══ */

  const joinTableOptions = useMemo(() => {
    if (source === "external") return joinAvailableTables.filter((t) => t.table !== externalTable).map((t) => ({ value: t.table, label: t.table }));
    return ["clients", "centers", "bookings"].filter((s) => s !== source).map((s) => ({ value: s, label: toTitleLabel(s) }));
  }, [source, externalTable, joinAvailableTables]);

  const primaryColumnOptions = useMemo(() => {
    if (primarySchema.length > 0) return primarySchema.map((c) => c.name);
    return columns.map((c) => c.sourceField);
  }, [primarySchema, columns]);

  /* ═══ Guard ═══ */

  if (user?.role !== "admin") {
    return <div><h1 className="admin-page-title">{labels.title}</h1><p className="admin-page-description">{labels.forbidden}</p></div>;
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.45rem 0.65rem", borderRadius: "0.45rem",
    border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)",
  };

  return (
    <div>
      <h1 className="admin-page-title">{labels.title}</h1>
      <p className="admin-page-description">{labels.description}</p>

      {/* ═══ SECTION 1 – Config ═══ */}
      <section className="admin-placeholder-card">
        <div className="admin-placeholder-title">Configuration</div>
        <div style={{ display: "grid", gap: "0.7rem", maxWidth: "780px", marginTop: "0.5rem" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}><span>{labels.titleLabel}</span><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: "0.25rem" }}><span>{labels.subtitleLabel}</span><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: "0.25rem" }}><span>{labels.slugLabel}</span><input value={slug} onChange={(e) => setSlug(e.target.value)} style={inputStyle} /><span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>/tabs/{normalizedSlug || "..."}</span></label>

          {/* Icon */}
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span>{labels.iconLabel}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <button type="button" onClick={() => setIconPickerOpen(true)} style={{ width: "2.4rem", height: "2.4rem", borderRadius: "0.45rem", border: "1px solid var(--border-color)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--button-bg)", cursor: "pointer", color: "var(--text-primary)", appearance: "none" as const }} title={labels.iconPreview}>
                <MaterialSymbol name={icon.trim() || APP_MATERIAL_SYMBOLS.navigation.components} size={22} weight={500} opticalSize={24} />
              </button>
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{icon || "—"}</span>
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{labels.iconHelp}</span>
            <IconPickerModal isOpen={iconPickerOpen} currentIcon={icon} onSelect={(n) => setIcon(n)} onClose={() => setIconPickerOpen(false)} />
          </div>

          {/* Source */}
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>{labels.sourceLabel}</span>
            <select value={source} onChange={(e) => { setSource(e.target.value as DynamicTabSource); setJoins([]); setExternalTable(""); setPreviewRows([]); }} style={inputStyle}>
              {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* External */}
          {source === "external" && (
            <>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>{labels.connectorLabel}</span>
                <select value={selectedConnectorId} onChange={(e) => { setSelectedConnectorId(e.target.value); setExternalTable(""); }} style={inputStyle}>
                  <option value="">{labels.connectorLabel}</option>
                  {connectors.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>{labels.externalTableLabel}</span>
                <select value={externalTable} onChange={(e) => setExternalTable(e.target.value)} style={inputStyle}>
                  <option value="">{loadingTables ? labels.loadingTables : labels.selectTable}</option>
                  {availableTables.map((t) => <option key={t.table} value={t.table}>{t.table}{t.rowCount !== undefined ? ` (${t.rowCount})` : ""}</option>)}
                </select>
              </label>
            </>
          )}

          {/* Groups */}
          <fieldset style={{ display: "grid", gap: "0.35rem", border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 500, marginBottom: "0.15rem" }}>{labels.visibilityLabel}</legend>
            {groups.length === 0 && <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>—</span>}
            {groups.map((g) => (
              <label key={g.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.3rem 0.5rem", borderRadius: "0.4rem", cursor: "pointer", fontSize: "0.85rem", border: selectedGroupIds.includes(g.id) ? "1px solid var(--border-hover)" : "1px solid var(--border-color)", background: selectedGroupIds.includes(g.id) ? "rgba(14,165,233,0.06)" : "transparent" }}>
                <input type="checkbox" checked={selectedGroupIds.includes(g.id)} onChange={(e) => setSelectedGroupIds((p) => e.target.checked ? [...p, g.id] : p.filter((x) => x !== g.id))} />
                {g.name}
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      {/* ═══ SECTION 2 – Joins (multi) ═══ */}
      <section className="admin-placeholder-card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <div className="admin-placeholder-title">{labels.joinLabel}</div>
          <button type="button" onClick={async () => {
            const id = `j${Date.now()}`;
            setJoins((p) => [...p, { id, table: "", leftKey: "", rightKey: "", columns: [], _schema: [] }]);
          }} style={{ padding: "0.35rem 0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.78rem" }}>
            + {labels.addJoin}
          </button>
        </div>
        <div style={{ display: "grid", gap: "0.75rem", maxWidth: "780px", marginTop: "0.5rem" }}>
          {joins.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: 0 }}>{locale === "fr" ? "Aucune jointure. Cliquez « Ajouter une jointure » pour relier des tables." : "No joins. Click \"Add join\" to link tables."}</p>}
          {joins.map((j, ji) => (
            <div key={j.id} style={{ border: "1px solid var(--border-color)", borderRadius: "0.5rem", padding: "0.65rem", display: "grid", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)" }}>
                  {locale === "fr" ? `Jointure ${ji + 1}` : `Join ${ji + 1}`}
                  {j.table ? ` → ${j.table}` : ""}
                </span>
                <button type="button" onClick={() => setJoins((p) => p.filter((_, i) => i !== ji))} style={{ padding: "0.2rem 0.45rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem" }}>{labels.removeJoin}</button>
              </div>
              <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.78rem" }}>{labels.joinTableLabel}</span>
                  <select value={j.table} onChange={async (e) => {
                    const table = e.target.value;
                    const schema = table ? await loadJoinSchema(table) : [];
                    setJoins((p) => p.map((x, i) => i === ji ? { ...x, table, _schema: schema, columns: [], rightKey: "" } : x));
                  }} style={inputStyle}>
                    <option value="">{labels.selectTable}</option>
                    {joinTableOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.78rem" }}>{labels.joinLeftLabel}</span>
                  <select value={j.leftKey} onChange={(e) => setJoins((p) => p.map((x, i) => i === ji ? { ...x, leftKey: e.target.value } : x))} style={inputStyle}>
                    <option value="">—</option>
                    {/* Primary columns + columns from previous joins */}
                    {primaryColumnOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    {joins.slice(0, ji).flatMap((prev) => prev._schema.map((col) => {
                      const k = `j${prev.id}_${col.name}`;
                      return <option key={k} value={k}>{prev.table}.{col.name}</option>;
                    }))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.78rem" }}>{labels.joinRightLabel}</span>
                  <select value={j.rightKey} onChange={(e) => setJoins((p) => p.map((x, i) => i === ji ? { ...x, rightKey: e.target.value } : x))} style={inputStyle}>
                    <option value="">—</option>
                    {j._schema.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              {j._schema.length > 0 && (
                <fieldset style={{ display: "grid", gap: "0.3rem", border: "none", padding: 0, margin: 0 }}>
                  <legend style={{ fontWeight: 500, fontSize: "0.78rem", marginBottom: "0.1rem" }}>{labels.joinColumnsLabel}</legend>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {j._schema.map((c) => (
                      <label key={c.name} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.4rem", borderRadius: "0.35rem", fontSize: "0.75rem", cursor: "pointer", border: j.columns.includes(c.name) ? "1px solid var(--border-hover)" : "1px solid var(--border-color)", background: j.columns.includes(c.name) ? "rgba(14,165,233,0.06)" : "transparent" }}>
                        <input type="checkbox" checked={j.columns.includes(c.name)} onChange={(e) => setJoins((p) => p.map((x, i) => i === ji ? { ...x, columns: e.target.checked ? [...x.columns, c.name] : x.columns.filter((v) => v !== c.name) } : x))} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 3 – Columns ═══ */}
      <section className="admin-placeholder-card" style={{ marginTop: "1rem" }}>
        <div className="admin-placeholder-title">{labels.columnsTitle}</div>
        <div style={{ marginTop: "0.5rem" }}>
          {columns.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>{labels.noColumns}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)" }}>{labels.column}</th>
                    <th style={{ padding: "0.5rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)" }}>{labels.displayName}</th>
                    <th style={{ padding: "0.5rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)" }}>{labels.format}</th>
                    <th style={{ padding: "0.5rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, idx) => (
                    <tr key={col.key} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "0.45rem 0.5rem", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: "0.78rem" }}>{col.sourceField}</td>
                      <td style={{ padding: "0.45rem 0.5rem" }}>
                        {col.label}
                        {col.format === "status-pill" && col.options && (
                          <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                            {col.options.slice(0, 4).map((o, i) => <span key={i} style={{ display: "inline-flex", padding: "0.1rem 0.35rem", borderRadius: "999px", background: `${o.color}22`, color: o.color, border: `1px solid ${o.color}66`, fontSize: "0.65rem", fontWeight: 600 }}>{o.label}</span>)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.45rem 0.5rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>{col.format}</td>
                      <td style={{ padding: "0.45rem 0.5rem", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                          <button type="button" onClick={() => setEditingColumnIndex(idx)} style={{ padding: "0.25rem 0.5rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.75rem" }}>{labels.configure}</button>
                          <button type="button" onClick={() => removeColumn(idx)} style={{ padding: "0.25rem 0.5rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem" }}>{labels.remove}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ═══ SECTION 3b – Computed fields ═══ */}
      <section className="admin-placeholder-card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <div className="admin-placeholder-title">{labels.computedTitle}</div>
          <button type="button" onClick={() => setComputedColumns((p) => [...p, { id: `c${Date.now()}`, name: "", expression: "", format: "number" }])} style={{ padding: "0.35rem 0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.78rem" }}>
            + {labels.addComputed}
          </button>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.72rem", margin: "0.3rem 0 0.5rem" }}>{labels.computedHelp}</p>
        <div style={{ display: "grid", gap: "0.6rem", maxWidth: "780px" }}>
          {computedColumns.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: 0 }}>{labels.noComputed}</p>}
          {computedColumns.map((comp, ci) => (
            <div key={comp.id} style={{ border: "1px solid var(--border-color)", borderRadius: "0.5rem", padding: "0.65rem", display: "grid", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)" }}>
                  {comp.name || `${labels.computedName} ${ci + 1}`}
                </span>
                <button type="button" onClick={() => setComputedColumns((p) => p.filter((_, i) => i !== ci))} style={{ padding: "0.2rem 0.45rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem" }}>{labels.remove}</button>
              </div>
              <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 2fr auto" }}>
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.78rem" }}>{labels.computedName}</span>
                  <input value={comp.name} onChange={(e) => setComputedColumns((p) => p.map((x, i) => i === ci ? { ...x, name: e.target.value } : x))} style={inputStyle} placeholder="ex: marge_pct" />
                </label>
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.78rem" }}>{labels.computedFormula}</span>
                  <input value={comp.expression} onChange={(e) => setComputedColumns((p) => p.map((x, i) => i === ci ? { ...x, expression: e.target.value } : x))} style={{ ...inputStyle, fontFamily: "monospace", fontSize: "0.8rem" }} placeholder="ex: (price - cost) / price * 100" />
                </label>
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.78rem" }}>{labels.computedFormat}</span>
                  <select value={comp.format ?? "number"} onChange={(e) => setComputedColumns((p) => p.map((x, i) => i === ci ? { ...x, format: e.target.value as DynamicTabFieldFormat } : x))} style={inputStyle}>
                    <option value="number">Nombre</option>
                    <option value="text">Texte</option>
                    <option value="currency">Monnaie (€)</option>
                  </select>
                </label>
              </div>
              {(comp.format === "number" || comp.format === "currency") && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}>
                  <label style={{ display: "grid", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Décimales</span>
                    <input type="number" min={0} max={10} value={comp.formatOptions?.decimals ?? 2} onChange={(e) => setComputedColumns((p) => p.map((x, i) => i === ci ? { ...x, formatOptions: { ...x.formatOptions, decimals: Number(e.target.value) } } : x))} style={{ ...inputStyle, width: "70px" }} />
                  </label>
                  <label style={{ display: "grid", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Arrondi</span>
                    <select value={comp.formatOptions?.rounding ?? "round"} onChange={(e) => setComputedColumns((p) => p.map((x, i) => i === ci ? { ...x, formatOptions: { ...x.formatOptions, rounding: e.target.value as "round" | "floor" | "ceil" } } : x))} style={{ ...inputStyle, width: "90px" }}>
                      <option value="round">Round</option>
                      <option value="floor">Floor</option>
                      <option value="ceil">Ceil</option>
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Préfixe</span>
                    <input value={comp.formatOptions?.prefix ?? ""} onChange={(e) => setComputedColumns((p) => p.map((x, i) => i === ci ? { ...x, formatOptions: { ...x.formatOptions, prefix: e.target.value } } : x))} style={{ ...inputStyle, width: "60px" }} placeholder="" />
                  </label>
                  <label style={{ display: "grid", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Suffixe</span>
                    <input value={comp.formatOptions?.suffix ?? ""} onChange={(e) => setComputedColumns((p) => p.map((x, i) => i === ci ? { ...x, formatOptions: { ...x.formatOptions, suffix: e.target.value } } : x))} style={{ ...inputStyle, width: "60px" }} placeholder="ex: %" />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 4 – Preview ═══ */}
      <section className="admin-placeholder-card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <div className="admin-placeholder-title">{labels.preview}</div>
          <AsyncButton
            type="button"
            onClick={loadPreview}
            disabled={columns.length === 0}
            isLoading={loadingPreview}
            isSuccess={previewLoaded}
            loadingLabel={labels.loadPreview}
            successLabel={labels.loadPreview}
            minWidth={160}
          >
            {labels.loadPreview}
          </AsyncButton>
        </div>
        {previewError && <p style={{ color: "#ef4444", fontSize: "0.82rem", marginTop: "0.4rem" }}>{previewError}</p>}
        {previewRows.length === 0 && !previewError && <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.4rem" }}>{labels.noPreview}</p>}
        {previewRows.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", tableLayout: "fixed", minWidth: (columns.length + computedColumns.length) > 4 ? `${(columns.length + computedColumns.length) * 140}px` : undefined }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {columns.map((c) => (
                    <th key={c.key} style={{ padding: "0.55rem 0.5rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", lineHeight: "1.3" }}>{c.label}</span>
                    </th>
                  ))}
                  {computedColumns.map((comp) => (
                    <th key={comp.id} style={{ padding: "0.55rem 0.5rem", textAlign: "left", fontWeight: 600, color: "#8b5cf6", fontSize: "0.75rem" }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", lineHeight: "1.3" }}>{comp.name || "—"} <span style={{ fontSize: "0.65rem", fontWeight: 400 }}>ƒ</span></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 15).map((row, ri) => (
                  <tr key={row.id ?? ri} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    {columns.map((c) => (
                      <td key={c.key} style={{ padding: "0.5rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {renderCell(c, row[c.key])}
                      </td>
                    ))}
                    {computedColumns.map((comp) => {
                      const key = `_computed_${comp.id}`;
                      const pseudoCol: DynamicTabColumnConfig = { key, sourceField: key, label: comp.name, format: comp.format ?? "number", formatOptions: comp.formatOptions };
                      return (
                        <td key={comp.id} style={{ padding: "0.5rem", color: "#8b5cf6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {renderCell(pseudoCol, row[key])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.4rem" }}>{previewRows.length} ligne{previewRows.length !== 1 ? "s" : ""} (max 50)</div>
          </div>
        )}
      </section>

      {/* ═══ CREATE ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1rem" }}>
        <AsyncButton
          type="button"
          onClick={handleCreate}
          disabled={!title.trim() || !normalizedSlug}
          isLoading={saving}
          isSuccess={saved}
          loadingLabel={labels.saving}
          successLabel={labels.submit}
          minWidth={150}
        >
          {labels.submit}
        </AsyncButton>
        {message && <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>{message}</span>}
      </div>

      {/* ═══ COLUMN CONFIG MODAL ═══ */}
      {editingColumnIndex !== null && columns[editingColumnIndex] && (
        <ColumnConfigModal isOpen column={columns[editingColumnIndex]} distinctValues={getDistinctValues(columns[editingColumnIndex].key)} onSave={(u) => updateColumn(editingColumnIndex, u)} onClose={() => setEditingColumnIndex(null)} />
      )}
    </div>
  );
}
