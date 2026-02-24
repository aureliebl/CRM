import { getBookings } from "@/lib/mock/bookings-and-dashboard";
import { getCenters } from "@/lib/mock/centers-and-pricing";
import { getClients } from "@/lib/mock/clients";
import { getActiveConnector, getConnectorConfig } from "@/lib/connectors-store";
import type { DataConnector } from "@/lib/types";

type GenericRow = Record<string, unknown>;

export interface ConnectorColumnSchema {
  name: string;
  type: string;
}

function getMockTableRows(table: string): GenericRow[] {
  if (table === "centers") return getCenters() as unknown as GenericRow[];
  if (table === "clients") return getClients() as unknown as GenericRow[];
  if (table === "bookings") return getBookings() as unknown as GenericRow[];
  return [];
}

function getMockTables() {
  return [
    { table: "centers", rowCount: getCenters().length },
    { table: "clients", rowCount: getClients().length },
    { table: "bookings", rowCount: getBookings().length },
  ];
}

function inferMockSchema(table: string): ConnectorColumnSchema[] {
  const rows = getMockTableRows(table);
  if (rows.length === 0) return [];

  const first = rows[0];
  return Object.keys(first).map((key) => {
    const value = first[key];
    const valueType = value instanceof Date ? "date" : typeof value;
    return {
      name: key,
      type: valueType,
    };
  });
}

function isValidIdentifier(value: string) {
  return /^[A-Za-z0-9_]+$/.test(value);
}

async function getBigQueryClient(config: { projectId?: string; serviceAccountJson?: string }) {
  const moduleName = "@google-cloud/bigquery";
  const pkg = (await import(moduleName)) as unknown as {
    BigQuery: new (args: {
      projectId?: string;
      credentials?: Record<string, unknown>;
    }) => {
      dataset: (datasetId: string) => {
        getTables: () => Promise<[Array<{ id?: string; metadata?: { numRows?: string }; getMetadata?: () => Promise<[ { numRows?: string } ]> }>]>
      };
      query: (args: { query: string; location?: string }) => Promise<[GenericRow[]]>;
    };
  };

  const credentials = config.serviceAccountJson
    ? (JSON.parse(config.serviceAccountJson) as Record<string, unknown>)
    : undefined;

  const client = new pkg.BigQuery({
    projectId: config.projectId,
    credentials,
  });

  return client;
}

export async function listConnectorTables(preferredConnectorId?: string) {
  const connector = getActiveConnector(preferredConnectorId);
  if (!connector) {
    return {
      connector: null,
      tables: [] as Array<{ table: string; rowCount?: number }>,
      error: "No active connector found",
    };
  }

  if (connector.provider === "mock") {
    return {
      connector,
      tables: getMockTables(),
    };
  }

  const config = (getConnectorConfig(connector.id) ?? {}) as {
    projectId?: string;
    dataset?: string;
    serviceAccountJson?: string;
  };

  if (!config.projectId || !config.dataset || !isValidIdentifier(config.dataset)) {
    return {
      connector,
      tables: [],
      error: "Invalid BigQuery configuration: projectId or dataset is missing/invalid",
    };
  }

  try {
    const bigquery = await getBigQueryClient(config);
    const dataset = bigquery.dataset(config.dataset);
    const [tables] = await dataset.getTables();

    const tableRows = await Promise.all(
      tables.map(async (table) => {
        const tableName = table.id || "";
        let rowCount: number | undefined = table.metadata?.numRows
          ? Number(table.metadata.numRows)
          : undefined;

        if (rowCount === undefined && table.getMetadata) {
          try {
            const [meta] = await table.getMetadata();
            rowCount = meta?.numRows ? Number(meta.numRows) : undefined;
          } catch {
            rowCount = undefined;
          }
        }

        return {
          table: tableName,
          rowCount: Number.isFinite(rowCount) ? rowCount : undefined,
        };
      })
    );

    return {
      connector,
      tables: tableRows,
    };
  } catch (error) {
    return {
      connector,
      tables: [],
      error: error instanceof Error ? error.message : "Failed to query BigQuery tables",
    };
  }
}

export async function readConnectorRows(input: {
  preferredConnectorId?: string;
  table: string;
  limit?: number;
}): Promise<{ connector: DataConnector | null; rows: GenericRow[] }> {
  const connector = getActiveConnector(input.preferredConnectorId);
  if (!connector) return { connector: null, rows: [] };

  const limit = Math.max(1, Math.min(input.limit ?? 200, 500));

  if (connector.provider === "mock") {
    return {
      connector,
      rows: getMockTableRows(input.table).slice(0, limit),
    };
  }

  const config = (getConnectorConfig(connector.id) ?? {}) as {
    projectId?: string;
    dataset?: string;
    serviceAccountJson?: string;
  };

  if (
    !config.projectId ||
    !config.dataset ||
    !isValidIdentifier(config.dataset) ||
    !isValidIdentifier(input.table)
  ) {
    return { connector, rows: [] };
  }

  try {
    const bigquery = await getBigQueryClient(config);
    const query = `SELECT * FROM \`${config.projectId}.${config.dataset}.${input.table}\` LIMIT ${limit}`;
    const [rows] = await bigquery.query({ query });
    return { connector, rows };
  } catch {
    return { connector, rows: [] };
  }
}

export async function getConnectorTableSchema(input: {
  preferredConnectorId?: string;
  table: string;
}): Promise<{ connector: DataConnector | null; columns: ConnectorColumnSchema[] }> {
  const connector = getActiveConnector(input.preferredConnectorId);
  if (!connector) return { connector: null, columns: [] };

  if (connector.provider === "mock") {
    return {
      connector,
      columns: inferMockSchema(input.table),
    };
  }

  const config = (getConnectorConfig(connector.id) ?? {}) as {
    projectId?: string;
    dataset?: string;
    serviceAccountJson?: string;
  };

  if (
    !config.projectId ||
    !config.dataset ||
    !isValidIdentifier(config.dataset) ||
    !isValidIdentifier(input.table)
  ) {
    return { connector, columns: [] };
  }

  try {
    const bigquery = await getBigQueryClient(config);
    const query = `SELECT column_name, data_type FROM \`${config.projectId}.${config.dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${input.table}' ORDER BY ordinal_position`;
    const [rows] = await bigquery.query({ query });

    return {
      connector,
      columns: rows
        .map((row) => ({
          name: String(row.column_name ?? ""),
          type: String(row.data_type ?? "unknown"),
        }))
        .filter((column) => column.name),
    };
  } catch {
    return { connector, columns: [] };
  }
}
