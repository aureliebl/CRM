import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { deleteConnector, getConnectorConfig, getConnectors, updateConnector } from "@/lib/connectors-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import { getExpectedUpdatedAt, isStaleWrite } from "@/lib/optimistic-concurrency";

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

  const actorId = await getActorIdFromRequest(req);
  const { id } = await params;
  const body = await req.json();
  const existing = (await getConnectors()).find((item) => item.id === id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const expectedUpdatedAt = getExpectedUpdatedAt(req, body);
  if (isStaleWrite(expectedUpdatedAt, existing.updatedAt ?? null)) {
    return NextResponse.json({ error: "Conflict: resource has been modified", code: "CONFLICT" }, { status: 409 });
  }

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
  if (actorId) {
    await addLog(actorId, "connector.updated", `Connector ${id} updated by ${actorId}`);
  }
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const { id } = await params;
  await deleteConnector(id);
  if (actorId) {
    await addLog(actorId, "connector.deleted", `Connector ${id} deleted by ${actorId}`);
  }
  return NextResponse.json({ ok: true });
}
