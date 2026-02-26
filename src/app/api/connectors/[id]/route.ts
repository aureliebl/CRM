import { NextResponse } from "next/server";
import { deleteConnector, getConnectorConfig, getConnectors, updateConnector } from "@/lib/connectors-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const connector = (await getConnectors()).find((item) => item.id === id);
  if (!connector) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = (await getConnectorConfig(id)) as
    | { projectId?: string; dataset?: string; serviceAccountJson?: string }
    | null;

  return NextResponse.json({
    ...connector,
    config: {
      projectId: config?.projectId,
      dataset: config?.dataset,
      hasServiceAccount: !!config?.serviceAccountJson,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const updated = await updateConnector(id, {
    name: body.name,
    enabled: body.enabled,
    config:
      body.projectId || body.dataset || body.serviceAccountJson
        ? {
            projectId: body.projectId,
            dataset: body.dataset,
            serviceAccountJson: body.serviceAccountJson,
          }
        : undefined,
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await deleteConnector(id);
  return NextResponse.json({ ok: true });
}
