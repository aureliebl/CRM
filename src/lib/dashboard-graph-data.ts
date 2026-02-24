import { getBookings } from "@/lib/mock/bookings-and-dashboard";
import { getCenters, getPricingByCenter } from "@/lib/mock/centers-and-pricing";
import { getLiveUsers } from "@/lib/mock/live-users";
import { getClients } from "@/lib/mock/clients";
import type {
  DashboardGraphComputedData,
  DashboardGraphConfig,
  DashboardGraphDataPoint,
  DashboardGraphFieldOption,
  DashboardGraphMapPoint,
  DashboardGraphScatterPoint,
  DashboardGraphSource,
  DashboardGraphSourceOption,
  DashboardGraphTimeGranularity,
  DashboardGraphValueFormat,
} from "@/lib/types";

type GenericRow = Record<string, string | number | boolean | null | undefined>;

const SOURCE_OPTIONS: DashboardGraphSourceOption[] = [
  {
    source: "bookings",
    label: "Bookings",
    fields: [
      { key: "status", label: "Status", kind: "dimension" },
      { key: "channel", label: "Channel", kind: "dimension" },
      { key: "source", label: "Source", kind: "dimension" },
      { key: "centerId", label: "Center", kind: "dimension" },
      { key: "createdAt", label: "Created at", kind: "dimension" },
      { key: "amount", label: "Amount", kind: "metric" },
    ],
  },
  {
    source: "pricing",
    label: "Pricing",
    fields: [
      { key: "centerId", label: "Center", kind: "dimension" },
      { key: "trend", label: "Trend", kind: "dimension" },
      { key: "updatedAt", label: "Updated at", kind: "dimension" },
      { key: "currentPrice", label: "Current price", kind: "metric" },
      { key: "availabilityCount", label: "Availability", kind: "metric" },
      { key: "totalUnits", label: "Total units", kind: "metric" },
    ],
  },
  {
    source: "liveUsers",
    label: "Live users",
    fields: [
      { key: "deviceType", label: "Device", kind: "dimension" },
      { key: "currentCenterId", label: "Center", kind: "dimension" },
      { key: "page", label: "Page", kind: "dimension" },
      { key: "lastSeenAt", label: "Last seen", kind: "dimension" },
      { key: "sessionDurationMin", label: "Session duration (min)", kind: "metric" },
    ],
  },
  {
    source: "clients",
    label: "Clients",
    fields: [
      { key: "status", label: "Status", kind: "dimension" },
      { key: "segment", label: "Segment", kind: "dimension" },
      { key: "preferredCenterId", label: "Preferred center", kind: "dimension" },
      { key: "createdAt", label: "Created at", kind: "dimension" },
      { key: "ageDays", label: "Client age (days)", kind: "metric" },
    ],
  },
  {
    source: "external",
    label: "External (connector)",
    fields: [],
  },
];

export function getGraphSourceOptions(): DashboardGraphSourceOption[] {
  return SOURCE_OPTIONS;
}

