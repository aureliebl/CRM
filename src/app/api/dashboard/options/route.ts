import { NextResponse } from "next/server";
import { getGraphSourceOptions } from "@/lib/dashboard-graph-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getGraphSourceOptions());
}
