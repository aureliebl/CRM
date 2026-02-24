import { NextRequest, NextResponse } from "next/server";
import { computeGraphData } from "@/lib/dashboard-graph-data";
import {
  deleteGraph,
  getGraphById,
  updateGraph,
} from "@/lib/dashboard-graph-store";
import type { DashboardGraphConfig, DashboardGraphSize } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function withComputed(graph: any) {
  return {
    ...graph,
    computedData: await computeGraphData(graph.config),
  };
}

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const graph = getGraphById(id);

  if (!graph) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(await withComputed(graph));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const graph = getGraphById(id);

  if (!graph) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requesterUserId = String(body.userId ?? "").trim();
  if (!requesterUserId || requesterUserId !== graph.ownerUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = updateGraph(id, {
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

  return NextResponse.json(await withComputed(updated));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const graph = getGraphById(id);

  if (!graph) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requesterUserId = req.nextUrl.searchParams.get("userId") ?? "";
  if (!requesterUserId || requesterUserId !== graph.ownerUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  deleteGraph(id);
  return NextResponse.json({ ok: true });
}
