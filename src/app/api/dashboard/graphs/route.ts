import { NextRequest, NextResponse } from "next/server";
import {
  createGraph,
  duplicateSharedGraphForUser,
  listGraphsByOwner,
  listSharedGraphs,
} from "@/lib/dashboard-graph-store";
import { computeGraphData } from "@/lib/dashboard-graph-data";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import type { DashboardGraphConfig, DashboardGraphSize } from "@/lib/types";

export const dynamic = "force-dynamic";

async function withComputed(graph: any) {
  return {
    ...graph,
    computedData: await computeGraphData(graph.config),
  };
}

export async function GET(req: NextRequest) {
  const actorId = getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedUserId = req.nextUrl.searchParams.get("userId") ?? actorId;
  const includeShared = req.nextUrl.searchParams.get("includeShared") === "1";

  const adminMode = await isActorAdmin(req);
  if (!adminMode && requestedUserId !== actorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownGraphs = await Promise.all((await listGraphsByOwner(requestedUserId)).map(withComputed));
  if (!includeShared) {
    return NextResponse.json(ownGraphs);
  }

  const sharedGraphs = await Promise.all((await listSharedGraphs()).filter((graph) => graph.ownerUserId !== requestedUserId).map(withComputed));

  return NextResponse.json({ own: ownGraphs, shared: sharedGraphs });
}

export async function POST(req: NextRequest) {
  const actorId = getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetOwnerId = String(body.userId ?? actorId).trim() || actorId;
  const adminMode = await isActorAdmin(req);

  if (!adminMode && targetOwnerId !== actorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.importGraphId) {
    const duplicated = await duplicateSharedGraphForUser({
      graphId: String(body.importGraphId),
      ownerUserId: targetOwnerId,
    });

    if (!duplicated) {
      return NextResponse.json({ error: "Shared graph not found" }, { status: 404 });
    }

    return NextResponse.json(await withComputed(duplicated), { status: 201 });
  }

  const config = body.config as DashboardGraphConfig;

  if (!config || !config.source || !config.chartType) {
    return NextResponse.json({ error: "Invalid config" }, { status: 400 });
  }

  const currentUserGraphs = await listGraphsByOwner(targetOwnerId);

  const created = await createGraph({
    ownerUserId: targetOwnerId,
    title: String(body.title ?? "Graphique"),
    description: body.description ? String(body.description) : undefined,
    size: (body.size as DashboardGraphSize) ?? "M",
    layoutOrder: Number.isFinite(Number(body.layoutOrder))
      ? Number(body.layoutOrder)
      : currentUserGraphs.length,
    isShared: !!body.isShared,
    config,
  });

  return NextResponse.json(await withComputed(created), { status: 201 });
}