function toRowsSync(source: DashboardGraphSource): GenericRow[] {
  if (source === "bookings") {
    return getBookings().map((b) => ({
      id: b.id,
      status: b.status,
      channel: b.channel,
      source: b.source,
      centerId: b.centerId,
      amount: b.amount,
      createdAt: b.createdAt,
    }));
  }

  if (source === "pricing") {
    return getPricingByCenter().map((p) => ({
      id: p.id,
      centerId: p.centerId,
      trend: p.trend,
      currentPrice: p.currentPrice,
      availabilityCount: p.availabilityCount,
      totalUnits: p.totalUnits,
      updatedAt: p.lastUpdated,
    }));
  }

  if (source === "liveUsers") {
    return getLiveUsers().map((u) => {
      const start = new Date(u.startedAt).getTime();
      const end = new Date(u.lastSeenAt).getTime();
      return {
        id: u.id,
        deviceType: u.deviceType,
        currentCenterId: u.currentCenterId ?? "unknown",
        page: u.page,
        lastSeenAt: u.lastSeenAt,
        sessionDurationMin: Math.max(1, Math.round((end - start) / (1000 * 60))),
      };
    });
  }

  return getClients().map((c) => ({
    id: c.id,
    status: c.status,
    segment: c.segment ?? "unknown",
    preferredCenterId: c.preferredCenterId ?? "unknown",
    createdAt: c.createdAt,
    ageDays: Math.max(
      1,
      Math.round((Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    ),
  }));
}

async function toRows(
  source: DashboardGraphSource,
  connectorId?: string,
  externalTable?: string
): Promise<GenericRow[]> {
  if (source === "external") {
    if (!connectorId || !externalTable) return [];
    const { readConnectorRows } = await import("@/lib/connector-runtime");
    const result = await readConnectorRows({
      preferredConnectorId: connectorId,
      table: externalTable,
      limit: 500,
    });
    return result.rows as unknown as GenericRow[];
  }
  return toRowsSync(source);
}

async function applyJoinConfig(config: DashboardGraphConfig, baseRows: GenericRow[]): Promise<GenericRow[]> {
  if (!config.join?.enabled) return baseRows;

  const joinSourceRows = await toRows(config.join.source);
  const rightIndex = new Map<string, GenericRow[]>();

  joinSourceRows.forEach((row) => {
    const key = String(row[config.join!.rightKey] ?? "").trim();
    if (!key) return;
    const existing = rightIndex.get(key) ?? [];
    existing.push(row);
    rightIndex.set(key, existing);
  });

  const joinedRows: GenericRow[] = [];

  baseRows.forEach((leftRow) => {
    const leftValue = String(leftRow[config.join!.leftKey] ?? "").trim();
    const rightRows = leftValue ? rightIndex.get(leftValue) ?? [] : [];

    if (rightRows.length === 0) {
      joinedRows.push(leftRow);
      return;
    }

    rightRows.forEach((rightRow) => {
      const merged: GenericRow = { ...leftRow };
      Object.entries(rightRow).forEach(([key, value]) => {
        merged[`join.${key}`] = value;
      });
      joinedRows.push(merged);
    });
  });

  return joinedRows;
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatValue(value: number, format: DashboardGraphValueFormat): string {
  if (format === "currency") {
    return value.toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  }

  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }

  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatTimeBucket(date: Date, granularity: DashboardGraphTimeGranularity): string {
  if (granularity === "day") {
    return date.toISOString().slice(0, 10);
  }

  if (granularity === "week") {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildMapPoints(config: DashboardGraphConfig, rows: GenericRow[]): DashboardGraphMapPoint[] {
  const centersById = new Map(getCenters().map((center) => [center.id, center]));
  const grouped = new Map<string, { count: number; sum: number }>();
  const centerKey = config.groupBy?.toLowerCase().includes("center")
    ? config.groupBy
    : config.source === "liveUsers"
    ? "currentCenterId"
    : config.source === "clients"
    ? "preferredCenterId"
    : "centerId";

  rows.forEach((row) => {
    const centerId = String(row[centerKey] ?? "");
    if (!centerId) return;

    const existing = grouped.get(centerId) ?? { count: 0, sum: 0 };
    existing.count += 1;
    existing.sum += toNumber(row[config.metricField ?? ""]);
    grouped.set(centerId, existing);
  });

  const points = Array.from(grouped.entries())
    .map(([centerId, value]) => {
      const center = centersById.get(centerId);
      if (!center || center.latitude == null || center.longitude == null) return null;

      const computedValue =
        config.aggregation === "count"
          ? value.count
          : config.aggregation === "avg"
          ? value.count > 0
            ? value.sum / value.count
            : 0
          : value.sum;

      return {
        id: center.id,
        label: center.city,
        latitude: center.latitude,
        longitude: center.longitude,
        value: computedValue,
      } as DashboardGraphMapPoint;
    })
    .filter((point): point is DashboardGraphMapPoint => !!point);

  return points
    .sort((left, right) => right.value - left.value)
    .slice(0, Math.max(1, config.limit || 8));
}

export async function computeGraphData(config: DashboardGraphConfig): Promise<DashboardGraphComputedData> {
  const sourceRows = await applyJoinConfig(
    config,
    await toRows(config.source, config.connectorId, config.externalTable)
  );

  const dateFrom = config.dateFrom ? new Date(config.dateFrom).getTime() : null;
  const dateTo = config.dateTo ? new Date(config.dateTo).getTime() : null;
  const timeField = config.timeField;

  const filteredRows = sourceRows.filter((row) => {
    const passesFilters =
      !config.filters ||
      config.filters.length === 0 ||
      config.filters.every((rule) => {
      const left = String(row[rule.field] ?? "").toLowerCase();
      const right = String(rule.value ?? "").toLowerCase();
      if (!right) return true;
      return left.includes(right);
    });

    if (!passesFilters) return false;

    if (!timeField || (!dateFrom && !dateTo)) return true;
    const date = toDate(row[timeField]);
    if (!date) return false;
    const time = date.getTime();

    if (dateFrom && time < dateFrom) return false;
    if (dateTo && time > dateTo) return false;

    return true;
  });

  if (config.chartType === "map") {
    const mapPoints = buildMapPoints(config, filteredRows);
    const total = mapPoints.reduce((acc, point) => acc + point.value, 0);

    return {
      points: mapPoints.map((point) => ({ label: point.label, value: point.value })),
      scatterPoints: [],
      mapPoints,
      totalValue: total,
      formattedTotalValue: formatValue(total, config.valueFormat),
      tableRows: mapPoints.map((point) => ({
        center: point.label,
        latitude: point.latitude,
        longitude: point.longitude,
        value: point.value,
      })),
    };
  }

  if (config.chartType === "kpi") {
    const total =
      config.aggregation === "count"
        ? filteredRows.length
        : config.aggregation === "avg"
        ? filteredRows.length > 0
          ? filteredRows.reduce((acc, row) => acc + toNumber(row[config.metricField ?? ""]), 0) /
            filteredRows.length
          : 0
        : filteredRows.reduce((acc, row) => acc + toNumber(row[config.metricField ?? ""]), 0);

    return {
      points: [{ label: "value", value: total }],
      scatterPoints: [],
      mapPoints: [],
      totalValue: total,
      formattedTotalValue: formatValue(total, config.valueFormat),
      tableRows: [
        {
          source: config.source,
          aggregation: config.aggregation,
          value: formatValue(total, config.valueFormat),
        },
      ],
    };
  }

  if (config.chartType === "scatter") {
    const xField = config.xField ?? config.metricField ?? "";
    const yField = config.yField ?? config.metricField ?? "";
    const scatterPoints: DashboardGraphScatterPoint[] = filteredRows
      .map((row, idx) => ({
        label: String(row[config.groupBy ?? "id"] ?? `P${idx + 1}`),
        x: toNumber(row[xField]),
        y: toNumber(row[yField]),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .slice(0, Math.max(1, Math.min(config.limit || 20, 120)));

    const total = scatterPoints.reduce((acc, point) => acc + point.y, 0);

    return {
      points: [],
      scatterPoints,
      mapPoints: [],
      totalValue: total,
      formattedTotalValue: formatValue(total, config.valueFormat),
      tableRows: scatterPoints.map((point) => ({
        label: point.label,
        x: point.x,
        y: point.y,
      })),
    };
  }

  const useTimeBuckets = !!config.timeField;
  const groupKey = useTimeBuckets ? config.timeField! : config.groupBy ?? "id";
  const granularity = config.timeGranularity ?? "month";
  const grouped = new Map<string, { sum: number; count: number }>();

  filteredRows.forEach((row) => {
    let label = String(row[groupKey] ?? "Unknown");
    if (useTimeBuckets) {
      const rowDate = toDate(row[groupKey]);
      if (!rowDate) return;
      label = formatTimeBucket(rowDate, granularity);
    }

    const existing = grouped.get(label) ?? { sum: 0, count: 0 };
    existing.count += 1;
    existing.sum += toNumber(row[config.metricField ?? ""]);

    grouped.set(label, existing);
  });

  let points: DashboardGraphDataPoint[] = Array.from(grouped.entries()).map(([label, value]) => ({
    label,
    value:
      config.aggregation === "count"
        ? value.count
        : config.aggregation === "avg"
        ? value.count > 0
          ? value.sum / value.count
          : 0
        : value.sum,
  }));

  points = points.sort((a, b) => {
    if (useTimeBuckets) {
      return config.sortDirection === "asc"
        ? a.label.localeCompare(b.label)
        : b.label.localeCompare(a.label);
    }

    return config.sortDirection === "asc" ? a.value - b.value : b.value - a.value;
  });

  points = points.slice(0, Math.max(1, config.limit || 8));

  const totalValue = points.reduce((acc, point) => acc + point.value, 0);

  return {
    points,
    scatterPoints: [],
    mapPoints: [],
    totalValue,
    formattedTotalValue: formatValue(totalValue, config.valueFormat),
    tableRows: points.map((point) => ({
      label: point.label,
      value: point.value,
      formattedValue: formatValue(point.value, config.valueFormat),
    })),
  };
}

export function getFieldsForSource(
  source: DashboardGraphSource,
  externalFields?: DashboardGraphFieldOption[]
): DashboardGraphFieldOption[] {
  if (source === "external" && externalFields) return externalFields;
  return SOURCE_OPTIONS.find((option) => option.source === source)?.fields ?? [];
}
