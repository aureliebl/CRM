"use client";

import { useRouter } from "next/navigation";
import { centers } from "@/lib/mock/centers-and-pricing";
import { getPricingTiersByCenter, getIndividualBoxesByCenter, getActivePrice } from "@/lib/mock/crm";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";

export default function TarifsPage() {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const router = useRouter();

  const rows = centers.map((center) => {
    const tiers = getPricingTiersByCenter(center.id);
    const boxes = getIndividualBoxesByCenter(center.id);
    const totalBoxes = boxes.length;
    const occupiedBoxes = boxes.filter((b) => b.status === "occupé").length;
    const freeBoxes = boxes.filter((b) => b.status === "libre").length;
    const occupancyRate = totalBoxes > 0 ? Math.round((occupiedBoxes / totalBoxes) * 100) : 0;

    // Average active price among all tiers
    const avgPrice = tiers.length > 0 ? Math.round(tiers.reduce((s, t) => s + getActivePrice(t), 0) / tiers.length) : 0;

    // Number of distinct sizes
    const sizes = [...new Set(tiers.map((t) => t.boxSizeM2))];

    return {
      id: center.id,
      name: center.name,
      address: center.address || "—",
      floors: center.floors ?? "—",
      manager: center.manager || "—",
      totalBoxes,
      occupiedBoxes,
      freeBoxes,
      occupancyRate,
      avgPrice,
      sizesCount: sizes.length,
      tiersCount: tiers.length,
    };
  });

  return (
    <div>
      <h1 className="admin-page-title">{fr ? "Grille tarifaire" : "Pricing Grid"}</h1>
      <p className="admin-page-description">
        {fr
          ? "Sélectionnez un centre pour accéder à la matrice tarifaire détaillée avec les 4 paliers de prix par disponibilité."
          : "Select a center to access the detailed pricing matrix with 4 availability-based price tiers."}
      </p>

      <TableWithColumnFilters
        title={fr ? "Centres" : "Centers"}
        description={fr ? "Cliquer sur un centre pour voir sa grille tarifaire." : "Click a center to view its pricing grid."}
        data={rows}
        columns={[
          {
            key: "name",
            label: fr ? "Centre" : "Center",
            filterType: "text",
            render: (row) => (
              <button
                type="button"
                onClick={() => router.push(`/tarifs/${row.id}`)}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MaterialSymbol name="warehouse" style={{ fontSize: 18, color: "var(--text-secondary)" }} />
                {row.name}
              </button>
            ),
          },
          { key: "address", label: fr ? "Adresse" : "Address", filterType: "text" },
          { key: "manager", label: fr ? "Responsable" : "Manager", filterType: "text" },
          { key: "floors", label: fr ? "Étages" : "Floors", filterType: "number" },
          { key: "totalBoxes", label: fr ? "Total boxes" : "Total Boxes", filterType: "number" },
          {
            key: "occupancyRate",
            label: fr ? "Occupation" : "Occupancy",
            filterType: "number",
            render: (row) => {
              const color = row.occupancyRate > 85 ? "var(--color-error, #dc2626)" : row.occupancyRate > 60 ? "var(--color-warning, #f59e0b)" : "var(--color-success, #16a34a)";
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 50, height: 6, borderRadius: 3, background: "var(--surface-secondary, #e5e7eb)", overflow: "hidden" }}>
                    <div style={{ width: `${row.occupancyRate}%`, height: "100%", borderRadius: 3, background: color }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color }}>{row.occupancyRate}%</span>
                </div>
              );
            },
          },
          { key: "freeBoxes", label: fr ? "Libres" : "Free", filterType: "number" },
          {
            key: "avgPrice",
            label: fr ? "Prix moyen (€)" : "Avg Price (€)",
            filterType: "number",
            render: (row) => <span style={{ fontWeight: 500 }}>{row.avgPrice} €</span>,
          },
          { key: "sizesCount", label: fr ? "Tailles" : "Sizes", filterType: "number" },
        ]}
      />
    </div>
  );
}
