"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { IconPickerModal } from "@/components/admin/IconPickerModal";
import { AsyncButton } from "@/components/admin/AsyncButton";
import { APP_MATERIAL_SYMBOLS } from "@/lib/material-symbols";
import type { DynamicTabColumnConfig, DynamicTabConfig, DynamicTabFieldFormat, DynamicTabRowActionConfig, DynamicTabComputedColumn, DynamicTabDetailSection, DynamicTabDetailSectionField } from "@/lib/types";

type SessionActor = {
  id: string;
  role: string;
};

function toTitleLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferFormat(type: string): DynamicTabFieldFormat {
  const lowered = type.toLowerCase();
  if (lowered.includes("date") || lowered.includes("time") || lowered.includes("timestamp")) {
    return "date";
  }
  return "text";
}

export default function EditTabPage({ params }: { params: Promise<{ tabSlug: string }> }) {
  const [tabId, setTabId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState<string>(APP_MATERIAL_SYMBOLS.navigation.components);
  const [draftConfig, setDraftConfig] = useState<DynamicTabConfig | null>(null);
  const [configText, setConfigText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string; provider: "mock" | "bigquery"; enabled: boolean }>>([]);
  const [availableTables, setAvailableTables] = useState<Array<{ table: string; rowCount?: number }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [importingSchema, setImportingSchema] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [tabUpdatedAt, setTabUpdatedAt] = useState("");
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadActor = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) {
          setActor(null);
          setAuthResolved(true);
          return;
        }

        const data = (await res.json()) as { authenticated?: boolean; user?: SessionActor };
        setActor(data?.authenticated ? data.user ?? null : null);
      } finally {
        setAuthResolved(true);
      }
    };

    loadActor();
  }, []);

  useEffect(() => {
    const load = async () => {
      const { tabSlug } = await params;
      if (!actor) return;

      setLoading(true);
      setMessage(null);

      try {
        const res = await fetch(`/api/tabs/slug/${encodeURIComponent(tabSlug)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          setMessage("Tab not found");
          return;
        }

        const tab = await res.json();
        setTabId(tab.id);
        setTitle(tab.title ?? "");
        setSubtitle(tab.subtitle ?? "");
        setSlug(tab.slug ?? "");
        setIcon(tab.icon ?? APP_MATERIAL_SYMBOLS.navigation.components);
        setDraftConfig(tab.config ?? null);
        setConfigText(JSON.stringify(tab.config ?? {}, null, 2));
        setTabUpdatedAt(String(tab.updatedAt ?? ""));
        if (Array.isArray(tab.groupIds)) {
          setSelectedGroupIds(tab.groupIds);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [actor?.id, params]);

  useEffect(() => {
    const loadConnectors = async () => {
      if (!actor) return;
      try {
        const res = await fetch(`/api/connectors`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setConnectors([]);
          return;
        }

        const data = (await res.json()) as Array<{
          id: string;
          name: string;
          provider: "mock" | "bigquery";
          enabled: boolean;
        }>;
        setConnectors(data.filter((connector) => connector.enabled));
      } catch {
        setConnectors([]);
      }
    };

    loadConnectors();
  }, [actor?.id]);

  useEffect(() => {
    const loadGroups = async () => {
      if (!actor) return;
      try {
        const res = await fetch(`/api/security/groups`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as Array<{ id: string; name: string }>;
        setGroups(data);
      } catch {
        // ignore
      }
    };
    loadGroups();
  }, [actor?.id]);

  const normalizedSlug = useMemo(
    () =>
      slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-\s]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-"),
    [slug]
  );

  if (!authResolved) {
    return <section className="admin-placeholder-card">Loading...</section>;
  }

  if (actor?.role !== "admin") {
    return (
      <section className="admin-placeholder-card">
        Only admins can edit tab configuration.
      </section>
    );
  }

  const syncConfigText = (next: DynamicTabConfig) => {
    setDraftConfig(next);
    setConfigText(JSON.stringify(next, null, 2));
  };

  const loadTablesForConnector = async (connectorId: string) => {
    if (!actor || !connectorId) {
      setAvailableTables([]);
      return;
    }

    setLoadingTables(true);
    try {
      const res = await fetch(`/api/connectors/tables?connectorId=${encodeURIComponent(connectorId)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        setAvailableTables([]);
        return;
      }

      const data = (await res.json()) as {
        tables?: Array<{ table: string; rowCount?: number }>;
      };
      setAvailableTables(data.tables ?? []);
    } finally {
      setLoadingTables(false);
    }
  };

  const importColumnsFromSchema = async () => {
    if (!actor || !draftConfig || draftConfig.source !== "external") return;
    if (!draftConfig.externalTable) {
      setMessage("Select an external table first");
      return;
    }

    setImportingSchema(true);
    setMessage(null);
    try {
      const connectorQuery = draftConfig.connectorId
        ? `&connectorId=${encodeURIComponent(draftConfig.connectorId)}`
        : "";
      const res = await fetch(`/api/connectors/schema?table=${encodeURIComponent(draftConfig.externalTable)}${connectorQuery}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        setMessage("Failed to load schema");
        return;
      }

      const data = (await res.json()) as {
        columns?: Array<{ name: string; type: string }>;
      };

      const columns = (data.columns ?? []).map((column) => ({
        key: column.name,
        sourceField: column.name,
        label: toTitleLabel(column.name),
        format: inferFormat(column.type),
        filterType: "text" as const,
      }));

      if (columns.length === 0) {
        setMessage("No schema columns found");
        return;
      }

      syncConfigText({
        ...draftConfig,
        columns,
      });
      setMessage(`Imported ${columns.length} column(s)`);
    } finally {
      setImportingSchema(false);
    }
  };

  useEffect(() => {
    if (!draftConfig || draftConfig.source !== "external") return;
    if (draftConfig.connectorId) {
      loadTablesForConnector(draftConfig.connectorId);
      return;
    }

    const preferredConnector = connectors[0];
    if (!preferredConnector) return;
    syncConfigText({ ...draftConfig, connectorId: preferredConnector.id });
  }, [draftConfig?.source, draftConfig?.connectorId, connectors]);

  const addColumn = () => {
    if (!draftConfig) return;
    const key = `column_${draftConfig.columns.length + 1}`;
    const nextColumn: DynamicTabColumnConfig = {
      key,
      sourceField: key,
      label: key,
      format: "text",
      filterType: "text",
    };
    syncConfigText({
      ...draftConfig,
      columns: [...draftConfig.columns, nextColumn],
    });
  };

  const updateColumn = (index: number, patch: Partial<DynamicTabColumnConfig>) => {
    if (!draftConfig) return;
    const nextColumns = draftConfig.columns.map((column, i) =>
      i === index ? { ...column, ...patch } : column
    );
    syncConfigText({ ...draftConfig, columns: nextColumns });
  };

  const removeColumn = (index: number) => {
    if (!draftConfig) return;
    const nextColumns = draftConfig.columns.filter((_, i) => i !== index);
    syncConfigText({ ...draftConfig, columns: nextColumns });
  };

  const addRowAction = () => {
    if (!draftConfig) return;
    const actions = draftConfig.rowActions ?? [];
    const next: DynamicTabRowActionConfig = {
      id: `action_${actions.length + 1}`,
      label: "Action",
      type: "navigate",
      idField: draftConfig.rowNavigation?.idField ?? "id",
      hrefBasePath: "/",
    };
    syncConfigText({ ...draftConfig, rowActions: [...actions, next] });
  };

  const updateRowAction = (index: number, patch: Partial<DynamicTabRowActionConfig>) => {
    if (!draftConfig) return;
    const actions = draftConfig.rowActions ?? [];
    const nextActions = actions.map((action, i) => (i === index ? { ...action, ...patch } : action));
    syncConfigText({ ...draftConfig, rowActions: nextActions });
  };

  const removeRowAction = (index: number) => {
    if (!draftConfig) return;
    const actions = draftConfig.rowActions ?? [];
    const nextActions = actions.filter((_, i) => i !== index);
    syncConfigText({ ...draftConfig, rowActions: nextActions });
  };

  const addComputedColumn = () => {
    if (!draftConfig) return;
    const existing = draftConfig.computedColumns ?? [];
    const next: DynamicTabComputedColumn = {
      id: `c${Date.now()}`,
      name: `computed_${existing.length + 1}`,
      expression: "",
      format: "number",
    };
    syncConfigText({ ...draftConfig, computedColumns: [...existing, next] });
  };

  const updateComputedColumn = (index: number, patch: Partial<DynamicTabComputedColumn>) => {
    if (!draftConfig) return;
    const existing = draftConfig.computedColumns ?? [];
    const next = existing.map((c, i) => (i === index ? { ...c, ...patch } : c));
    syncConfigText({ ...draftConfig, computedColumns: next });
  };

  const removeComputedColumn = (index: number) => {
    if (!draftConfig) return;
    const existing = draftConfig.computedColumns ?? [];
    syncConfigText({ ...draftConfig, computedColumns: existing.filter((_, i) => i !== index) });
  };

  // ── Detail page helpers ──────────────────────────────────────
  const toggleDetailPage = (enabled: boolean) => {
    if (!draftConfig) return;
    if (enabled) {
      syncConfigText({
        ...draftConfig,
        detailPage: draftConfig.detailPage
          ? { ...draftConfig.detailPage, enabled: true }
          : { enabled: true, idField: draftConfig.rowNavigation?.idField ?? "id", sections: [] },
      });
    } else {
      syncConfigText({
        ...draftConfig,
        detailPage: draftConfig.detailPage ? { ...draftConfig.detailPage, enabled: false } : undefined,
      });
    }
  };

  const addDetailSection = () => {
    if (!draftConfig?.detailPage) return;
    const sections = draftConfig.detailPage.sections;
    const next: DynamicTabDetailSection = {
      id: `sec_${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      columns: 2,
      fields: [],
    };
    syncConfigText({
      ...draftConfig,
      detailPage: { ...draftConfig.detailPage, sections: [...sections, next] },
    });
  };

  const updateDetailSection = (index: number, patch: Partial<DynamicTabDetailSection>) => {
    if (!draftConfig?.detailPage) return;
    const sections = draftConfig.detailPage.sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    syncConfigText({ ...draftConfig, detailPage: { ...draftConfig.detailPage, sections } });
  };

  const removeDetailSection = (index: number) => {
    if (!draftConfig?.detailPage) return;
    syncConfigText({ ...draftConfig, detailPage: { ...draftConfig.detailPage, sections: draftConfig.detailPage.sections.filter((_, i) => i !== index) } });
  };

  const addDetailField = (sectionIndex: number) => {
    if (!draftConfig?.detailPage) return;
    const sections = draftConfig.detailPage.sections.map((s, i) => {
      if (i !== sectionIndex) return s;
      const newField: DynamicTabDetailSectionField = { sourceField: "", label: "", format: "text" };
      return { ...s, fields: [...s.fields, newField] };
    });
    syncConfigText({ ...draftConfig, detailPage: { ...draftConfig.detailPage, sections } });
  };

  const updateDetailField = (sectionIndex: number, fieldIndex: number, patch: Partial<DynamicTabDetailSectionField>) => {
    if (!draftConfig?.detailPage) return;
    const sections = draftConfig.detailPage.sections.map((s, si) => {
      if (si !== sectionIndex) return s;
      const fields = s.fields.map((f, fi) => (fi === fieldIndex ? { ...f, ...patch } : f));
      return { ...s, fields };
    });
    syncConfigText({ ...draftConfig, detailPage: { ...draftConfig.detailPage, sections } });
  };

  const removeDetailField = (sectionIndex: number, fieldIndex: number) => {
    if (!draftConfig?.detailPage) return;
    const sections = draftConfig.detailPage.sections.map((s, si) => {
      if (si !== sectionIndex) return s;
      return { ...s, fields: s.fields.filter((_, fi) => fi !== fieldIndex) };
    });
    syncConfigText({ ...draftConfig, detailPage: { ...draftConfig.detailPage, sections } });
  };

  const handleSave = async () => {
    if (!actor || !tabId || !title.trim() || !normalizedSlug) return;

    let parsedConfig: DynamicTabConfig;
    try {
      parsedConfig = JSON.parse(configText) as DynamicTabConfig;
    } catch {
      setMessage("Invalid JSON configuration");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/tabs/${encodeURIComponent(tabId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          slug: normalizedSlug,
          icon: icon.trim() || undefined,
          config: parsedConfig,
          groupIds: selectedGroupIds,
          expectedUpdatedAt: tabUpdatedAt || undefined,
        }),
      });

      if (res.status === 409) {
        setMessage("Conflict detected: tab was modified by another user. Please reload.");
        return;
      }

      if (!res.ok) {
        setMessage("Failed to save tab");
        return;
      }

      const updatedTab = (await res.json()) as { updatedAt?: string };
      setTabUpdatedAt(String(updatedTab?.updatedAt ?? tabUpdatedAt));

      setMessage("Saved");
      setSaved(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      window.dispatchEvent(new Event("tabs:refresh"));
      router.push(`/tabs/${normalizedSlug}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 0);
    }
  };

  if (loading) {
    return <section className="admin-placeholder-card">Loading...</section>;
  }

  return (
    <div>
      <h1 className="admin-page-title">Edit tab</h1>
      <p className="admin-page-description">
        Configure source, columns, joins, row navigation and row actions with no-code helpers or JSON.
      </p>

      <section className="admin-placeholder-card" style={{ display: "grid", gap: "0.75rem", maxWidth: "960px" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: "0.45rem 0.65rem",
              borderRadius: "0.45rem",
              border: "1px solid var(--border-color)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Subtitle</span>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            style={{
              padding: "0.45rem 0.65rem",
              borderRadius: "0.45rem",
              border: "1px solid var(--border-color)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{
              padding: "0.45rem 0.65rem",
              borderRadius: "0.45rem",
              border: "1px solid var(--border-color)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
            }}
          />
          <span style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>/tabs/{normalizedSlug || "..."}</span>
        </label>

        <div style={{ display: "grid", gap: "0.4rem" }}>
          <span>Tab icon</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              style={{
                width: "2.4rem",
                height: "2.4rem",
                borderRadius: "0.45rem",
                border: "1px solid var(--border-color)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--button-bg)",
                cursor: "pointer",
                color: "var(--text-primary)",
                appearance: "none" as const,
              }}
              title="Preview"
            >
              <MaterialSymbol name={icon.trim() || APP_MATERIAL_SYMBOLS.navigation.components} size={22} weight={500} opticalSize={24} />
            </button>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{icon || "—"}</span>
          </div>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
            Type any Material Symbol name (the full library is supported).
          </span>
          <IconPickerModal
            isOpen={iconPickerOpen}
            currentIcon={icon}
            onSelect={(name) => setIcon(name)}
            onClose={() => setIconPickerOpen(false)}
          />
        </div>

        <fieldset style={{ display: "grid", gap: "0.35rem", border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 500, marginBottom: "0.15rem" }}>Allowed groups</legend>
          {groups.length === 0 && (
            <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>No groups available</span>
          )}
          {groups.map((group) => (
            <label
              key={group.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.3rem 0.5rem",
                borderRadius: "0.4rem",
                border: selectedGroupIds.includes(group.id)
                  ? "1px solid var(--border-hover)"
                  : "1px solid var(--border-color)",
                background: selectedGroupIds.includes(group.id)
                  ? "rgba(14,165,233,0.06)"
                  : "transparent",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              <input
                type="checkbox"
                checked={selectedGroupIds.includes(group.id)}
                onChange={(e) => {
                  setSelectedGroupIds((prev) =>
                    e.target.checked
                      ? [...prev, group.id]
                      : prev.filter((gid) => gid !== group.id)
                  );
                }}
              />
              {group.name}
            </label>
          ))}
        </fieldset>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Config JSON</span>
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            rows={20}
            style={{
              width: "100%",
              padding: "0.6rem 0.7rem",
              borderRadius: "0.45rem",
              border: "1px solid var(--border-color)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "0.8rem",
            }}
          />
        </label>

        {draftConfig && (
          <section className="admin-placeholder-card" style={{ borderStyle: "solid", padding: "1rem" }}>
            <div className="admin-placeholder-title">No-code config</div>

            <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.6rem" }}>
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>Source</span>
                <select
                  value={draftConfig.source}
                  onChange={(e) => syncConfigText({ ...draftConfig, source: e.target.value as DynamicTabConfig["source"] })}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="centers">centers</option>
                  <option value="clients">clients</option>
                  <option value="bookings">bookings</option>
                  <option value="external">external</option>
                </select>
              </label>

              {draftConfig.source === "external" && (
                <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <label style={{ display: "grid", gap: "0.2rem" }}>
                    <span>Connector ID</span>
                    <select
                      value={draftConfig.connectorId ?? ""}
                      onChange={(e) => {
                        const nextConnectorId = e.target.value;
                        syncConfigText({ ...draftConfig, connectorId: nextConnectorId });
                        loadTablesForConnector(nextConnectorId);
                      }}
                      style={{
                        padding: "0.45rem 0.65rem",
                        borderRadius: "0.45rem",
                        border: "1px solid var(--border-color)",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {connectors.length === 0 && <option value="">No connector</option>}
                      {connectors.map((connector) => (
                        <option key={connector.id} value={connector.id}>
                          {connector.name} ({connector.provider})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.2rem" }}>
                    <span>External table</span>
                    <select
                      value={draftConfig.externalTable ?? ""}
                      onChange={(e) => syncConfigText({ ...draftConfig, externalTable: e.target.value })}
                      style={{
                        padding: "0.45rem 0.65rem",
                        borderRadius: "0.45rem",
                        border: "1px solid var(--border-color)",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="">{loadingTables ? "Loading tables..." : "Select a table"}</option>
                      {availableTables.map((table) => (
                        <option key={table.table} value={table.table}>
                          {table.table}
                          {table.rowCount !== undefined ? ` (${table.rowCount})` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      value={draftConfig.externalTable ?? ""}
                      onChange={(e) => syncConfigText({ ...draftConfig, externalTable: e.target.value })}
                      placeholder="Manual override"
                      style={{
                        padding: "0.45rem 0.65rem",
                        borderRadius: "0.45rem",
                        border: "1px solid var(--border-color)",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </label>
                </div>
              )}

              {draftConfig.source === "external" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={importColumnsFromSchema}
                    disabled={importingSchema || !draftConfig.externalTable}
                    style={{
                      padding: "0.35rem 0.55rem",
                      borderRadius: "0.4rem",
                      border: "1px solid var(--border-color)",
                      background: "var(--button-bg)",
                      color: "var(--text-primary)",
                      cursor: importingSchema ? "not-allowed" : "pointer",
                      opacity: importingSchema ? 0.75 : 1,
                    }}
                  >
                    {importingSchema ? "Importing..." : "Import columns"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!draftConfig.connectorId) return;
                      loadTablesForConnector(draftConfig.connectorId);
                    }}
                    style={{
                      padding: "0.35rem 0.55rem",
                      borderRadius: "0.4rem",
                      border: "1px solid var(--border-color)",
                      background: "var(--button-bg)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    Refresh tables
                  </button>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                    {loadingTables ? "Loading connector schema..." : `${availableTables.length} table(s) loaded`}
                  </span>
                </div>
              )}

              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                <input
                  type="checkbox"
                  checked={!!draftConfig.rowNavigation?.enabled}
                  onChange={(e) =>
                    syncConfigText({
                      ...draftConfig,
                      rowNavigation: {
                        enabled: e.target.checked,
                        idField: draftConfig.rowNavigation?.idField ?? "id",
                        hrefBasePath: draftConfig.rowNavigation?.hrefBasePath ?? "/",
                      },
                    })
                  }
                />
                <span>Enable row click navigation</span>
              </label>

              {draftConfig.rowNavigation && (
                <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <label style={{ display: "grid", gap: "0.2rem" }}>
                    <span>Row id field</span>
                    <input
                      value={draftConfig.rowNavigation.idField}
                      onChange={(e) =>
                        syncConfigText({
                          ...draftConfig,
                          rowNavigation: { ...draftConfig.rowNavigation!, idField: e.target.value },
                        })
                      }
                      style={{
                        padding: "0.45rem 0.65rem",
                        borderRadius: "0.45rem",
                        border: "1px solid var(--border-color)",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.2rem" }}>
                    <span>Row href base path</span>
                    <input
                      value={draftConfig.rowNavigation.hrefBasePath}
                      onChange={(e) =>
                        syncConfigText({
                          ...draftConfig,
                          rowNavigation: { ...draftConfig.rowNavigation!, hrefBasePath: e.target.value },
                        })
                      }
                      style={{
                        padding: "0.45rem 0.65rem",
                        borderRadius: "0.45rem",
                        border: "1px solid var(--border-color)",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </label>
                </div>
              )}

              <div style={{ marginTop: "0.25rem" }}>
                <div className="admin-placeholder-title" style={{ fontSize: "0.9rem" }}>Columns</div>
                <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.5rem" }}>
                  {draftConfig.columns.map((column, index) => (
                    <div
                      key={`${column.key}-${index}`}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.5rem",
                        padding: "0.55rem",
                        display: "grid",
                        gap: "0.45rem",
                        gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto",
                        alignItems: "end",
                      }}
                    >
                      <label style={{ display: "grid", gap: "0.2rem" }}>
                        <span>Key</span>
                        <input
                          value={column.key}
                          onChange={(e) => updateColumn(index, { key: e.target.value })}
                          style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: "0.2rem" }}>
                        <span>Source field</span>
                        <input
                          value={column.sourceField}
                          onChange={(e) => updateColumn(index, { sourceField: e.target.value })}
                          style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: "0.2rem" }}>
                        <span>Label</span>
                        <input
                          value={column.label}
                          onChange={(e) => updateColumn(index, { label: e.target.value })}
                          style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: "0.2rem" }}>
                        <span>Format</span>
                        <select
                          value={column.format}
                          onChange={(e) => updateColumn(index, { format: e.target.value as DynamicTabFieldFormat })}
                          style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                        >
                          <option value="text">text</option>
                          <option value="date">date</option>
                          <option value="currency">currency</option>
                          <option value="number">number</option>
                          <option value="status-pill">status-pill</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: "0.2rem" }}>
                        <span>Filter</span>
                        <select
                          value={column.filterType ?? "text"}
                          onChange={(e) => updateColumn(index, { filterType: e.target.value as "text" | "select" | "none" })}
                          style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                        >
                          <option value="text">text</option>
                          <option value="select">select</option>
                          <option value="date">date</option>
                          <option value="number">number</option>
                          <option value="none">none</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeColumn(index)}
                        style={{ padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addColumn}
                  style={{ marginTop: "0.5rem", padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer" }}
                >
                  Add column
                </button>
              </div>

              <div style={{ marginTop: "0.45rem" }}>
                <div className="admin-placeholder-title" style={{ fontSize: "0.9rem" }}>Row actions</div>
                <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.5rem" }}>
                  {(draftConfig.rowActions ?? []).map((action, index) => {
                    const actionType = action.type ?? "navigate";
                    return (
                    <div
                      key={`${action.id}-${index}`}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.5rem",
                        padding: "0.55rem",
                        display: "grid",
                        gap: "0.45rem",
                      }}
                    >
                      {/* Row 1: core fields */}
                      <div style={{ display: "grid", gap: "0.45rem", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "end" }}>
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span>ID</span>
                          <input
                            value={action.id}
                            onChange={(e) => updateRowAction(index, { id: e.target.value })}
                            style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span>Label</span>
                          <input
                            value={action.label}
                            onChange={(e) => updateRowAction(index, { label: e.target.value })}
                            style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span>Type</span>
                          <select
                            value={actionType}
                            onChange={(e) => updateRowAction(index, { type: e.target.value as DynamicTabRowActionConfig["type"] })}
                            style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                          >
                            <option value="navigate">Navigate</option>
                            <option value="db-update">DB Update</option>
                            <option value="db-delete">DB Delete</option>
                            <option value="api-call">API Call</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeRowAction(index)}
                          style={{ padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer" }}
                        >
                          Remove
                        </button>
                      </div>

                      {/* Row 2: type-specific fields */}
                      <div style={{ display: "grid", gap: "0.45rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", alignItems: "end" }}>
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span>ID field</span>
                          <input
                            value={action.idField}
                            onChange={(e) => updateRowAction(index, { idField: e.target.value })}
                            style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                          />
                        </label>

                        {actionType === "navigate" && (
                          <label style={{ display: "grid", gap: "0.2rem" }}>
                            <span>Href base</span>
                            <input
                              value={action.hrefBasePath ?? ""}
                              onChange={(e) => updateRowAction(index, { hrefBasePath: e.target.value })}
                              style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                            />
                          </label>
                        )}

                        {actionType === "db-update" && (
                          <>
                            <label style={{ display: "grid", gap: "0.2rem" }}>
                              <span>Target field</span>
                              <input
                                value={action.targetField ?? ""}
                                onChange={(e) => updateRowAction(index, { targetField: e.target.value })}
                                style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                              />
                            </label>
                            <label style={{ display: "grid", gap: "0.2rem" }}>
                              <span>Prompt label</span>
                              <input
                                value={action.promptLabel ?? ""}
                                onChange={(e) => updateRowAction(index, { promptLabel: e.target.value })}
                                style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                              />
                            </label>
                          </>
                        )}

                        {actionType === "api-call" && (
                          <label style={{ display: "grid", gap: "0.2rem" }}>
                            <span>API URL</span>
                            <input
                              value={action.apiUrl ?? ""}
                              onChange={(e) => updateRowAction(index, { apiUrl: e.target.value })}
                              style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Row 3: confirm message (for db-update, db-delete, api-call) */}
                      {actionType !== "navigate" && (
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span>Confirm message</span>
                          <input
                            value={action.confirmMessage ?? ""}
                            onChange={(e) => updateRowAction(index, { confirmMessage: e.target.value })}
                            placeholder={actionType === "db-delete" ? "Êtes-vous sûr de vouloir supprimer ?" : ""}
                            style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                          />
                        </label>
                      )}
                    </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={addRowAction}
                  style={{ marginTop: "0.5rem", padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer" }}
                >
                  Add row action
                </button>
              </div>

              {/* ── Computed columns ── */}
              <div style={{ marginTop: "0.45rem" }}>
                <div className="admin-placeholder-title" style={{ fontSize: "0.9rem" }}>Computed fields</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.72rem", margin: "0.2rem 0 0.4rem" }}>Syntax: columns, +, -, *, /, %, CONCAT(), ROUND(), IF(cond, then, else), ABS(), MIN(), MAX()</p>
                <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.5rem" }}>
                  {(draftConfig.computedColumns ?? []).map((comp, index) => (
                    <div
                      key={`${comp.id}-${index}`}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.5rem",
                        padding: "0.55rem",
                        display: "grid",
                        gap: "0.45rem",
                      }}
                    >
                      <div style={{ display: "grid", gap: "0.45rem", gridTemplateColumns: "1fr 2fr auto auto", alignItems: "end" }}>
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span>Name</span>
                          <input
                            value={comp.name}
                            onChange={(e) => updateComputedColumn(index, { name: e.target.value })}
                            style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span>Formula</span>
                          <input
                            value={comp.expression}
                            onChange={(e) => updateComputedColumn(index, { expression: e.target.value })}
                            style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)", fontFamily: "monospace" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span>Format</span>
                          <select
                            value={comp.format ?? "number"}
                            onChange={(e) => updateComputedColumn(index, { format: e.target.value as DynamicTabFieldFormat })}
                            style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                          >
                            <option value="number">number</option>
                            <option value="text">text</option>
                            <option value="currency">currency</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeComputedColumn(index)}
                          style={{ padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer" }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addComputedColumn}
                  style={{ marginTop: "0.5rem", padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer" }}
                >
                  Add computed field
                </button>
              </div>

              {/* ── Detail sub-page ── */}
              <div style={{ marginTop: "0.45rem" }}>
                <div className="admin-placeholder-title" style={{ fontSize: "0.9rem" }}>Detail sub-page</div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", marginTop: "0.3rem" }}>
                  <input
                    type="checkbox"
                    checked={!!draftConfig.detailPage?.enabled}
                    onChange={(e) => toggleDetailPage(e.target.checked)}
                  />
                  <span>Enable custom detail page layout</span>
                </label>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.72rem", margin: "0.15rem 0" }}>
                  If disabled, the detail page auto-generates sections from configured columns.
                </p>

                {draftConfig.detailPage?.enabled && (
                  <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr", maxWidth: "480px" }}>
                      <label style={{ display: "grid", gap: "0.2rem" }}>
                        <span>Title field</span>
                        <input
                          value={draftConfig.detailPage.titleField ?? ""}
                          onChange={(e) => syncConfigText({ ...draftConfig, detailPage: { ...draftConfig.detailPage!, titleField: e.target.value || undefined } })}
                          placeholder="id"
                          style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: "0.2rem" }}>
                        <span>Subtitle field</span>
                        <input
                          value={draftConfig.detailPage.subtitleField ?? ""}
                          onChange={(e) => syncConfigText({ ...draftConfig, detailPage: { ...draftConfig.detailPage!, subtitleField: e.target.value || undefined } })}
                          placeholder="(optional)"
                          style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                        />
                      </label>
                    </div>

                    {/* Sections */}
                    {draftConfig.detailPage.sections.map((section, si) => (
                      <div key={section.id} style={{ border: "1px solid var(--border-color)", borderRadius: "0.5rem", padding: "0.6rem", display: "grid", gap: "0.45rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
                            <label style={{ display: "grid", gap: "0.15rem" }}>
                              <span style={{ fontSize: "0.75rem" }}>Section title</span>
                              <input
                                value={section.title}
                                onChange={(e) => updateDetailSection(si, { title: e.target.value })}
                                style={{ padding: "0.3rem 0.45rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)", width: "180px" }}
                              />
                            </label>
                            <label style={{ display: "grid", gap: "0.15rem" }}>
                              <span style={{ fontSize: "0.75rem" }}>Columns</span>
                              <select
                                value={section.columns ?? 2}
                                onChange={(e) => updateDetailSection(si, { columns: Number(e.target.value) as 1 | 2 })}
                                style={{ padding: "0.3rem 0.45rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)", width: "65px" }}
                              >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                              </select>
                            </label>
                          </div>
                          <button type="button" onClick={() => removeDetailSection(si)} style={{ padding: "0.25rem 0.45rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem" }}>Remove</button>
                        </div>

                        {/* Fields */}
                        {section.fields.map((field, fi) => (
                          <div key={fi} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: "0.3rem", alignItems: "end" }}>
                            <label style={{ display: "grid", gap: "0.1rem" }}>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Source field</span>
                              <input
                                value={field.sourceField}
                                onChange={(e) => updateDetailField(si, fi, { sourceField: e.target.value })}
                                style={{ padding: "0.3rem 0.4rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: "0.78rem" }}
                              />
                            </label>
                            <label style={{ display: "grid", gap: "0.1rem" }}>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Label</span>
                              <input
                                value={field.label}
                                onChange={(e) => updateDetailField(si, fi, { label: e.target.value })}
                                style={{ padding: "0.3rem 0.4rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: "0.78rem" }}
                              />
                            </label>
                            <label style={{ display: "grid", gap: "0.1rem" }}>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Format</span>
                              <select
                                value={field.format ?? "text"}
                                onChange={(e) => updateDetailField(si, fi, { format: e.target.value as DynamicTabFieldFormat })}
                                style={{ padding: "0.3rem 0.4rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: "0.78rem" }}
                              >
                                <option value="text">text</option>
                                <option value="date">date</option>
                                <option value="currency">currency</option>
                                <option value="number">number</option>
                              </select>
                            </label>
                            <button type="button" onClick={() => removeDetailField(si, fi)} style={{ padding: "0.25rem 0.4rem", borderRadius: "0.35rem", border: "1px solid var(--border-color)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem" }}>✕</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addDetailField(si)} style={{ justifySelf: "start", padding: "0.25rem 0.45rem", borderRadius: "0.35rem", border: "1px dashed var(--border-color)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.75rem" }}>+ Add field</button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addDetailSection}
                      style={{ justifySelf: "start", padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-primary)", cursor: "pointer" }}
                    >
                      Add section
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <AsyncButton
            type="button"
            onClick={handleSave}
            isLoading={saving}
            isSuccess={saved}
            loadingLabel="Saving..."
            successLabel="Save"
            minWidth={130}
          >
            Save
          </AsyncButton>
          {message && <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>{message}</span>}
        </div>
      </section>
    </div>
  );
}
