import { NextResponse } from "next/server";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount } from "@/lib/security-store";
import { getTabBySlug, getTabsForGroup } from "@/lib/tabs-store";
import { resolveDynamicTabRows } from "@/lib/dynamic-tab-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/tabs/slug/{slug}/rows/{rowId}
 * Returns a single row (all raw fields) from the tab's data source.
 * Used by the detail sub-page.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; rowId: string }> }
) {
  const actorId = getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, rowId } = await params;
  const tab = getTabBySlug(slug);
  if (!tab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isActorAdmin(req)) {
    const groupId = getGroupIdForAccount(actorId);
    if (!groupId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const allowed = getTabsForGroup(groupId).some((item) => item.id === tab.id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allRows = await resolveDynamicTabRows(tab.config);

  // Find the row matching the requested rowId
  const idField = tab.config.detailPage?.idField ?? tab.config.rowNavigation?.idField ?? "id";
  const row = allRows.find((r) => {
    const rowVal = r.__rowId ?? r[idField] ?? r.id;
    return String(rowVal) === rowId;
  });

  if (!row) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  return NextResponse.json({ row, config: tab.config });
}
