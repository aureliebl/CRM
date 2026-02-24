import { NextResponse } from "next/server";
import { isActorAdmin } from "@/lib/server-permissions";
import { resolveDynamicTabRows } from "@/lib/dynamic-tab-data";
import type { DynamicTabConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/tabs/preview
 * Accepts a DynamicTabConfig in the body and returns resolved rows.
 * Used during tab creation to preview data before saving.
 */
export async function POST(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { config?: DynamicTabConfig };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.config || !body.config.source) {
    return NextResponse.json({ error: "config.source is required" }, { status: 400 });
  }

  try {
    const rows = await resolveDynamicTabRows(body.config);
    // Limit preview to 50 rows
    return NextResponse.json({ rows: rows.slice(0, 50) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
