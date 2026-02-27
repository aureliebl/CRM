import { NextResponse } from "next/server";
import { createConnector, getConnectors, getConnectorConfig } from "@/lib/connectors-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import type { DataConnectorProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allConnectors = await getConnectors();
  const connectors = await Promise.all(allConnectors.map(async (connector) => {
    const config = (await getConnectorConfig(connector.id)) as
      | { projectId?: string; dataset?: string; serviceAccountJson?: string }
      | null;

    return {
      ...connector,
      config: {
        projectId: config?.projectId,
        dataset: config?.dataset,
        hasServiceAccount: !!config?.serviceAccountJson,
      },
    };
  }));
  return NextResponse.json(connectors);
}

export async function POST(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name || (body.provider !== "bigquery" && body.provider !== "mock")) {
    return NextResponse.json({ error: "Invalid connector payload" }, { status: 400 });
  }

  const provider = body.provider as DataConnectorProvider;

  const created = await createConnector({
    name: body.name,
    provider,
    config:
      provider === "bigquery"
        ? {
            projectId: body.projectId,
            dataset: body.dataset,
            serviceAccountJson: body.serviceAccountJson,
          }
        : {
            preset: "internal-mock",
          },
    createdBy: actorId,
  });

  return NextResponse.json(created, { status: 201 });
}
