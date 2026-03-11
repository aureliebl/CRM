"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboardStats } from "@/lib/mock/bookings-and-dashboard";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";
import { APP_MATERIAL_SYMBOLS } from "@/lib/material-symbols";
import {
  DashboardGraphCard,
  type DashboardGraphWithData,
} from "@/components/admin/DashboardGraphCard";
import { PricingOverviewCharts } from "@/components/admin/PricingOverviewCharts";
import { TabLoadingIndicator } from "@/components/admin/TabLoadingIndicator";
import type { DashboardGraphSize } from "@/lib/types";

type SessionActor = {
  id: string;
  role: string;
};

export default function DashboardPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const [graphs, setGraphs] = useState<DashboardGraphWithData[]>([]);
  const [loadingGraphs, setLoadingGraphs] = useState(false);
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const stats = getDashboardStats();
  const formatLocale = locale === "fr" ? "fr-FR" : "en-US";
  const labels =
    locale === "fr"
      ? {
          title: "Dashboard",
          description:
            "Synthèse des ventes marketplace vs Kostok et de l'occupation des centres sur",
          trendUp: "↗ Occupation en hausse",
          trendDown: "↘ Occupation en baisse",
          trendStable: "→ Stable",
          marketplace: "Marketplace",
          centerTableTitle: "Centres marketplace & Kostok",
          centerTableDescription:
            "Vue consolidée par centre avec taux de remplissage et chiffre d'affaires par canal.",
          center: "Centre",
          city: "Ville",
          occupancy: "Occupation",
          revenueMarketplace: "CA Marketplace",
          revenueKostok: "CA Kostok",
          trend: "Tendance",
          status: "Statut",
          customTitle: "Graphiques personnalisés",
          customDescription:
            "Ajoutez vos graphiques personnels et partagez-les avec toute l'entreprise.",
          addGraph: "Ajouter un graphique",
          openLibrary: "Bibliothèque commune",
          libraryButton: "Bibliothèque",
          noGraph: "Aucun graphique personnalisé pour le moment.",
        }
      : {
          title: "Dashboard",
          description:
            "Sales summary for marketplace vs Kostok and center occupancy over",
          trendUp: "↗ Occupancy rising",
          trendDown: "↘ Occupancy decreasing",
          trendStable: "→ Stable",
          marketplace: "Marketplace",
          centerTableTitle: "Marketplace & Kostok centers",
          centerTableDescription:
            "Consolidated view by center with occupancy rate and revenue by channel.",
          center: "Center",
          city: "City",
          occupancy: "Occupancy",
          revenueMarketplace: "Marketplace revenue",
          revenueKostok: "Kostok revenue",
          trend: "Trend",
          status: "Status",
          customTitle: "Custom graphs",
          customDescription:
            "Add personal graph widgets and share them with the whole company.",
          addGraph: "Add graph",
          openLibrary: "Shared library",
          libraryButton: "Library",
          noGraph: "No custom graphs yet.",
        };

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

  const loadGraphs = async () => {
    if (!actor) return;

    setLoadingGraphs(true);
    try {
      const res = await fetch(`/api/dashboard/graphs`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as DashboardGraphWithData[];
      setGraphs(data);
    } finally {
      setLoadingGraphs(false);
    }
  };

  useEffect(() => {
    if (!authResolved || !actor) return;
    loadGraphs();
  }, [authResolved, actor]);

  const updateGraph = async (graphId: string, patch: Record<string, unknown>) => {
    if (!actor) return;

    const res = await fetch(`/api/dashboard/graphs/${graphId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch }),
    });

    if (res.ok) {
      await loadGraphs();
    }
  };

  const deleteGraph = async (graphId: string) => {
    if (!actor) return;

    const res = await fetch(`/api/dashboard/graphs/${graphId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      await loadGraphs();
    }
  };

  const sortedGraphs = useMemo(
    () => [...graphs].sort((a, b) => a.layoutOrder - b.layoutOrder),
    [graphs]
  );

  const getGridSpan = (size: DashboardGraphSize) => {
    if (size === "L") return "span 3";
    if (size === "M") return "span 2";
    return "span 1";
  };

  const centerRows = stats.centers.map((row) => ({
    id: row.centerId,
    center: row.centerName,
    city: row.city,
    occupancy: `${row.occupancyRate}%`,
    revenueMarketplace: row.revenueMarketplace.toLocaleString(formatLocale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }),
    revenueKostok: row.revenueKostok.toLocaleString(formatLocale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }),
    trend: row.trend,
    trendLabel:
      row.trend === "up"
        ? labels.trendUp
        : row.trend === "down"
        ? labels.trendDown
        : labels.trendStable,
  }));

  if (!authResolved) {
    return <TabLoadingIndicator />;
  }

  return (
    <div>
      <h1 className="admin-page-title">{labels.title}</h1>
      <p className="admin-page-description">
        {labels.description} {stats.periodLabel}.
      </p>

      <section
        aria-label="Indicateurs clés"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        {stats.kpis.map((kpi) => (
          <article key={kpi.label} className="admin-placeholder-card kpi-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "0.6rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                    marginBottom: "0.15rem",
                  }}
                >
                  {kpi.label}
                </div>
                <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>
                  {kpi.value}
                </div>
              </div>
              {kpi.delta && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.55rem",
                    borderRadius: "999px",
                    backgroundColor:
                      kpi.trend === "down"
                        ? "rgba(239,68,68,0.12)"
                        : "rgba(34,197,94,0.12)",
                    color:
                      kpi.trend === "down"
                        ? "rgb(248,113,113)"
                        : "rgb(74,222,128)",
                    border: "1px solid var(--border-hover)",
                  }}
                >
                  {kpi.delta}
                </div>
              )}
            </div>
            {kpi.breakdown && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  marginTop: "0.35rem",
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                }}
              >
                <span>Marketplace: {kpi.breakdown.marketplace}</span>
                <span>Kostok: {kpi.breakdown.kostok}</span>
              </div>
            )}
          </article>
        ))}
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", alignItems: "center", marginBottom: "0.65rem", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.08rem" }}>{labels.customTitle}</h2>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              {labels.customDescription}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Link
              href="/dashboard/library"
              style={{
                padding: "0.35rem 0.65rem",
                borderRadius: "0.45rem",
                border: "1px solid var(--border-color)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: "0.78rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
              title={labels.openLibrary}
            >
              <MaterialSymbol
                name={APP_MATERIAL_SYMBOLS.actions.library}
                size={16}
                weight={500}
                opticalSize={20}
              />
              {labels.libraryButton}
            </Link>
            <Link
              href="/dashboard/graphs/new"
              style={{
                padding: "0.35rem 0.65rem",
                borderRadius: "0.45rem",
                border: "1px solid var(--border-color)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: "0.78rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <MaterialSymbol
                name={APP_MATERIAL_SYMBOLS.actions.add}
                size={16}
                weight={500}
                opticalSize={20}
              />
              {labels.addGraph}
            </Link>
          </div>
        </div>

        {loadingGraphs ? (
          <TabLoadingIndicator />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "0.85rem",
              alignItems: "start",
            }}
          >
            {sortedGraphs.map((graph) => (
              <div key={graph.id} style={{ gridColumn: getGridSpan(graph.size) }}>
                <DashboardGraphCard
                  graph={graph}
                  locale={locale}
                  onDelete={deleteGraph}
                  onToggleShare={(graphId, isShared) => updateGraph(graphId, { isShared })}
                  onResize={(graphId, size) => updateGraph(graphId, { size })}
                  onEdit={(graphId) => router.push(`/dashboard/graphs/${graphId}/edit`)}
                />
              </div>
            ))}
          </div>
        )}

        {!loadingGraphs && sortedGraphs.length === 0 && (
          <p style={{ marginTop: "0.6rem", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
            {labels.noGraph}
          </p>
        )}
      </section>

      <PricingOverviewCharts locale={locale} />

      <TableWithColumnFilters
        title={labels.centerTableTitle}
        description={labels.centerTableDescription}
        data={centerRows}
        columns={[
          { key: "center", label: labels.center, filterType: "text" },
          { key: "city", label: labels.city, filterType: "text" },
          { key: "occupancy", label: labels.occupancy, filterType: "text" },
          { key: "revenueMarketplace", label: labels.revenueMarketplace, filterType: "text" },
          { key: "revenueKostok", label: labels.revenueKostok, filterType: "text" },
          {
            key: "trend",
            label: labels.trend,
            filterType: "select",
            selectOptions: [
              { value: "up", label: "Up" },
              { value: "down", label: "Down" },
              { value: "stable", label: "Stable" },
            ],
            isFilterable: true,
          },
          { key: "trendLabel", label: labels.status, filterType: "none" },
        ]}
      />
    </div>
  );
}


