import type {
  DashboardGraph,
  DashboardGraphComputedData,
  DashboardGraphDataPoint,
  DashboardGraphScatterPoint,
  DashboardGraphSize,
  DashboardGraphValueFormat,
} from "@/lib/types";

export type DashboardGraphWithData = DashboardGraph & {
  computedData: DashboardGraphComputedData;
};

interface DashboardGraphCardProps {
  graph: DashboardGraphWithData;
  locale: "fr" | "en";
  onDelete?: (graphId: string) => void;
  onToggleShare?: (graphId: string, isShared: boolean) => void;
  onResize?: (graphId: string, size: DashboardGraphSize) => void;
  onEdit?: (graphId: string) => void;
  showActions?: boolean;
}

function formatMetric(value: number, format: DashboardGraphValueFormat, locale: "fr" | "en") {
  const formatLocale = locale === "fr" ? "fr-FR" : "en-US";
  if (format === "currency") {
    return value.toLocaleString(formatLocale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  }

  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }

  return value.toLocaleString(formatLocale, { maximumFractionDigits: 2 });
}

function BarChart({ points, color, format, locale }: { points: DashboardGraphDataPoint[]; color: string; format: DashboardGraphValueFormat; locale: "fr" | "en" }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {points.map((point) => (
        <div key={point.label} style={{ display: "grid", gap: "0.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem", fontSize: "0.75rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>{point.label}</span>
            <strong>{formatMetric(point.value, format, locale)}</strong>
          </div>
          <div style={{ width: "100%", height: 8, borderRadius: 999, background: "var(--input-bg)" }}>
            <div
              style={{
                width: `${Math.max(5, (point.value / max) * 100)}%`,
                height: "100%",
                borderRadius: 999,
                background: color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points, color, format, locale }: { points: DashboardGraphDataPoint[]; color: string; format: DashboardGraphValueFormat; locale: "fr" | "en" }) {
  const width = 360;
  const height = 130;
  const padding = 16;
  const maxValue = Math.max(1, ...points.map((point) => point.value));

  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.value / maxValue) * (height - padding * 2);
    return { ...point, x, y };
  });

  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 140 }}>
        <polyline fill="none" stroke={color} strokeWidth="2.5" points={polyline} />
        {coordinates.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="3.5" fill={color} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
        {points.slice(0, 4).map((point) => (
          <span key={point.label} title={`${point.label}: ${formatMetric(point.value, format, locale)}`}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PieChart({ points, color, format, locale }: { points: DashboardGraphDataPoint[]; color: string; format: DashboardGraphValueFormat; locale: "fr" | "en" }) {
  const total = Math.max(1, points.reduce((acc, point) => acc + point.value, 0));
  const palette = [color, "#16a34a", "#a855f7", "#f59e0b", "#0ea5e9", "#ef4444"];

  const stops: string[] = [];
  let cursor = 0;

  points.forEach((point, index) => {
    const ratio = (point.value / total) * 100;
    const next = cursor + ratio;
    stops.push(`${palette[index % palette.length]} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`);
    cursor = next;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.75rem", alignItems: "center" }}>
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: `conic-gradient(${stops.join(",")})`,
        }}
      />
      <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.75rem" }}>
        {points.map((point, index) => (
          <div key={point.label} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 9,
                  height: 9,
                  marginRight: 6,
                  borderRadius: 999,
                  background: palette[index % palette.length],
                }}
              />
              {point.label}
            </span>
            <strong>{formatMetric(point.value, format, locale)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScatterChart({ points, color }: { points: DashboardGraphScatterPoint[]; color: string }) {
  const width = 360;
  const height = 140;
  const padding = 16;
  const maxX = Math.max(1, ...points.map((point) => point.x));
  const maxY = Math.max(1, ...points.map((point) => point.y));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 145 }}>
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-color)" />
      <line x1={padding} y1={height - padding} x2={padding} y2={padding} stroke="var(--border-color)" />
      {points.map((point, index) => {
        const x = padding + (point.x / maxX) * (width - padding * 2);
        const y = height - padding - (point.y / maxY) * (height - padding * 2);
        return (
          <circle key={`${point.label}-${index}`} cx={x} cy={y} r={4} fill={color} opacity={0.8}>
            <title>{`${point.label}: x=${point.x}, y=${point.y}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function TableChart({ rows }: { rows: Record<string, string | number>[] }) {
  if (rows.length === 0) {
    return <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>No data</div>;
  }

  const headers = Object.keys(rows[0]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
            {headers.map((header) => (
              <th key={header} style={{ textAlign: "left", padding: "0.35rem", color: "var(--text-secondary)" }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 6).map((row, index) => (
            <tr key={index} style={{ borderBottom: "1px solid var(--border-color)" }}>
              {headers.map((header) => (
                <td key={header} style={{ padding: "0.35rem" }}>
                  {String(row[header])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MapChart({
  points,
  color,
  region,
}: {
  points: DashboardGraphWithData["computedData"]["mapPoints"];
  color: string;
  region?: "world" | "europe" | "france";
}) {
  if (points.length === 0) {
    return <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>No data</div>;
  }

  const bounds =
    region === "world"
      ? { minLat: -60, maxLat: 75, minLng: -180, maxLng: 180 }
      : region === "europe"
      ? { minLat: 34, maxLat: 72, minLng: -15, maxLng: 35 }
      : { minLat: 41, maxLat: 51.5, minLng: -5.5, maxLng: 9.8 };

  const width = 360;
  const height = 190;
  const padding = 14;
  const maxValue = Math.max(1, ...points.map((point) => point.value));

  const toX = (longitude: number) => {
    const ratio = (longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng);
    return padding + Math.min(1, Math.max(0, ratio)) * (width - padding * 2);
  };

  const toY = (latitude: number) => {
    const ratio = (latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat);
    return height - padding - Math.min(1, Math.max(0, ratio)) * (height - padding * 2);
  };

  return (
    <div style={{ border: "1px solid var(--border-color)", borderRadius: "0.65rem", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 190, display: "block", background: "linear-gradient(180deg, rgba(37,99,235,0.06), rgba(15,23,42,0.02))" }}>
        {points.map((point) => {
          const radius = 4 + (point.value / maxValue) * 7;
          const x = toX(point.longitude);
          const y = toY(point.latitude);
          return (
            <g key={point.id}>
              <circle cx={x} cy={y} r={radius} fill={color} opacity={0.5} />
              <circle cx={x} cy={y} r={Math.max(2.5, radius * 0.35)} fill={color} />
              <title>{`${point.label}: ${point.value.toFixed(2)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DashboardGraphCard({
  graph,
  locale,
  onDelete,
  onToggleShare,
  onResize,
  onEdit,
  showActions = true,
}: DashboardGraphCardProps) {
  const labels =
    locale === "fr"
      ? {
          shared: "Partagé",
          notShared: "Privé",
          share: "Partager",
          unshare: "Retirer",
          edit: "Éditer",
          delete: "Supprimer",
          size: "Taille",
          noData: "Aucune donnée",
          total: "Total",
        }
      : {
          shared: "Shared",
          notShared: "Private",
          share: "Share",
          unshare: "Unshare",
          edit: "Edit",
          delete: "Delete",
          size: "Size",
          noData: "No data",
          total: "Total",
        };

  const points = graph.computedData.points;
  const scatterPoints = graph.computedData.scatterPoints;
  const mapPoints = graph.computedData.mapPoints;

  return (
    <article className="admin-placeholder-card" style={{ minHeight: 220 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "0.65rem", marginBottom: "0.7rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>{graph.title}</h3>
          {graph.description && (
            <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              {graph.description}
            </p>
          )}
        </div>
        <span
          style={{
            alignSelf: "flex-start",
            fontSize: "0.72rem",
            padding: "0.2rem 0.45rem",
            borderRadius: 999,
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          {graph.isShared ? labels.shared : labels.notShared}
        </span>
      </header>

      <div style={{ marginBottom: "0.8rem" }}>
        {graph.config.chartType === "kpi" ? (
          <div>
            <div style={{ fontSize: "1.7rem", fontWeight: 700 }}>{graph.computedData.formattedTotalValue}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{labels.total}</div>
          </div>
        ) : graph.config.chartType === "line" ? (
          <LineChart points={points} color={graph.config.color} format={graph.config.valueFormat} locale={locale} />
        ) : graph.config.chartType === "pie" ? (
          <PieChart points={points} color={graph.config.color} format={graph.config.valueFormat} locale={locale} />
        ) : graph.config.chartType === "table" ? (
          <TableChart rows={graph.computedData.tableRows} />
        ) : graph.config.chartType === "scatter" ? (
          <ScatterChart points={scatterPoints} color={graph.config.color} />
        ) : graph.config.chartType === "map" ? (
          <MapChart points={mapPoints} color={graph.config.color} region={graph.config.mapRegion} />
        ) : (
          <BarChart points={points} color={graph.config.color} format={graph.config.valueFormat} locale={locale} />
        )}

        {points.length === 0 && scatterPoints.length === 0 && mapPoints.length === 0 && (
          <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{labels.noData}</div>
        )}
      </div>

      {showActions && (
        <footer style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => onToggleShare?.(graph.id, !graph.isShared)}
          style={{
            padding: "0.3rem 0.55rem",
            borderRadius: "0.45rem",
            border: "1px solid var(--border-color)",
            background: "var(--button-bg)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
        >
          {graph.isShared ? labels.unshare : labels.share}
        </button>
        <button
          type="button"
          onClick={() => onEdit?.(graph.id)}
          style={{
            padding: "0.3rem 0.55rem",
            borderRadius: "0.45rem",
            border: "1px solid var(--border-color)",
            background: "var(--button-bg)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
        >
          {labels.edit}
        </button>
        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          {labels.size}
          <select
            value={graph.size}
            onChange={(event) => onResize?.(graph.id, event.target.value as DashboardGraphSize)}
            style={{
              padding: "0.2rem 0.35rem",
              borderRadius: "0.35rem",
              border: "1px solid var(--border-color)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "0.75rem",
            }}
          >
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => onDelete?.(graph.id)}
          style={{
            marginLeft: "auto",
            padding: "0.3rem 0.55rem",
            borderRadius: "0.45rem",
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.08)",
            color: "rgb(248,113,113)",
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
        >
          {labels.delete}
        </button>
        </footer>
      )}
    </article>
  );
}
