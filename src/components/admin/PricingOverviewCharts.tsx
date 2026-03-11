"use client";

import { useMemo } from "react";
import { getCenters, getPricingByCenter } from "@/lib/mock/centers-and-pricing";

const MIN_BAR_WIDTH_PERCENT = 5;

interface CenterPricingAgg {
  centerId: string;
  centerName: string;
  city: string;
  avgCurrentPrice: number;
  avgReferencePrice: number;
  availableUnits: number;
  totalUnits: number;
  occupancyRate: number;
}

function useAggregatedPricingData(): CenterPricingAgg[] {
  return useMemo(() => {
    const centers = getCenters();
    const allPricing = getPricingByCenter();

    return centers
      .filter((center) => allPricing.some((p) => p.centerId === center.id))
      .map((center) => {
      const centerPricing = allPricing.filter((p) => p.centerId === center.id);
      const count = centerPricing.length;

      const avgCurrentPrice =
        centerPricing.reduce((sum, p) => sum + p.currentPrice, 0) / count;
      const avgReferencePrice =
        centerPricing.reduce((sum, p) => sum + p.referencePrice, 0) / count;
      const availableUnits = centerPricing.reduce(
        (sum, p) => sum + p.availabilityCount,
        0
      );
      const totalUnits = centerPricing.reduce(
        (sum, p) => sum + p.totalUnits,
        0
      );
      const occupancyRate =
        totalUnits > 0
          ? ((totalUnits - availableUnits) / totalUnits) * 100
          : 0;

      return {
        centerId: center.id,
        centerName: center.name,
        city: center.city,
        avgCurrentPrice: Math.round(avgCurrentPrice),
        avgReferencePrice: Math.round(avgReferencePrice),
        availableUnits,
        totalUnits,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
      };
    });
  }, []);
}

function formatCurrency(value: number, locale: string): string {
  return value.toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

/* ── Chart 1: Average Price per Center (grouped bar) ── */

function AveragePriceChart({
  data,
  formatLocale,
  labels,
}: {
  data: CenterPricingAgg[];
  formatLocale: string;
  labels: { current: string; reference: string };
}) {
  const maxPrice = Math.max(
    ...data.map((d) => Math.max(d.avgCurrentPrice, d.avgReferencePrice)),
    1
  );

  return (
    <div style={{ display: "grid", gap: "0.7rem" }}>
      {data.map((center) => {
        const currentWidth = (center.avgCurrentPrice / maxPrice) * 100;
        const referenceWidth = (center.avgReferencePrice / maxPrice) * 100;

        return (
          <div key={center.centerId} style={{ display: "grid", gap: "0.2rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.4rem",
                fontSize: "0.75rem",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                {center.city}
              </span>
              <strong>
                {formatCurrency(center.avgCurrentPrice, formatLocale)}
              </strong>
            </div>
            {/* Current price bar */}
            <div
              style={{
                width: "100%",
                height: 8,
                borderRadius: 999,
                background: "var(--input-bg)",
              }}
            >
              <div
                style={{
                  width: `${Math.max(MIN_BAR_WIDTH_PERCENT, currentWidth)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "#7a57be",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            {/* Reference price bar */}
            <div
              style={{
                width: "100%",
                height: 5,
                borderRadius: 999,
                background: "var(--input-bg)",
              }}
            >
              <div
                style={{
                  width: `${Math.max(MIN_BAR_WIDTH_PERCENT, referenceWidth)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "rgba(122, 87, 190, 0.35)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          fontSize: "0.7rem",
          color: "var(--text-secondary)",
          marginTop: "0.25rem",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 6,
              borderRadius: 999,
              background: "#7a57be",
            }}
          />
          {labels.current}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 6,
              borderRadius: 999,
              background: "rgba(122, 87, 190, 0.35)",
            }}
          />
          {labels.reference}
        </span>
      </div>
    </div>
  );
}

/* ── Chart 2: Occupancy Rate per Center (horizontal bar) ── */

function OccupancyChart({
  data,
  labels,
}: {
  data: CenterPricingAgg[];
  labels: { occupied: string; available: string };
}) {
  return (
    <div style={{ display: "grid", gap: "0.7rem" }}>
      {data.map((center) => {
        const occupiedUnits = center.totalUnits - center.availableUnits;

        return (
          <div key={center.centerId} style={{ display: "grid", gap: "0.2rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.4rem",
                fontSize: "0.75rem",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                {center.city}
              </span>
              <strong>{center.occupancyRate}%</strong>
            </div>
            <div
              style={{
                width: "100%",
                height: 10,
                borderRadius: 999,
                background: "var(--input-bg)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(MIN_BAR_WIDTH_PERCENT, center.occupancyRate)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background:
                    center.occupancyRate >= 80
                      ? "#ef4444"
                      : center.occupancyRate >= 60
                      ? "#f59e0b"
                      : "#22c55e",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)",
              }}
            >
              {occupiedUnits}/{center.totalUnits} {labels.occupied.toLowerCase()}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "0.8rem",
          fontSize: "0.7rem",
          color: "var(--text-secondary)",
          marginTop: "0.25rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: 999,
              background: "#22c55e",
            }}
          />
          {"< 60%"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: 999,
              background: "#f59e0b",
            }}
          />
          {"60–80%"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: 999,
              background: "#ef4444",
            }}
          />
          {"> 80%"}
        </span>
      </div>
    </div>
  );
}

/* ── Main export ── */

export function PricingOverviewCharts({ locale }: { locale: "fr" | "en" }) {
  const data = useAggregatedPricingData();

  const labels =
    locale === "fr"
      ? {
          priceTitle: "Prix moyen par centre",
          priceDescription: "Comparaison prix actuel vs prix de référence",
          occupancyTitle: "Taux d'occupation par centre",
          occupancyDescription: "Boxes occupés sur le total disponible",
          current: "Prix actuel",
          reference: "Prix de référence",
          occupied: "Occupés",
          available: "Disponibles",
        }
      : {
          priceTitle: "Average price per center",
          priceDescription: "Current vs reference price comparison",
          occupancyTitle: "Occupancy rate per center",
          occupancyDescription: "Occupied boxes out of total available",
          current: "Current price",
          reference: "Reference price",
          occupied: "Occupied",
          available: "Available",
        };

  const formatLocale = locale === "fr" ? "fr-FR" : "en-US";

  return (
    <section
      aria-label={locale === "fr" ? "Aperçu grille tarifaire" : "Pricing grid overview"}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      {/* Chart 1: Average price per center */}
      <article className="admin-placeholder-card">
        <h3 style={{ margin: "0 0 0.15rem", fontSize: "0.95rem" }}>
          {labels.priceTitle}
        </h3>
        <p
          style={{
            margin: "0 0 0.75rem",
            color: "var(--text-secondary)",
            fontSize: "0.78rem",
          }}
        >
          {labels.priceDescription}
        </p>
        <AveragePriceChart
          data={data}
          formatLocale={formatLocale}
          labels={{ current: labels.current, reference: labels.reference }}
        />
      </article>

      {/* Chart 2: Occupancy rate per center */}
      <article className="admin-placeholder-card">
        <h3 style={{ margin: "0 0 0.15rem", fontSize: "0.95rem" }}>
          {labels.occupancyTitle}
        </h3>
        <p
          style={{
            margin: "0 0 0.75rem",
            color: "var(--text-secondary)",
            fontSize: "0.78rem",
          }}
        >
          {labels.occupancyDescription}
        </p>
        <OccupancyChart
          data={data}
          labels={{ occupied: labels.occupied, available: labels.available }}
        />
      </article>
    </section>
  );
}
