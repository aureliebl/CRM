import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount } from "@/lib/security-store";
import { getTabBySlug, getTabsForGroup } from "@/lib/tabs-store";

export const dynamic = "force-dynamic";

interface ActionPayload {
  actionId: string;
  rowId: string;
  /** For db-update: new value */
  newValue?: string;
}

/**
 * POST /api/tabs/slug/{slug}/actions
 * Executes a row action (db-update, db-delete, api-call).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorId = actor.id;
  const superAdminMode = isAccountSuperAdmin(actor);

  const { slug } = await params;
  const tab = await getTabBySlug(slug);
  if (!tab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (tab.superAdminOnly && !superAdminMode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!tab.enabled && !superAdminMode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Permission check
  if (!superAdminMode && actor.role !== "admin") {
    const groupId = await getGroupIdForAccount(actorId);
    if (!groupId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const allowed = (await getTabsForGroup(groupId)).some((item) => item.id === tab.id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ActionPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { actionId, rowId, newValue } = body;
  if (!actionId || !rowId) {
    return NextResponse.json({ error: "actionId and rowId are required" }, { status: 400 });
  }

  const action = tab.config.rowActions?.find((a) => a.id === actionId);
  if (!action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  const actionType = action.type ?? "navigate";

  try {
    if (actionType === "db-update") {
      if (!action.targetField) {
        return NextResponse.json({ error: "targetField not configured" }, { status: 400 });
      }

      // For external connector sources, update via connector
      if (tab.config.source === "external" && tab.config.connectorId) {
        const { readConnectorRows } = await import("@/lib/connector-runtime");
        // Note: actual UPDATE operations would require connector write support.
        // For now return a simulated success for external sources.
        return NextResponse.json({
          success: true,
          message: `Would update ${action.targetField} = ${newValue} on row ${rowId} in ${tab.config.externalTable}`,
          simulated: true,
        });
      }

      // For built-in sources, we don't actually have write access to mock data,
      // so return a simulated success.
      return NextResponse.json({
        success: true,
        message: `Would update ${action.targetField} = ${newValue} on row ${rowId} in source ${tab.config.source}`,
        simulated: true,
      });
    }

    if (actionType === "db-delete") {
      // Similar — simulated for now
      return NextResponse.json({
        success: true,
        message: `Would delete row ${rowId} from source ${tab.config.source}`,
        simulated: true,
      });
    }

    if (actionType === "api-call") {
      if (!action.apiUrl) {
        return NextResponse.json({ error: "apiUrl not configured" }, { status: 400 });
      }

      // Forward the call to the external API
      const externalRes = await fetch(action.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId, actionId, tabSlug: slug }),
      });

      const responseBody = await externalRes.text();
      return NextResponse.json({
        success: externalRes.ok,
        status: externalRes.status,
        response: responseBody.slice(0, 2000),
      });
    }

    // navigate type — no server action needed
    return NextResponse.json({ error: "Navigate actions are client-side only" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
