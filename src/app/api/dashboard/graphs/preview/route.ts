import { NextRequest, NextResponse } from "next/server";
import { computeGraphData } from "@/lib/dashboard-graph-data";
import type { DashboardGraphConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = body.config as DashboardGraphConfig;

    if (!config || !config.source || !config.chartType) {
      return NextResponse.json({ error: "Invalid config" }, { status: 400 });
    }

    const computedData = await computeGraphData(config);

    return NextResponse.json(computedData);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Compute failed" },
      { status: 500 }
    );
  }
}
