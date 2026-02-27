import { NextRequest, NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { computeGraphData } from "@/lib/dashboard-graph-data";
import {
  deleteGraph,
  getGraphById,
  updateGraph,
} from "@/lib/dashboard-graph-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import { getExpectedUpdatedAt, isStaleWrite } from "@/lib/optimistic-concurrency";
import type { DashboardGraphConfig, DashboardGraphSize } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function withComputed(graph: any) {
  return {
    ...graph,
    computedData: await computeGraphData(graph.config),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const graph = await getGraphById(id);

  if (!graph) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adminMode = await isActorAdmin(req);
  if (!adminMode && graph.ownerUserId !== actorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(await withComputed(graph));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const graph = await getGraphById(id);

  if (!graph) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adminMode = await isActorAdmin(req);
  if (!adminMode && actorId !== graph.ownerUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expectedUpdatedAt = getExpectedUpdatedAt(req, body);
  if (isStaleWrite(expectedUpdatedAt, graph.updatedAt ?? null)) {
    return NextResponse.json({ error: "Conflict: resource has been modified", code: "CONFLICT" }, { status: 409 });
  }

  const updated = await updateGraph(id, {
    title: body.title ? String(body.title) : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    size: body.size as DashboardGraphSize,
    layoutOrder: Number.isFinite(Number(body.layoutOrder)) ? Number(body.layoutOrder) : undefined,
    isShared: typeof body.isShared === "boolean" ? body.isShared : undefined,
    config: body.config as DashboardGraphConfig,
  });

  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }

  await addLog(actorId, "dashboard_graph.updated", `Graph ${id} updated by ${actorId}`);

  return NextResponse.json(await withComputed(updated));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const graph = await getGraphById(id);

  if (!graph) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adminMode = await isActorAdmin(req);
  if (!adminMode && actorId !== graph.ownerUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteGraph(id);
  await addLog(actorId, "dashboard_graph.deleted", `Graph ${id} deleted by ${actorId}`);
  return NextResponse.json({ ok: true });
}
