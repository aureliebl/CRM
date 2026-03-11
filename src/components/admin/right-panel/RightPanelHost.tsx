"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useRightPanel } from "@/components/admin/right-panel/RightPanelProvider";
import type { RightPanelConfig, RightPanelFieldConfig } from "@/lib/right-panel-types";
import { evaluateRightPanelFormula } from "@/lib/right-panel-formula-engine";

function getByPath(input: Record<string, unknown>, path: string | undefined): unknown {
  if (!path) return null;
  const parts = path.split(".").filter(Boolean);
  let current: unknown = input;
  for (const part of parts) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? null;
}

function toPct(value: unknown, min = 0, max = 100) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((num - min) / (max - min)) * 100));
}

function renderTemplate(template: string, scope: Record<string, unknown>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = getByPath(scope, path);
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

export function RightPanelHost() {
  const router = useRouter();
  const {
    state: { panelId, entity, collapsed, contextKey },
    closePanel,
    toggleCollapse,
  } = useRightPanel();

  const [config, setConfig] = useState<RightPanelConfig | null>(null);
  const [relations, setRelations] = useState<Record<string, unknown>>({});

  const entityRecord = useMemo<Record<string, unknown>>(() => {
    if (!entity || typeof entity !== "object") return {};
    return entity as Record<string, unknown>;
  }, [entity]);

  useEffect(() => {
    if (!panelId) {
      setConfig(null);
      return;
    }

    let mounted = true;
    const loadConfig = async () => {
      const res = await fetch(`/api/right-panels/config/${encodeURIComponent(panelId)}`, {
        cache: "no-store",
      });
      if (!res.ok || !mounted) {
        setConfig(null);
        return;
      }
      const payload = (await res.json()) as RightPanelConfig;
      if (!mounted) return;
      setConfig(payload);
    };

    void loadConfig();
    return () => {
      mounted = false;
    };
  }, [panelId]);

  useEffect(() => {
    if (!config || !entityRecord || !Array.isArray(config.relations) || config.relations.length === 0) {
      setRelations({});
      return;
    }

    let mounted = true;
    const loadRelations = async () => {
      const loaded: Record<string, unknown> = {};
      for (const relation of config.relations || []) {
        const resolver = relation.resolver;
        if (!resolver) continue;

        const idPath = typeof relation.params?.idPath === "string" ? relation.params.idPath : "id";
        const id = getByPath(entityRecord, idPath);
        const query = new URLSearchParams({
          resolver,
          id: String(id ?? ""),
        });

        const res = await fetch(`/api/right-panels/relations?${query.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) continue;
        const payload = (await res.json()) as { data?: unknown };
        loaded[relation.key] = payload.data ?? null;
      }

      if (!mounted) return;
      setRelations(loaded);
    };

    void loadRelations();
    return () => {
      mounted = false;
    };
  }, [config, entityRecord]);

  const scoped = useMemo(() => {
    return {
      ...entityRecord,
      relations,
      contextKey,
    };
  }, [entityRecord, relations, contextKey]);

  const formulaMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const formula of config?.formulas || []) {
      map.set(formula.key, formula.expression);
    }
    return map;
  }, [config]);

  const fieldValue = (field: RightPanelFieldConfig) => {
    if (field.source === "raw") return getByPath(scoped, field.path);
    if (field.source === "relation") {
      if (field.relationKey && field.path) {
        const relationItem = relations[field.relationKey] as Record<string, unknown> | undefined;
        if (!relationItem) return null;
        return getByPath(relationItem, field.path);
      }
      if (field.relationKey) return relations[field.relationKey] ?? null;
      return null;
    }
    if (field.source === "computed") {
      const expression = field.formulaKey ? formulaMap.get(field.formulaKey) : null;
      if (!expression) return null;
      return evaluateRightPanelFormula(expression, scoped);
    }
    return null;
  };

  if (!panelId || !entityRecord || !config) return null;

  const title = renderTemplate(config.titleTemplate || config.displayName, scoped);
  const subtitle = config.subtitleTemplate ? renderTemplate(config.subtitleTemplate, scoped) : "";
  const width = config.uiOptions?.width ?? 420;
  const clientId = typeof entityRecord.clientId === "string" && entityRecord.clientId ? entityRecord.clientId : null;

  return (
    <aside
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: collapsed ? 44 : width,
        borderLeft: "1px solid var(--border-color)",
        background: "var(--surface-primary)",
        zIndex: 80,
        boxShadow: "-12px 0 30px rgba(0,0,0,0.18)",
        backdropFilter: "blur(12px)",
        transition: "width 0.22s ease",
        display: "grid",
        gridTemplateRows: "auto 1fr",
      }}
    >
      <div
        style={{
          padding: "0.7rem 0.65rem",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "linear-gradient(180deg, rgba(var(--accent-rgb), 0.08), transparent)",
        }}
      >
        {!collapsed ? (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
              {title || config.displayName}
            </div>
            {subtitle ? (
              <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {subtitle}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {!collapsed && clientId ? (
            <button
              type="button"
              onClick={() => router.push(`/crm/${clientId}`)}
              style={{ border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-secondary)", cursor: "pointer", padding: 2, borderRadius: 6 }}
              title="Voir la fiche client"
            >
              <MaterialSymbol name="person" size={18} weight={500} opticalSize={20} />
            </button>
          ) : null}
          {!collapsed ? (
            <span
              title={panelId}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "1px solid var(--border-color)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color: "var(--text-secondary)",
                cursor: "help",
                background: "var(--surface-secondary)",
              }}
            >
              ?
            </span>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapse}
            style={{ border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-secondary)", cursor: "pointer", padding: 2, borderRadius: 6 }}
            title={collapsed ? "Deplier" : "Replier"}
          >
            <MaterialSymbol name={collapsed ? "left_panel_open" : "left_panel_close"} size={18} weight={500} opticalSize={20} />
          </button>
          <button
            type="button"
            onClick={closePanel}
            style={{ border: "1px solid var(--border-color)", background: "var(--button-bg)", color: "var(--text-secondary)", cursor: "pointer", padding: 2, borderRadius: 6 }}
            title="Fermer"
          >
            <MaterialSymbol name="close" size={18} weight={500} opticalSize={20} />
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div style={{ overflow: "auto", padding: "0.75rem", display: "grid", gap: "0.7rem", alignContent: "start" }}>
          {(config.globalActions || []).length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {(config.globalActions || []).map((action) => (
                <button
                  key={`global_${action.key}`}
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  style={{ fontSize: 12 }}
                  onClick={() => window.alert(`Action: ${action.key}`)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          {(config.sections || []).map((section) => (
            <section
              key={section.key}
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: "0.65rem",
                display: "grid",
                gap: "0.5rem",
                background: "var(--surface-secondary)",
              }}
            >
              {section.title ? <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.01em" }}>{section.title}</div> : null}

              {section.fields.map((field) => {
                const value = fieldValue(field);
                const localActions = field.actions || [];
                const renderer = field.renderer;

                return (
                  <div key={field.key} style={{ display: "grid", gap: "0.22rem" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{field.label}</div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        {renderer === "badge" ? (
                          <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, background: "var(--surface-secondary)", fontSize: 11, fontWeight: 600 }}>
                            {String(value ?? "—")}
                          </span>
                        ) : renderer === "progress" ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 110, height: 8, borderRadius: 999, overflow: "hidden", background: "var(--surface-secondary)" }}>
                              <div style={{ width: `${toPct(value, Number(field.format?.min ?? 0), Number(field.format?.max ?? 100))}%`, height: "100%", background: "var(--accent-primary)" }} />
                            </div>
                            <span style={{ fontSize: 11 }}>{String(value ?? "0")}%</span>
                          </div>
                        ) : renderer === "donut" ? (
                          <span
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              display: "inline-block",
                              background: `conic-gradient(var(--accent-primary) ${toPct(value)}%, var(--surface-secondary) ${toPct(value)}%)`,
                            }}
                            title={`${toPct(value).toFixed(0)}%`}
                          />
                        ) : renderer === "link" ? (
                          typeof value === "string" && value ? (
                            <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                              {value}
                            </a>
                          ) : (
                            <span style={{ fontSize: 12 }}>—</span>
                          )
                        ) : (
                          <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: "100%" }}>
                            {String(value ?? "—")}
                          </span>
                        )}
                      </div>

                      {localActions.length > 0 ? (
                        <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {localActions.map((action) => (
                            <button
                              key={`${field.key}_${action.key}`}
                              type="button"
                              className="admin-btn admin-btn-secondary"
                              style={{ padding: "2px 7px", fontSize: 11 }}
                              onClick={() => window.alert(`Action: ${action.key}`)}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
