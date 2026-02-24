"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TableWithColumnFilters, type ColumnDefinition } from "@/components/admin/TableWithColumnFilters";
import { getCurrentUser } from "@/lib/mock/auth";
import type { DynamicTab, DynamicTabColumnConfig } from "@/lib/types";

type RuntimeRow = Record<string, string | number | boolean | null | undefined> & {
  id: string;
  __rowId?: string | number | null;
};

export default function DynamicTabPage({ params }: { params: Promise<{ tabSlug: string }> }) {
  const [tab, setTab] = useState<DynamicTab | null>(null);
  const [rows, setRows] = useState<RuntimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const { tabSlug } = await params;
      const actor = getCurrentUser();
      if (!actor) return;

      setLoading(true);
      setError(null);
      try {
        const tabRes = await fetch(`/api/tabs/slug/${encodeURIComponent(tabSlug)}?userId=${encodeURIComponent(actor.id)}`, {
          cache: "no-store",
        });

        if (!tabRes.ok) {
          setError("Tab not found or forbidden");
          setTab(null);
          setRows([]);
          return;
        }

        const tabData = (await tabRes.json()) as DynamicTab;
        setTab(tabData);

        const rowsRes = await fetch(`/api/tabs/slug/${encodeURIComponent(tabSlug)}/rows?userId=${encodeURIComponent(actor.id)}`, {
          cache: "no-store",
        });

        if (!rowsRes.ok) {
          setRows([]);
          return;
        }

        const rowsData = (await rowsRes.json()) as RuntimeRow[];
        setRows(rowsData);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [params]);

  const columns = useMemo<ColumnDefinition<RuntimeRow>[]>(() => {
    if (!tab) return [];

    return [
      ...tab.config.columns.map((column) => {
        // Determine the best filterType based on format
        let filterType = column.filterType ?? "text";
        if (filterType === "text") {
          if (column.format === "date") filterType = "date";
          else if (column.format === "currency") filterType = "number";
          else if (column.format === "status-pill" && column.options?.length) filterType = "select";
        }
        const selectOptions = column.format === "status-pill" && column.options?.length
          ? column.options.map((o) => ({ value: o.value, label: o.label }))
          : undefined;

        return {
        key: column.key as keyof RuntimeRow,
        label: column.label,
        filterType,
        selectOptions,
        render: (row: RuntimeRow) => {
          const value = row[column.key];

          if (column.format === "date") {
            if (!value) return "-";
            const date = new Date(String(value));
            if (Number.isNaN(date.getTime())) return String(value);
            return date.toLocaleDateString();
          }

          if (column.format === "currency") {
            if (value == null || value === "") return "-";
            const numeric = Number(value);
            if (Number.isNaN(numeric)) return String(value);
            return numeric.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 2,
            });
          }

          if (column.format === "number") {
            if (value == null || value === "") return "-";
            const numeric = Number(value);
            if (Number.isNaN(numeric)) return String(value);
            const opts = column.formatOptions;
            let result = numeric;
            if (opts?.rounding === "floor") result = Math.floor(result * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0);
            else if (opts?.rounding === "ceil") result = Math.ceil(result * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0);
            const formatted = result.toLocaleString("fr-FR", { minimumFractionDigits: opts?.decimals ?? 0, maximumFractionDigits: opts?.decimals ?? 2 });
            return `${opts?.prefix ?? ""}${formatted}${opts?.suffix ?? ""}`;
          }

          if (column.format === "status-pill") {
            const raw = String(value ?? "");
            const option = column.options?.find((opt) => opt.value === raw);
            const label = (option?.label ?? raw) || "-";
            const color = option?.color ?? "#64748b";
            return (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  background: `${color}22`,
                  color,
                  border: `1px solid ${color}66`,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
            );
          }

          return String(value ?? "-");
        },
      };
      }),
      // Computed columns
      ...(tab.config.computedColumns ?? []).map((comp): ColumnDefinition<RuntimeRow> => {
        const key = `_computed_${comp.id}` as keyof RuntimeRow;
        const colDef: DynamicTabColumnConfig = { key: key as string, sourceField: key as string, label: comp.name, format: comp.format ?? "number", formatOptions: comp.formatOptions };
        const filterType = colDef.format === "number" || colDef.format === "currency" ? "number" as const : "text" as const;
        return {
          key,
          label: comp.name,
          filterType,
          render: (row: RuntimeRow) => {
            const value = row[key];
            if (value == null || value === "") return "-";
            if (colDef.format === "number") {
              const numeric = Number(value);
              if (Number.isNaN(numeric)) return String(value);
              const opts = colDef.formatOptions;
              let result = numeric;
              if (opts?.rounding === "floor") result = Math.floor(result * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0);
              else if (opts?.rounding === "ceil") result = Math.ceil(result * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0);
              const formatted = result.toLocaleString("fr-FR", { minimumFractionDigits: opts?.decimals ?? 0, maximumFractionDigits: opts?.decimals ?? 2 });
              return `${opts?.prefix ?? ""}${formatted}${opts?.suffix ?? ""}`;
            }
            if (colDef.format === "currency") {
              const numeric = Number(value);
              if (Number.isNaN(numeric)) return String(value);
              return numeric.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
            }
            return String(value);
          },
        };
      }),
      {
        key: "__actions" as keyof RuntimeRow,
        label: "Actions",
        filterType: "none",
        isFilterable: false,
        render: (row: RuntimeRow) => (
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
            {tab?.config.rowActions?.map((action) => {
              const idValue = row[action.idField] ?? row.__rowId ?? row.id;
              const actionType = action.type ?? "navigate";

              const handleAction = async () => {
                if (!idValue || !tab) return;

                if (actionType === "navigate") {
                  router.push(`${action.hrefBasePath}/${encodeURIComponent(String(idValue))}`);
                  return;
                }

                if (action.confirmMessage && !window.confirm(action.confirmMessage)) return;

                if (actionType === "db-update") {
                  const newValue = window.prompt(action.promptLabel ?? `Nouvelle valeur pour ${action.targetField ?? "?"}:`);
                  if (newValue === null) return;
                  const actor = getCurrentUser();
                  if (!actor) return;
                  try {
                    const res = await fetch(`/api/tabs/slug/${encodeURIComponent(tab.slug)}/actions?userId=${encodeURIComponent(actor.id)}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ actionId: action.id, rowId: String(idValue), newValue }),
                    });
                    const data = await res.json();
                    window.alert(data.message ?? (res.ok ? "OK" : "Erreur"));
                  } catch { window.alert("Erreur réseau"); }
                  return;
                }

                if (actionType === "db-delete") {
                  const actor = getCurrentUser();
                  if (!actor) return;
                  try {
                    const res = await fetch(`/api/tabs/slug/${encodeURIComponent(tab.slug)}/actions?userId=${encodeURIComponent(actor.id)}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ actionId: action.id, rowId: String(idValue) }),
                    });
                    const data = await res.json();
                    window.alert(data.message ?? (res.ok ? "Supprimé" : "Erreur"));
                  } catch { window.alert("Erreur réseau"); }
                  return;
                }

                if (actionType === "api-call") {
                  const actor = getCurrentUser();
                  if (!actor) return;
                  try {
                    const res = await fetch(`/api/tabs/slug/${encodeURIComponent(tab.slug)}/actions?userId=${encodeURIComponent(actor.id)}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ actionId: action.id, rowId: String(idValue) }),
                    });
                    const data = await res.json();
                    window.alert(data.success ? "Appel réussi" : `Erreur: ${data.error ?? data.response ?? "?"}`);
                  } catch { window.alert("Erreur réseau"); }
                }
              };

              const btnColor = actionType === "db-delete" ? "#ef4444" : "var(--text-primary)";
              const btnBorder = actionType === "db-delete" ? "1px solid #ef444466" : "1px solid var(--border-color)";

              return (
                <button
                  key={action.id}
                  type="button"
                  data-row-action="true"
                  onClick={handleAction}
                  style={{
                    padding: "0.3rem 0.55rem",
                    borderRadius: "0.45rem",
                    border: btnBorder,
                    background: "var(--button-bg)",
                    color: btnColor,
                    cursor: "pointer",
                  }}
                >
                  {action.label}
                </button>
              );
            })}
            <button
              type="button"
              data-row-action="true"
              onClick={() => {
                const idValue = row.__rowId ?? row.id;
                if (!idValue || !tab) return;
                router.push(`/tabs/${tab.slug}/${encodeURIComponent(String(idValue))}`);
              }}
              style={{
                padding: "0.3rem 0.55rem",
                borderRadius: "0.45rem",
                border: "1px solid var(--border-color)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Ouvrir
            </button>
          </div>
        ),
      },
    ];
  }, [router, tab]);

  if (loading) {
    return <section className="admin-placeholder-card">Loading...</section>;
  }

  if (error || !tab) {
    return <section className="admin-placeholder-card">{error ?? "Not found"}</section>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>{tab.title}</h1>
        {getCurrentUser()?.role === "admin" && (
          <button
            type="button"
            onClick={() => router.push(`/tabs/${tab.slug}/edit`)}
            style={{
              padding: "0.35rem 0.65rem",
              borderRadius: "0.45rem",
              border: "1px solid var(--border-color)",
              background: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "0.78rem",
            }}
          >
            Edit tab
          </button>
        )}
      </div>
      {tab.subtitle && <p className="admin-page-description">{tab.subtitle}</p>}
      <TableWithColumnFilters
        title={tab.title}
        description={tab.subtitle}
        data={rows}
        columns={columns}
        onRowClick={(row) => {
          const idValue = row.__rowId ?? row.id;
          if (!idValue || !tab) return;
          router.push(`/tabs/${tab.slug}/${encodeURIComponent(String(idValue))}`);
        }}
      />
    </div>
  );
}
