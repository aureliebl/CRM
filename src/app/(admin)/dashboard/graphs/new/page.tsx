"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/use-locale";
import { DashboardGraphCard, type DashboardGraphWithData } from "@/components/admin/DashboardGraphCard";
import { AsyncButton } from "@/components/admin/AsyncButton";
import type {
  DashboardGraphFieldOption,
  DashboardGraphMapRegion,
  DashboardGraphSource,
  DashboardGraphSourceOption,
  DashboardGraphTimeGranularity,
  DashboardGraphType,
} from "@/lib/types";

const CHART_TYPES: DashboardGraphType[] = ["bar", "line", "pie", "kpi", "table", "scatter", "map"];

type PresetId =
  | "custom"
  | "bookings-pricing-center"
  | "liveusers-clients-segment"
  | "bookings-pricing-scatter";

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

type SessionActor = {
  id: string;
  role: string;
};

export default function NewDashboardGraphPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const [options, setOptions] = useState<DashboardGraphSourceOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<PresetId>("custom");
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  const labels =
    locale === "fr"
      ? {
          title: "Nouveau graphique",
          description: "Configure les données, la période et le rendu avant publication.",
          back: "← Retour dashboard",
          basics: "1) Base",
          source: "Source",
          chartType: "Type",
          preset: "Preset",
          customPreset: "Configuration personnalisée",
          presetBookingsPricingCenter: "Bookings + Pricing par centre",
          presetLiveUsersClients: "Live users + Clients par segment",
          presetBookingsPricingScatter: "Corrélation booking/pricing par centre",
          titleField: "Titre",
          descriptionField: "Description",
          data: "2) Données",
          groupBy: "Dimension",
          metric: "Métrique",
          xField: "Axe X",
          yField: "Axe Y",
          aggregation: "Agrégation",
          count: "Nombre",
          sum: "Somme",
          avg: "Moyenne",
          joins: "2bis) Jointure (bêta)",
          enableJoin: "Activer une source secondaire",
          joinSource: "Source secondaire",
          joinLeftKey: "Clé source principale",
          joinRightKey: "Clé source secondaire",
          time: "3) Evolution dans le temps",
          timeField: "Champ date",
          dateFrom: "Date début",
          dateTo: "Date fin",
          granularity: "Granularité",
          day: "Jour",
          week: "Semaine",
          month: "Mois",
          map: "4) Carte",
          region: "Zone",
          zoom: "Zoom",
          france: "France",
          europe: "Europe",
          world: "Monde",
          style: "5) Mise en forme",
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
          filters: "6) Filtre rapide",
          filterField: "Champ",
          filterValue: "Valeur",
          share: "Partager dans la bibliothèque commune",
          preview: "Aperçu",
          save: "Créer le graphique",
          saving: "Création...",
          placeholderTitle: "Ex: CA mensuel par centre",
          placeholderDescription: "Ex: Pilotage équipe commerciale",
          placeholderFilter: "Ex: confirmed",
          joinsNotice: "Jointure basique disponible (2 sources). Le mode Looker Studio avancé reste prévu en V2 dédiée.",
        }
      : {
          title: "New graph",
          description: "Configure data, date range and rendering before publishing.",
          back: "← Back dashboard",
          basics: "1) Basics",
          source: "Source",
          chartType: "Type",
          preset: "Preset",
          customPreset: "Custom configuration",
          presetBookingsPricingCenter: "Bookings + Pricing by center",
          presetLiveUsersClients: "Live users + Clients by segment",
          presetBookingsPricingScatter: "Booking/pricing correlation by center",
          titleField: "Title",
          descriptionField: "Description",
          data: "2) Data",
          groupBy: "Dimension",
          metric: "Metric",
          xField: "X axis",
          yField: "Y axis",
          aggregation: "Aggregation",
          count: "Count",
          sum: "Sum",
          avg: "Average",
          joins: "2b) Join (beta)",
          enableJoin: "Enable secondary source",
          joinSource: "Secondary source",
          joinLeftKey: "Primary source key",
          joinRightKey: "Secondary source key",
          time: "3) Time evolution",
          timeField: "Date field",
          dateFrom: "From",
          dateTo: "To",
          granularity: "Granularity",
          day: "Day",
          week: "Week",
          month: "Month",
          map: "4) Map",
          region: "Region",
          zoom: "Zoom",
          france: "France",
          europe: "Europe",
          world: "World",
          style: "5) Styling",
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
          filters: "6) Quick filter",
          filterField: "Field",
          filterValue: "Value",
          share: "Share in company library",
          preview: "Preview",
          save: "Create graph",
          saving: "Creating...",
          placeholderTitle: "Ex: Monthly revenue by center",
          placeholderDescription: "Ex: Sales team monitoring",
          placeholderFilter: "Ex: confirmed",
          joinsNotice: "Basic 2-source join is now available. Advanced Looker-like joins remain planned in V2.",
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
    timeField: "createdAt",
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
  const [externalTables, setExternalTables] = useState<string[]>([]);
  const [externalFields, setExternalFields] = useState<DashboardGraphFieldOption[]>([]);

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
    if (!actor) return;
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
  }, [form.source, actor]);

  useEffect(() => {
    if (!actor) return;
    if (form.source !== "external" || !form.connectorId) return;
    fetch(`/api/connectors/tables?connectorId=${encodeURIComponent(form.connectorId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        const raw = Array.isArray(data) ? data : data.tables ?? [];
        const tables: string[] = raw.map((t: any) => (typeof t === "string" ? t : t.table ?? ""));
        setExternalTables(tables);
        if (tables.length > 0 && !form.externalTable) {
          setForm((prev) => ({ ...prev, externalTable: tables[0] }));
        }
      })
      .catch(() => {});
  }, [form.source, form.connectorId, actor]);

  useEffect(() => {
    if (!actor) return;
    if (form.source !== "external" || !form.connectorId || !form.externalTable) {
      setExternalFields([]);
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
        setExternalFields(
          cols.filter(Boolean).map((col) => ({
            key: col,
            label: col,
            kind: "dimension" as const,
          }))
        );
      })
      .catch(() => {});
  }, [form.source, form.connectorId, form.externalTable, actor]);

  const presets = useMemo(
    () => [
      { id: "custom" as const, label: labels.customPreset },
      {
        id: "bookings-pricing-center" as const,
        label: labels.presetBookingsPricingCenter,
        values: {
          title: locale === "fr" ? "Bookings + Pricing par centre" : "Bookings + Pricing by center",
          description:
            locale === "fr"
              ? "Volume de bookings et pricing moyen agrégé par centre"
              : "Bookings volume and average pricing aggregated by center",
          source: "bookings",
          chartType: "bar" as DashboardGraphType,
          groupBy: "centerId",
          metricField: "join.currentPrice",
          aggregation: "avg",
          joinEnabled: true,
          joinSource: "pricing",
          joinLeftKey: "centerId",
          joinRightKey: "centerId",
          timeField: "",
          valueFormat: "currency",
          limit: 12,
          sortDirection: "desc",
          color: "#2563eb",
        },
      },
      {
        id: "liveusers-clients-segment" as const,
        label: labels.presetLiveUsersClients,
        values: {
          title: locale === "fr" ? "Sessions live par segment client" : "Live sessions by client segment",
          description:
            locale === "fr"
              ? "Analyse des sessions live corrélées au segment client"
              : "Live sessions analysis correlated with client segment",
          source: "liveUsers",
          chartType: "pie" as DashboardGraphType,
          groupBy: "join.segment",
          metricField: "sessionDurationMin",
          aggregation: "avg",
          joinEnabled: true,
          joinSource: "clients",
          joinLeftKey: "clientId",
          joinRightKey: "id",
          timeField: "",
          valueFormat: "number",
          limit: 8,
          sortDirection: "desc",
          color: "#16a34a",
        },
      },
      {
        id: "bookings-pricing-scatter" as const,
        label: labels.presetBookingsPricingScatter,
        values: {
          title: locale === "fr" ? "Corrélation bookings/prix" : "Bookings/price correlation",
          description:
            locale === "fr"
              ? "Nuage de points entre prix moyen et montant booking"
              : "Scatter between average price and booking amount",
          source: "bookings",
          chartType: "scatter" as DashboardGraphType,
          groupBy: "centerId",
          metricField: "amount",
          xField: "join.currentPrice",
          yField: "amount",
          aggregation: "avg",
          joinEnabled: true,
          joinSource: "pricing",
          joinLeftKey: "centerId",
          joinRightKey: "centerId",
          timeField: "",
          valueFormat: "currency",
          limit: 24,
          sortDirection: "desc",
          color: "#a855f7",
        },
      },
    ],
    [
      labels.customPreset,
      labels.presetBookingsPricingCenter,
      labels.presetBookingsPricingScatter,
      labels.presetLiveUsersClients,
      locale,
    ]
  );

  const applyPreset = (presetId: PresetId) => {
    setSelectedPreset(presetId);
    if (presetId === "custom") return;
    const preset = presets.find((item) => item.id === presetId);
    const presetValues = (preset as { values?: Record<string, any> } | undefined)?.values;
    if (!presetValues) return;

    setForm((prev) => ({
      ...prev,
      ...presetValues,
      xField: presetValues.xField ?? presetValues.metricField ?? prev.xField,
      yField: presetValues.yField ?? presetValues.metricField ?? prev.yField,
      filterField: "",
      filterValue: "",
      dateFrom: "",
      dateTo: "",
    }));
  };

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/dashboard/options", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as DashboardGraphSourceOption[];
      setOptions(data);
    };

    load();
  }, []);

  const selectedSource = useMemo(
    () => options.find((option) => option.source === form.source),
    [options, form.source]
  );

  const dimensionOptions = useMemo(
    () => {
      if (form.source === "external" && externalFields.length > 0) return externalFields;
      return (selectedSource?.fields ?? []).filter((field) => field.kind === "dimension");
    },
    [selectedSource, form.source, externalFields]
  );
  const metricOptions = useMemo(
    () => {
      if (form.source === "external" && externalFields.length > 0) return externalFields;
      return (selectedSource?.fields ?? []).filter((field) => field.kind === "metric");
    },
    [selectedSource, form.source, externalFields]
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
  }, [form.joinEnabled, joinMetricOptions, metricOptions, selectedJoinSource]);

  const hasDateField = useMemo(
    () => dimensionOptions.some((field) => field.key === form.timeField),
    [dimensionOptions, form.timeField]
  );

  useEffect(() => {
    if (allDimensionOptions.length > 0 && !allDimensionOptions.some((item) => item.key === form.groupBy)) {
      setForm((prev) => ({ ...prev, groupBy: allDimensionOptions[0].key }));
    }
  }, [allDimensionOptions, form.groupBy]);

  useEffect(() => {
    if (allMetricOptions.length > 0 && !allMetricOptions.some((item) => item.key === form.metricField)) {
      setForm((prev) => ({
        ...prev,
        metricField: allMetricOptions[0].key,
        xField: allMetricOptions[0].key,
        yField: allMetricOptions[0].key,
      }));
    }
  }, [allMetricOptions, form.metricField]);

  useEffect(() => {
    if (!form.joinEnabled) return;
    if (!joinDimensionOptions.some((item) => item.key === form.joinRightKey)) {
      setForm((prev) => ({ ...prev, joinRightKey: joinDimensionOptions[0]?.key ?? "" }));
    }
  }, [form.joinEnabled, form.joinRightKey, joinDimensionOptions]);

  useEffect(() => {
    if (!form.joinEnabled) return;
    if (form.joinSource !== form.source) return;
    const fallback = options.find((option) => option.source !== form.source)?.source;
    if (!fallback) return;
    setForm((prev) => ({ ...prev, joinSource: fallback }));
  }, [form.joinEnabled, form.joinSource, form.source, options]);

  const previewConfig = useMemo(() => {
    const config = {
      source: form.source as DashboardGraphWithData["config"]["source"],
      chartType: form.chartType,
      groupBy: form.groupBy,
      metricField: form.metricField,
      xField: form.xField,
      yField: form.yField,
      timeField: hasDateField ? form.timeField : undefined,
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
      aggregation: form.aggregation as DashboardGraphWithData["config"]["aggregation"],
      limit: Number(form.limit),
      sortDirection: form.sortDirection as "asc" | "desc",
      color: form.color,
      valueFormat: form.valueFormat as DashboardGraphWithData["config"]["valueFormat"],
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
          id: "preview",
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
  }, [previewConfig, form.title, form.description, form.size, form.isShared, locale]);

  const onSave = async () => {
    if (!actor) return;

    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim() || (locale === "fr" ? "Nouveau graphique" : "New graph"),
        description: form.description.trim(),
        size: form.size,
        isShared: form.isShared,
        config: previewConfig,
      };

      const res = await fetch("/api/dashboard/graphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }

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

  if (!authResolved) {
    return <section className="admin-placeholder-card">Loading...</section>;
  }

  if (actor?.role !== "admin") {
    return (
      <section className="admin-placeholder-card">
        Only admins can create dashboard graphs.
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
          <div style={{ color: "var(--text-secondary)", fontSize: "0.79rem" }}>{labels.joinsNotice}</div>

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
                      {externalTables.map((t) => (
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
              <label style={{ display: "grid", gap: "0.22rem" }}>
                {labels.preset}
                <select value={selectedPreset} onChange={(event) => applyPreset(event.target.value as PresetId)} style={inputStyle()}>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.22rem", gridColumn: "span 2" }}>
                {labels.titleField}
                <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={labels.placeholderTitle} style={inputStyle()} />
              </label>
              <label style={{ display: "grid", gap: "0.22rem", gridColumn: "span 2" }}>
                {labels.descriptionField}
                <input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={labels.placeholderDescription} style={inputStyle()} />
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
                <input value={form.filterValue} onChange={(event) => setForm((prev) => ({ ...prev, filterValue: event.target.value }))} placeholder={labels.placeholderFilter} style={inputStyle()} />
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
            minWidth={170}
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
