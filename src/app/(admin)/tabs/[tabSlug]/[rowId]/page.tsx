"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/mock/auth";
import type { DynamicTabConfig, DynamicTabDetailSection, DynamicTabFormatOptions, DynamicTabFieldFormat } from "@/lib/types";

type RowData = Record<string, string | number | boolean | null | undefined>;

function formatValue(
  value: unknown,
  format?: DynamicTabFieldFormat,
  formatOptions?: DynamicTabFormatOptions,
): string {
  if (value == null || value === "") return "—";

  if (format === "date") {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  }

  if (format === "currency") {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  }

  if (format === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    const opts = formatOptions;
    let result = n;
    if (opts?.rounding === "floor") result = Math.floor(result * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0);
    else if (opts?.rounding === "ceil") result = Math.ceil(result * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0);
    const formatted = result.toLocaleString("fr-FR", {
      minimumFractionDigits: opts?.decimals ?? 0,
      maximumFractionDigits: opts?.decimals ?? 2,
    });
    return `${opts?.prefix ?? ""}${formatted}${opts?.suffix ?? ""}`;
  }

  return String(value);
}

function DetailSection({ section, row }: { section: DynamicTabDetailSection; row: RowData }) {
  const cols = section.columns ?? 2;
  return (
    <section
      className="admin-placeholder-card"
      style={{ marginTop: "1rem" }}
    >
      <div className="admin-placeholder-title">{section.title}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
          gap: "0.75rem 1.5rem",
          marginTop: "0.75rem",
        }}
      >
        {section.fields.map((field) => (
          <div
            key={field.sourceField}
            style={{
              gridColumn: field.span === 2 ? "1 / -1" : undefined,
              display: "grid",
              gap: "0.15rem",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              {field.label}
            </span>
            <span
              style={{
                fontSize: "0.9rem",
                color: "var(--text-primary)",
                wordBreak: "break-word",
              }}
            >
              {formatValue(row[field.sourceField], field.format, field.formatOptions)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AutoSection({ row, config }: { row: RowData; config: DynamicTabConfig }) {
  // Auto-generate sections: one for regular columns, one for computed columns
  const regularFields = config.columns.map((col) => ({
    sourceField: col.key,
    label: col.label,
    format: col.format,
    formatOptions: col.formatOptions,
  }));

  const computedFields = (config.computedColumns ?? []).map((comp) => ({
    sourceField: `_computed_${comp.id}`,
    label: comp.name,
    format: comp.format,
    formatOptions: comp.formatOptions,
  }));

  return (
    <>
      {regularFields.length > 0 && (
        <DetailSection
          section={{
            id: "__auto_main",
            title: "Informations",
            columns: 2,
            fields: regularFields,
          }}
          row={row}
        />
      )}
      {computedFields.length > 0 && (
        <DetailSection
          section={{
            id: "__auto_computed",
            title: "Champs calculés",
            columns: 2,
            fields: computedFields,
          }}
          row={row}
        />
      )}
    </>
  );
}

export default function TabDetailPage({
  params,
}: {
  params: Promise<{ tabSlug: string; rowId: string }>;
}) {
  const [row, setRow] = useState<RowData | null>(null);
  const [config, setConfig] = useState<DynamicTabConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const { tabSlug, rowId } = await params;
      const actor = getCurrentUser();
      if (!actor) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/tabs/slug/${encodeURIComponent(tabSlug)}/rows/${encodeURIComponent(rowId)}?userId=${encodeURIComponent(actor.id)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          setError(res.status === 404 ? "Ligne introuvable" : "Erreur de chargement");
          return;
        }

        const data = await res.json();
        setRow(data.row);
        setConfig(data.config);
      } catch {
        setError("Erreur réseau");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [params]);

  if (loading) {
    return <section className="admin-placeholder-card">Chargement...</section>;
  }

  if (error || !row || !config) {
    return <section className="admin-placeholder-card">{error ?? "Not found"}</section>;
  }

  const detailPage = config.detailPage;
  const titleField = detailPage?.titleField ?? "id";
  const subtitleField = detailPage?.subtitleField;
  const pageTitle = String(row[titleField] ?? row.__rowId ?? row.id ?? "Détail");
  const pageSubtitle = subtitleField ? String(row[subtitleField] ?? "") : undefined;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            padding: "0.3rem 0.55rem",
            borderRadius: "0.45rem",
            border: "1px solid var(--border-color)",
            background: "var(--button-bg)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          ← Retour
        </button>
        <div>
          <h1 className="admin-page-title" style={{ margin: 0 }}>{pageTitle}</h1>
          {pageSubtitle && (
            <p className="admin-page-description" style={{ margin: 0 }}>{pageSubtitle}</p>
          )}
        </div>
      </div>

      {detailPage?.enabled && detailPage.sections.length > 0 ? (
        detailPage.sections.map((section) => (
          <DetailSection key={section.id} section={section} row={row} />
        ))
      ) : (
        <AutoSection row={row} config={config} />
      )}
    </div>
  );
}
