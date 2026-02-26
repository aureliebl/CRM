import { NextRequest, NextResponse } from "next/server";
import {
  createGraph,
  duplicateSharedGraphForUser,
  listGraphsByOwner,
  listSharedGraphs,
} from "@/lib/dashboard-graph-store";
import { computeGraphData } from "@/lib/dashboard-graph-data";
import type { DashboardGraphConfig, DashboardGraphSize } from "@/lib/types";

export const dynamic = "force-dynamic";

async function withComputed(graph: any) {
  return {
    ...graph,
    computedData: await computeGraphData(graph.config),
  };
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") ?? "";
  const includeShared = req.nextUrl.searchParams.get("includeShared") === "1";

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const ownGraphs = await Promise.all((await listGraphsByOwner(userId)).map(withComputed));
  if (!includeShared) {
    return NextResponse.json(ownGraphs);
  }

  const sharedGraphs = await Promise.all((await listSharedGraphs()).filter((graph) => graph.ownerUserId !== userId).map(withComputed));

  return NextResponse.json({ own: ownGraphs, shared: sharedGraphs });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = String(body.userId ?? "").trim();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (body.importGraphId) {
    const duplicated = await duplicateSharedGraphForUser({
      graphId: String(body.importGraphId),
      ownerUserId: userId,
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

  const currentUserGraphs = await listGraphsByOwner(userId);

  const created = await createGraph({
    ownerUserId: userId,
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
