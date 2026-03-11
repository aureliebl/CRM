"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/use-locale";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { TabLoadingIndicator } from "@/components/admin/TabLoadingIndicator";

type LibraryGraph = {
  id: string;
  ownerUserId: string;
  title: string;
  description?: string;
  size: "S" | "M" | "L";
  isShared: boolean;
  config: {
    source: string;
    chartType: string;
  };
  updatedAt: string;
};

export default function DashboardLibraryPage() {
  const { locale } = useLocale();
  const [graphs, setGraphs] = useState<LibraryGraph[]>([]);
  const [loading, setLoading] = useState(false);

  const labels =
    locale === "fr"
      ? {
          title: "Bibliothèque commune",
          description: "Graphiques partagés par l'entreprise. Importez un graphe pour l'ajouter à votre dashboard.",
          back: "Retour dashboard",
          import: "Importer",
          imported: "Importé",
          tableTitle: "Graphiques partagés",
          tableDescription: "Vous pouvez réutiliser les graphiques existants puis les personnaliser dans votre dashboard.",
          graph: "Graphique",
          source: "Source",
          type: "Type",
          owner: "Créateur",
          updatedAt: "Mis à jour",
          action: "Action",
        }
      : {
          title: "Shared library",
          description: "Company shared graphs. Import any graph into your own dashboard.",
          back: "Back to dashboard",
          import: "Import",
          imported: "Imported",
          tableTitle: "Shared graphs",
          tableDescription: "Reuse existing graphs and customize them in your dashboard.",
          graph: "Graph",
          source: "Source",
          type: "Type",
          owner: "Owner",
          updatedAt: "Updated",
          action: "Action",
        };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/library", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as LibraryGraph[];
      setGraphs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(
    () =>
      graphs.map((graph) => ({
        id: graph.id,
        graph: graph.title,
        source: graph.config.source,
        type: graph.config.chartType,
        owner: graph.ownerUserId,
        updatedAt: new Date(graph.updatedAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US"),
        action: graph.id,
      })),
    [graphs, locale]
  );

  const handleImport = async (graphId: string) => {
    const res = await fetch("/api/dashboard/graphs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importGraphId: graphId }),
    });

    if (res.ok) {
      await load();
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <div>
          <h1 className="admin-page-title">{labels.title}</h1>
          <p className="admin-page-description">{labels.description}</p>
        </div>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: "0.86rem" }}>
          {labels.back}
        </Link>
      </div>

      {loading ? (
        <TabLoadingIndicator />
      ) : (
        <TableWithColumnFilters
          title={labels.tableTitle}
          description={labels.tableDescription}
          data={rows}
          columns={[
            { key: "graph", label: labels.graph, filterType: "text" },
            { key: "source", label: labels.source, filterType: "select", selectOptions: [
              { value: "bookings", label: "bookings" },
              { value: "pricing", label: "pricing" },
              { value: "liveUsers", label: "liveUsers" },
              { value: "clients", label: "clients" },
            ] },
            { key: "type", label: labels.type, filterType: "text" },
            { key: "owner", label: labels.owner, filterType: "text" },
            { key: "updatedAt", label: labels.updatedAt, filterType: "text" },
            {
              key: "action",
              label: labels.action,
              filterType: "none",
              render: (item) => (
                <button
                  type="button"
                  onClick={() => handleImport(item.id)}
                  style={{
                    padding: "0.32rem 0.55rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--button-bg)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: "0.74rem",
                  }}
                >
                  {labels.import}
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
