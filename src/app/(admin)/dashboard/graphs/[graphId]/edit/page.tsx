"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "@/lib/use-locale";
import { DashboardGraphCard, type DashboardGraphWithData } from "@/components/admin/DashboardGraphCard";
import { AsyncButton } from "@/components/admin/AsyncButton";
import type {
  DashboardGraphConfig,
  DashboardGraphFieldOption,
  DashboardGraphMapRegion,
  DashboardGraphSource,
  DashboardGraphSourceOption,
  DashboardGraphTimeGranularity,
  DashboardGraphType,
} from "@/lib/types";

const CHART_TYPES: DashboardGraphType[] = ["bar", "line", "pie", "kpi", "table", "scatter", "map"];

function inputStyle() {
  return {
    width: "100%",
    padding: "0.5rem",
    borderRadius: "0.5rem",
    border: "1px solid var(--border-color)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: "0.82rem",
  } as const;
}

function sectionTitleStyle() {
  return { margin: 0, fontSize: "0.92rem", fontWeight: 600 } as const;
}

type GraphResponse = DashboardGraphWithData;

type SessionActor = {
  id: string;
  role: string;
};

export default function EditDashboardGraphPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const params = useParams<{ graphId: string }>();
  const graphId = String(params?.graphId ?? "");

  const [options, setOptions] = useState<DashboardGraphSourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [graphUpdatedAt, setGraphUpdatedAt] = useState("");

  const labels =
    locale === "fr"
      ? {
          title: "Éditer le graphique",
          description: "Modifie la configuration du graphique existant.",
          back: "← Retour dashboard",
          basics: "Base",
          source: "Source",
          chartType: "Type",
          titleField: "Titre",
          descriptionField: "Description",
          data: "Données",
          groupBy: "Dimension",
          metric: "Métrique",
          xField: "Axe X",
          yField: "Axe Y",
          aggregation: "Agrégation",
          count: "Nombre",
          sum: "Somme",
          avg: "Moyenne",
          joins: "Jointure (bêta)",
          enableJoin: "Activer une source secondaire",
          joinSource: "Source secondaire",
          joinLeftKey: "Clé source principale",
          joinRightKey: "Clé source secondaire",
          time: "Evolution dans le temps",
          timeField: "Champ date",
          dateFrom: "Date début",
          dateTo: "Date fin",
          granularity: "Granularité",
          day: "Jour",
          week: "Semaine",
          month: "Mois",
          map: "Carte",
          region: "Zone",
          zoom: "Zoom",
          france: "France",
          europe: "Europe",
          world: "Monde",
          style: "Mise en forme",
          valueFormat: "Format valeur",
          number: "Nombre",
          currency: "Monétaire",
          percent: "%",
          color: "Couleur",
          limit: "Points max",
          sortDirection: "Tri",
          asc: "Croissant",
          desc: "Décroissant",
          size: "Taille widget",
          filters: "Filtre rapide",
          filterField: "Champ",
          filterValue: "Valeur",
          share: "Partager dans la bibliothèque commune",
          preview: "Aperçu",
          save: "Enregistrer",
          saving: "Enregistrement...",
          loading: "Chargement du graphique...",
          notFound: "Graphique introuvable.",
        }
      : {
          title: "Edit graph",
          description: "Update an existing graph configuration.",
          back: "← Back dashboard",
          basics: "Basics",
          source: "Source",
          chartType: "Type",
          titleField: "Title",
          descriptionField: "Description",
          data: "Data",
          groupBy: "Dimension",
          metric: "Metric",
          xField: "X axis",
          yField: "Y axis",
          aggregation: "Aggregation",
          count: "Count",
          sum: "Sum",
          avg: "Average",
          joins: "Join (beta)",
          enableJoin: "Enable secondary source",
          joinSource: "Secondary source",
          joinLeftKey: "Primary source key",
          joinRightKey: "Secondary source key",
          time: "Time evolution",
          timeField: "Date field",
          dateFrom: "From",
          dateTo: "To",
          granularity: "Granularity",
          day: "Day",
          week: "Week",
          month: "Month",
          map: "Map",
          region: "Region",
          zoom: "Zoom",
          france: "France",
          europe: "Europe",
          world: "World",
          style: "Styling",
          valueFormat: "Value format",
          number: "Number",
          currency: "Currency",
          percent: "%",
          color: "Color",
          limit: "Max points",
          sortDirection: "Sort",
          asc: "Ascending",
          desc: "Descending",
          size: "Widget size",
          filters: "Quick filter",
          filterField: "Field",
          filterValue: "Value",
          share: "Share in company library",
          preview: "Preview",
          save: "Save",
          saving: "Saving...",
          loading: "Loading graph...",
          notFound: "Graph not found.",
        };

  const [form, setForm] = useState({
    title: "",
    description: "",
    source: "bookings",
    chartType: "line" as DashboardGraphType,
    groupBy: "centerId",
    metricField: "amount",
    xField: "amount",
    yField: "amount",
    aggregation: "sum",
    joinEnabled: false,
    joinSource: "pricing",
    joinLeftKey: "centerId",
    joinRightKey: "centerId",
    limit: 12,
    sortDirection: "asc",
    valueFormat: "currency",
    color: "#2563eb",
    size: "M",
    isShared: false,
    filterField: "",
    filterValue: "",
    timeField: "",
    dateFrom: "",
    dateTo: "",
    timeGranularity: "month" as DashboardGraphTimeGranularity,
    mapRegion: "france" as DashboardGraphMapRegion,
    mapZoom: 5,
    connectorId: "",
    externalTable: "",
  });

  /* ---- external connector state ---- */
  const [connectors, setConnectors] = useState<{ id: string; label: string }[]>([]);
  const [extTables, setExtTables] = useState<string[]>([]);
  const [extFields, setExtFields] = useState<DashboardGraphFieldOption[]>([]);

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
    if (form.source !== "external") return;
    fetch(`/api/connectors`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any[]) => {
        setConnectors(data.map((c: any) => ({ id: c.id, label: c.label || c.id })));
        if (data.length > 0 && !form.connectorId) {
          setForm((prev) => ({ ...prev, connectorId: data[0].id }));
        }
      })
      .catch(() => {});
  }, [form.source]);

  useEffect(() => {
    if (form.source !== "external" || !form.connectorId) return;
    fetch(`/api/connectors/tables?connectorId=${encodeURIComponent(form.connectorId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        const raw = Array.isArray(data) ? data : data.tables ?? [];
        const tables: string[] = raw.map((t: any) => (typeof t === "string" ? t : t.table ?? ""));
        setExtTables(tables);
        if (tables.length > 0 && !form.externalTable) {
          setForm((prev) => ({ ...prev, externalTable: tables[0] }));
        }
      })
      .catch(() => {});
  }, [form.source, form.connectorId]);

  useEffect(() => {
    if (form.source !== "external" || !form.connectorId || !form.externalTable) {
      setExtFields([]);
      return;
    }
    fetch(
      `/api/connectors/schema?connectorId=${encodeURIComponent(form.connectorId)}&table=${encodeURIComponent(form.externalTable)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data: any) => {
        const raw: any[] = Array.isArray(data) ? data : data.columns ?? [];
        const cols: string[] = raw.map((c: any) => (typeof c === "string" ? c : c.name ?? ""));
        setExtFields(
          cols.filter(Boolean).map((col) => ({
            key: col,
            label: col,
            kind: "dimension" as const,
          }))
        );
      })
      .catch(() => {});
  }, [form.source, form.connectorId, form.externalTable]);

  useEffect(() => {
    const loadOptions = async () => {
      const res = await fetch("/api/dashboard/options", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as DashboardGraphSourceOption[];
      setOptions(data);
    };
    loadOptions();
  }, []);

  useEffect(() => {
    const loadGraph = async () => {
      if (!graphId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/graphs/${graphId}`, { cache: "no-store" });
        if (!res.ok) {
          setError(labels.notFound);
          return;
        }
        const graph = (await res.json()) as GraphResponse;
        setGraphUpdatedAt(String(graph.updatedAt ?? ""));

        const firstFilter = graph.config.filters?.[0];
        setForm({
          title: graph.title,
          description: graph.description ?? "",
          source: graph.config.source,
          chartType: graph.config.chartType,
          groupBy: graph.config.groupBy ?? "",
          metricField: graph.config.metricField ?? "",
          xField: graph.config.xField ?? graph.config.metricField ?? "",
          yField: graph.config.yField ?? graph.config.metricField ?? "",
          aggregation: graph.config.aggregation,
          joinEnabled: !!graph.config.join?.enabled,
          joinSource: graph.config.join?.source ?? "pricing",
          joinLeftKey: graph.config.join?.leftKey ?? "centerId",
          joinRightKey: graph.config.join?.rightKey ?? "centerId",
          limit: graph.config.limit,
          sortDirection: graph.config.sortDirection,
          valueFormat: graph.config.valueFormat,
          color: graph.config.color,
          size: graph.size,
          isShared: graph.isShared,
          filterField: firstFilter?.field ?? "",
          filterValue: firstFilter?.value ?? "",
          timeField: graph.config.timeField ?? "",
          dateFrom: graph.config.dateFrom ?? "",
          dateTo: graph.config.dateTo ?? "",
          timeGranularity: graph.config.timeGranularity ?? "month",
          mapRegion: graph.config.mapRegion ?? "france",
          mapZoom: graph.config.mapZoom ?? 5,
          connectorId: graph.config.connectorId ?? "",
          externalTable: graph.config.externalTable ?? "",
        });
      } catch {
        setError(labels.notFound);
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [graphId, labels.notFound]);

  const selectedSource = useMemo(
    () => options.find((option) => option.source === form.source),
    [options, form.source]
  );
  const dimensionOptions = useMemo(
    () => {
      if (form.source === "external" && extFields.length > 0) return extFields;
      return (selectedSource?.fields ?? []).filter((field) => field.kind === "dimension");
    },
    [selectedSource, form.source, extFields]
  );
  const metricOptions = useMemo(
    () => {
      if (form.source === "external" && extFields.length > 0) return extFields;
      return (selectedSource?.fields ?? []).filter((field) => field.kind === "metric");
    },
    [selectedSource, form.source, extFields]
  );

  const selectedJoinSource = useMemo(
    () => options.find((option) => option.source === form.joinSource),
    [options, form.joinSource]
  );
  const joinDimensionOptions = useMemo(
    () => (selectedJoinSource?.fields ?? []).filter((field) => field.kind === "dimension"),
    [selectedJoinSource]
  );
  const joinMetricOptions = useMemo(
    () => (selectedJoinSource?.fields ?? []).filter((field) => field.kind === "metric"),
    [selectedJoinSource]
  );

  const allDimensionOptions = useMemo(() => {
    if (!form.joinEnabled) return dimensionOptions;
    return [
      ...dimensionOptions,
      ...joinDimensionOptions.map((field) => ({
        ...field,
        key: `join.${field.key}`,
        label: `${selectedJoinSource?.label ?? "Join"} · ${field.label}`,
      })),
    ];
  }, [dimensionOptions, form.joinEnabled, joinDimensionOptions, selectedJoinSource]);

  const allMetricOptions = useMemo(() => {
    if (!form.joinEnabled) return metricOptions;
    return [
      ...metricOptions,
      ...joinMetricOptions.map((field) => ({
        ...field,
        key: `join.${field.key}`,
        label: `${selectedJoinSource?.label ?? "Join"} · ${field.label}`,
      })),
    ];
  }, [form.joinEnabled, metricOptions, joinMetricOptions, selectedJoinSource]);

  const hasDateField = useMemo(
    () => dimensionOptions.some((field) => field.key === form.timeField),
    [dimensionOptions, form.timeField]
  );

  const previewConfig = useMemo(() => {
    const config: DashboardGraphConfig = {
      source: form.source as DashboardGraphSource,
      chartType: form.chartType,
      groupBy: form.groupBy || undefined,
      metricField: form.metricField || undefined,
      xField: form.xField || undefined,
      yField: form.yField || undefined,
      timeField: hasDateField ? form.timeField || undefined : undefined,
      dateFrom: form.dateFrom || undefined,
      dateTo: form.dateTo || undefined,
      timeGranularity: form.timeGranularity,
      mapRegion: form.mapRegion,
      mapZoom: form.mapZoom,
      join: form.joinEnabled
        ? {
            enabled: true,
            source: form.joinSource as DashboardGraphSource,
            leftKey: form.joinLeftKey,
            rightKey: form.joinRightKey,
          }
        : undefined,
      aggregation: form.aggregation as DashboardGraphConfig["aggregation"],
      limit: Number(form.limit),
      sortDirection: form.sortDirection as "asc" | "desc",
      color: form.color,
      valueFormat: form.valueFormat as DashboardGraphConfig["valueFormat"],
      filters:
        form.filterField && form.filterValue
          ? [{ field: form.filterField, value: form.filterValue }]
          : [],
      connectorId: form.source === "external" ? form.connectorId : undefined,
      externalTable: form.source === "external" ? form.externalTable : undefined,
    };
    return config;
  }, [form, hasDateField]);

  const [previewGraph, setPreviewGraph] = useState<DashboardGraphWithData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/graphs/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: previewConfig }),
    })
      .then((res) => res.json())
      .then((computedData) => {
        if (cancelled) return;
        setPreviewGraph({
          id: graphId || "preview",
          ownerUserId: "preview",
          title: form.title || (locale === "fr" ? "Aperçu graphique" : "Graph preview"),
          description: form.description,
          size: form.size as DashboardGraphWithData["size"],
          layoutOrder: 0,
          isShared: form.isShared,
          sharedFromGraphId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          config: previewConfig,
          computedData,
        } as DashboardGraphWithData);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [previewConfig, form.title, form.description, form.size, form.isShared, graphId, locale]);

  const onSave = async () => {
    if (!graphId) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard/graphs/${graphId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim() || (locale === "fr" ? "Graphique" : "Graph"),
          description: form.description.trim(),
          size: form.size,
          isShared: form.isShared,
          config: previewConfig,
          expectedUpdatedAt: graphUpdatedAt || undefined,
        }),
      });

      if (res.status === 409) {
        throw new Error(locale === "fr" ? "Conflit détecté : ce graphique a été modifié ailleurs. Rechargez la page." : "Conflict detected: this graph was modified elsewhere. Reload the page.");
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }

      const updatedGraph = (await res.json()) as { updatedAt?: string };
      setGraphUpdatedAt(String(updatedGraph?.updatedAt ?? graphUpdatedAt));

      setSaved(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 0);
    }
  };

  const fieldSelect = (items: DashboardGraphFieldOption[]) =>
    items.map((item) => (
      <option key={item.key} value={item.key}>
        {item.label}
      </option>
    ));

  if (loading) {
    return <section className="admin-placeholder-card">{labels.loading}</section>;
  }

  if (!authResolved) {
    return <section className="admin-placeholder-card">Loading...</section>;
  }

  if (actor?.role !== "admin") {
    return (
      <section className="admin-placeholder-card">
        Only admins can edit dashboard graphs.
      </section>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "0.85rem" }}>
        <div>
          <h1 className="admin-page-title">{labels.title}</h1>
          <p className="admin-page-description">{labels.description}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          style={{
            padding: "0.45rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border-color)",
            background: "var(--button-bg)",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          {labels.back}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 1fr)", gap: "0.9rem", alignItems: "start" }}>
        <section className="admin-placeholder-card" style={{ display: "grid", gap: "0.85rem" }}>
          <div style={{ display: "grid", gap: "0.65rem" }}>
            <h2 style={sectionTitleStyle()}>{labels.basics}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.65rem" }}>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.source}
                <select value={form.source} onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))} style={inputStyle()}>
                  {options.map((option) => (
                    <option key={option.source} value={option.source}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.source === "external" && (
                <>
                  <label style={{ display: "grid", gap: "0.22rem" }}>
                    {locale === "fr" ? "Connecteur" : "Connector"}
                    <select value={form.connectorId} onChange={(event) => setForm((prev) => ({ ...prev, connectorId: event.target.value, externalTable: "" }))} style={inputStyle()}>
                      <option value="">--</option>
                      {connectors.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.22rem" }}>
                    {locale === "fr" ? "Table" : "Table"}
                    <select value={form.externalTable} onChange={(event) => setForm((prev) => ({ ...prev, externalTable: event.target.value }))} style={inputStyle()}>
                      <option value="">--</option>
                      {extTables.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.chartType}
                <select value={form.chartType} onChange={(event) => setForm((prev) => ({ ...prev, chartType: event.target.value as DashboardGraphType }))} style={inputStyle()}>
                  {CHART_TYPES.map((chartType) => (
                    <option key={chartType} value={chartType}>
                      {chartType}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem", gridColumn: "span 2" }}>
                {labels.titleField}
                <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} style={inputStyle()} />
              </label>
              <label style={{ display: "grid", gap: "0.22rem", gridColumn: "span 2" }}>
                {labels.descriptionField}
                <input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} style={inputStyle()} />
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.65rem" }}>
            <h2 style={sectionTitleStyle()}>{labels.data}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.65rem" }}>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.groupBy}
                <select value={form.groupBy} onChange={(event) => setForm((prev) => ({ ...prev, groupBy: event.target.value }))} style={inputStyle()}>
                  {fieldSelect(allDimensionOptions)}
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.metric}
                <select value={form.metricField} onChange={(event) => setForm((prev) => ({ ...prev, metricField: event.target.value }))} style={inputStyle()}>
                  {fieldSelect(allMetricOptions)}
                </select>
              </label>
              {form.chartType === "scatter" && (
                <>
                  <label style={{ display: "grid", gap: "0.22rem" }}>
                    {labels.xField}
                    <select value={form.xField} onChange={(event) => setForm((prev) => ({ ...prev, xField: event.target.value }))} style={inputStyle()}>
                      {fieldSelect(allMetricOptions)}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.22rem" }}>
                    {labels.yField}
                    <select value={form.yField} onChange={(event) => setForm((prev) => ({ ...prev, yField: event.target.value }))} style={inputStyle()}>
                      {fieldSelect(allMetricOptions)}
                    </select>
                  </label>
                </>
              )}
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.aggregation}
                <select value={form.aggregation} onChange={(event) => setForm((prev) => ({ ...prev, aggregation: event.target.value }))} style={inputStyle()}>
                  <option value="count">{labels.count}</option>
                  <option value="sum">{labels.sum}</option>
                  <option value="avg">{labels.avg}</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.limit}
                <input type="number" min={1} max={90} value={form.limit} onChange={(event) => setForm((prev) => ({ ...prev, limit: Number(event.target.value) }))} style={inputStyle()} />
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.65rem" }}>
            <h2 style={sectionTitleStyle()}>{labels.joins}</h2>
            <label style={{ display: "inline-flex", gap: "0.55rem", alignItems: "center", fontSize: "0.82rem" }}>
              <input type="checkbox" checked={form.joinEnabled} onChange={(event) => setForm((prev) => ({ ...prev, joinEnabled: event.target.checked }))} />
              {labels.enableJoin}
            </label>
            {form.joinEnabled && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.65rem" }}>
                <label style={{ display: "grid", gap: "0.22rem" }}>
                  {labels.joinSource}
                  <select value={form.joinSource} onChange={(event) => setForm((prev) => ({ ...prev, joinSource: event.target.value }))} style={inputStyle()}>
                    {options
                      .filter((option) => option.source !== form.source)
                      .map((option) => (
                        <option key={option.source} value={option.source}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: "0.22rem" }}>
                  {labels.joinLeftKey}
                  <select value={form.joinLeftKey} onChange={(event) => setForm((prev) => ({ ...prev, joinLeftKey: event.target.value }))} style={inputStyle()}>
                    {fieldSelect(dimensionOptions)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: "0.22rem" }}>
                  {labels.joinRightKey}
                  <select value={form.joinRightKey} onChange={(event) => setForm((prev) => ({ ...prev, joinRightKey: event.target.value }))} style={inputStyle()}>
                    {fieldSelect(joinDimensionOptions)}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: "0.65rem" }}>
            <h2 style={sectionTitleStyle()}>{labels.time}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.65rem" }}>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.timeField}
                <select value={form.timeField} onChange={(event) => setForm((prev) => ({ ...prev, timeField: event.target.value }))} style={inputStyle()}>
                  <option value="">--</option>
                  {fieldSelect(dimensionOptions)}
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.granularity}
                <select value={form.timeGranularity} onChange={(event) => setForm((prev) => ({ ...prev, timeGranularity: event.target.value as DashboardGraphTimeGranularity }))} style={inputStyle()}>
                  <option value="day">{labels.day}</option>
                  <option value="week">{labels.week}</option>
                  <option value="month">{labels.month}</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.dateFrom}
                <input type="date" value={form.dateFrom} onChange={(event) => setForm((prev) => ({ ...prev, dateFrom: event.target.value }))} style={inputStyle()} />
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.dateTo}
                <input type="date" value={form.dateTo} onChange={(event) => setForm((prev) => ({ ...prev, dateTo: event.target.value }))} style={inputStyle()} />
              </label>
            </div>
          </div>

          {form.chartType === "map" && (
            <div style={{ display: "grid", gap: "0.65rem" }}>
              <h2 style={sectionTitleStyle()}>{labels.map}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.65rem" }}>
                <label style={{ display: "grid", gap: "0.22rem" }}>
                  {labels.region}
                  <select value={form.mapRegion} onChange={(event) => setForm((prev) => ({ ...prev, mapRegion: event.target.value as DashboardGraphMapRegion }))} style={inputStyle()}>
                    <option value="france">{labels.france}</option>
                    <option value="europe">{labels.europe}</option>
                    <option value="world">{labels.world}</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: "0.22rem" }}>
                  {labels.zoom}
                  <input type="range" min={1} max={10} value={form.mapZoom} onChange={(event) => setForm((prev) => ({ ...prev, mapZoom: Number(event.target.value) }))} />
                </label>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: "0.65rem" }}>
            <h2 style={sectionTitleStyle()}>{labels.style}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.65rem" }}>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.sortDirection}
                <select value={form.sortDirection} onChange={(event) => setForm((prev) => ({ ...prev, sortDirection: event.target.value }))} style={inputStyle()}>
                  <option value="asc">{labels.asc}</option>
                  <option value="desc">{labels.desc}</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.valueFormat}
                <select value={form.valueFormat} onChange={(event) => setForm((prev) => ({ ...prev, valueFormat: event.target.value }))} style={inputStyle()}>
                  <option value="number">{labels.number}</option>
                  <option value="currency">{labels.currency}</option>
                  <option value="percent">{labels.percent}</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.color}
                <input type="color" value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} style={inputStyle()} />
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.size}
                <select value={form.size} onChange={(event) => setForm((prev) => ({ ...prev, size: event.target.value }))} style={inputStyle()}>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.65rem" }}>
            <h2 style={sectionTitleStyle()}>{labels.filters}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.65rem" }}>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.filterField}
                <select value={form.filterField} onChange={(event) => setForm((prev) => ({ ...prev, filterField: event.target.value }))} style={inputStyle()}>
                  <option value="">--</option>
                  {selectedSource?.fields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.filterValue}
                <input value={form.filterValue} onChange={(event) => setForm((prev) => ({ ...prev, filterValue: event.target.value }))} style={inputStyle()} />
              </label>
            </div>
          </div>

          <label style={{ display: "inline-flex", gap: "0.55rem", alignItems: "center", fontSize: "0.85rem" }}>
            <input type="checkbox" checked={form.isShared} onChange={(event) => setForm((prev) => ({ ...prev, isShared: event.target.checked }))} />
            {labels.share}
          </label>

          {error && <div style={{ color: "rgb(248,113,113)", fontSize: "0.82rem" }}>{error}</div>}

          <AsyncButton
            type="button"
            onClick={onSave}
            isLoading={saving}
            isSuccess={saved}
            loadingLabel={labels.saving}
            successLabel={labels.save}
            minWidth={140}
            style={{ justifySelf: "start" }}
          >
            {labels.save}
          </AsyncButton>
        </section>

        <section className="admin-placeholder-card" style={{ position: "sticky", top: "1rem" }}>
          <h2 style={{ ...sectionTitleStyle(), marginBottom: "0.6rem" }}>{labels.preview}</h2>
          {previewGraph ? (
            <DashboardGraphCard graph={previewGraph} locale={locale} showActions={false} />
          ) : (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading...</p>
          )}
        </section>
      </div>
    </div>
  );
}
