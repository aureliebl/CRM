import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { exportAllVaultEntries } from "@/lib/vault-store";
import { addLog } from "@/lib/account-store";

export const dynamic = "force-dynamic";

/* GET /api/vault/export — super admin only, all entries decrypted */
export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";

  const entries = await exportAllVaultEntries();

  await addLog(actor.id, "vault_export", `Exported all vault entries (format: ${format})`);

  if (format === "csv") {
    const header = "service_name,service_url,login,password,notes,totp_secrets\n";
    const rows = (entries as Record<string, unknown>[])
      .map((e) => {
        const totpSecrets = Array.isArray(e.totp)
          ? (e.totp as Array<{ secret: string }>).map((t) => t.secret).join(";")
          : "";
        return [
          `"${String(e.serviceName ?? "").replace(/"/g, '""')}"`,
          `"${String(e.serviceUrl ?? "").replace(/"/g, '""')}"`,
          `"${String(e.login ?? "").replace(/"/g, '""')}"`,
          `"${String(e.password ?? "").replace(/"/g, '""')}"`,
          `"${String(e.notes ?? "").replace(/"/g, '""')}"`,
          `"${totpSecrets.replace(/"/g, '""')}"`,
        ].join(",");
      })
      .join("\n");

    return new Response(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vault-export-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json(entries);
}
