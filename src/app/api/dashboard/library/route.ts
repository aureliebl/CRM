import { NextResponse } from "next/server";
import { listSharedGraphs } from "@/lib/dashboard-graph-store";
import { computeGraphData } from "@/lib/dashboard-graph-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const graphs = await Promise.all(
    (await listSharedGraphs()).map(async (graph) => ({
      ...graph,
      computedData: await computeGraphData(graph.config),
    }))
  );

  return NextResponse.json(graphs);
}
