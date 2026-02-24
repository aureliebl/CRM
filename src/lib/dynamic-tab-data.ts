import { getBookings } from "@/lib/mock/bookings-and-dashboard";
import { getCenters } from "@/lib/mock/centers-and-pricing";
import { getClients } from "@/lib/mock/clients";
import { readConnectorRows } from "@/lib/connector-runtime";
import { evaluateExpression } from "@/lib/expression-evaluator";
import type { DynamicTabConfig, DynamicTabSource, DynamicTabMultiJoinEntry } from "@/lib/types";

type GenericRow = Record<string, string | number | boolean | null | undefined>;

function getSourceRows(source: DynamicTabSource): GenericRow[] {
  if (source === "centers") return getCenters() as unknown as GenericRow[];
  if (source === "clients") return getClients() as unknown as GenericRow[];
  if (source === "bookings") return getBookings() as unknown as GenericRow[];
  return [];
}

function getJoinRows(source: "clients" | "centers"): GenericRow[] {
  if (source === "clients") return getClients() as unknown as GenericRow[];
  return getCenters() as unknown as GenericRow[];
}

function getBuiltinOrJoinRows(table: string): GenericRow[] {
  if (table === "clients") return getClients() as unknown as GenericRow[];
  if (table === "centers") return getCenters() as unknown as GenericRow[];
  if (table === "bookings") return getBookings() as unknown as GenericRow[];
  return [];
}

function coerceValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  // Handle Date objects and BigQuery Timestamp/Date wrappers
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value !== null) {
    // BigQuery returns { value: "..." } wrappers for dates/timestamps
    const obj = value as Record<string, unknown>;
    if ("value" in obj && (typeof obj.value === "string" || typeof obj.value === "number")) {
      return String(obj.value);
    }
  }
  return String(value);
}

export async function resolveDynamicTabRows(config: DynamicTabConfig): Promise<GenericRow[]> {
  const baseRows =
    config.source === "external"
      ? (
          await readConnectorRows({
            preferredConnectorId: config.connectorId,
            table: config.externalTable || "",
            limit: 500,
          })
        ).rows
      : getSourceRows(config.source);

  let rows = [...baseRows];

  if (config.join?.enabled) {
    const joinRows = getJoinRows(config.join.source);
    const index = new Map<string, GenericRow>();
    for (const joinRow of joinRows) {
      const key = String(joinRow[config.join.rightKey] ?? "");
      if (!key) continue;
      index.set(key, joinRow);
    }

    rows = rows.map((row) => {
      const left = String(row[config.join!.leftKey] ?? "");
      const joined = index.get(left);
      if (!joined) return { ...row };

      const prefixed = Object.entries(joined).reduce((acc, [key, value]) => {
        acc[`join_${key}`] = value;
        return acc;
      }, {} as GenericRow);

      return {
        ...row,
        ...prefixed,
      };
    });
  }

  // Multi-join support: apply each join entry sequentially
  if (config.joins && config.joins.length > 0) {
    for (const joinEntry of config.joins) {
      const isExternal = config.source === "external" && config.connectorId;
      let joinTableRows: GenericRow[];
      if (isExternal) {
        const result = await readConnectorRows({
          preferredConnectorId: config.connectorId,
          table: joinEntry.table,
          limit: 500,
        });
        joinTableRows = result.rows as GenericRow[];
      } else {
        joinTableRows = getBuiltinOrJoinRows(joinEntry.table);
      }

      const rightIndex = new Map<string, GenericRow>();
      for (const jr of joinTableRows) {
        const rk = String(jr[joinEntry.rightKey] ?? "");
        if (rk) rightIndex.set(rk, jr);
      }

      const prefix = `j${joinEntry.id}_`;
      const selectedCols = joinEntry.columns.length > 0 ? joinEntry.columns : null;

      // Find leftKeys from subsequent joins that reference this join's columns
      const neededKeys = new Set<string>();
      if (config.joins) {
        const thisIdx = config.joins.indexOf(joinEntry);
        for (let ni = thisIdx + 1; ni < config.joins.length; ni++) {
          const nextLeft = config.joins[ni].leftKey;
          if (nextLeft.startsWith(prefix)) {
            neededKeys.add(nextLeft.slice(prefix.length));
          }
        }
      }

      rows = rows.map((row) => {
        const leftVal = String(row[joinEntry.leftKey] ?? "");
        const matched = leftVal ? rightIndex.get(leftVal) : undefined;
        if (!matched) return row;

        const extra: GenericRow = {};
        for (const [k, v] of Object.entries(matched)) {
          if (selectedCols && !selectedCols.includes(k) && !neededKeys.has(k)) continue;
          extra[`${prefix}${k}`] = v;
        }
        return { ...row, ...extra };
      });
    }
  }

  // Compute calculated fields
  if (config.computedColumns && config.computedColumns.length > 0) {
    rows = rows.map((row) => {
      const extended = { ...row };
      for (const comp of config.computedColumns!) {
        extended[`_computed_${comp.id}`] = evaluateExpression(comp.expression, extended as Record<string, string | number | boolean | null | undefined>) as string | number | boolean | null | undefined;
      }
      return extended;
    });
  }

  return rows.map((row) => {
    const normalized: GenericRow = {};

    normalized.id = String(row.id ?? row[config.rowNavigation?.idField || "id"] ?? Math.random());

    for (const column of config.columns) {
      normalized[column.key] = coerceValue(row[column.sourceField]);
    }

    // Add computed columns to output
    if (config.computedColumns) {
      for (const comp of config.computedColumns) {
        normalized[`_computed_${comp.id}`] = coerceValue(row[`_computed_${comp.id}`]);
      }
    }

    const rowIdField = config.rowNavigation?.idField;
    if (rowIdField) {
      normalized.__rowId = coerceValue(row[rowIdField]);
    }

    return normalized;
  });
}
