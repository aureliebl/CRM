import { NextResponse } from "next/server";
import {
  getActorFromRequest,
  isAccountSuperAdmin,
} from "@/lib/server-permissions";
import {
  canActorAccessEntry,
  addTotp,
  getTotpForEntryForActor,
  isActorEntryCreator,
} from "@/lib/vault-store";
import { addLog } from "@/lib/account-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/* GET /api/vault/:id/totp — get decrypted TOTP secrets */
export async function GET(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccess = await canActorAccessEntry(actor, id);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const totps = await getTotpForEntryForActor(id, actor);
  return NextResponse.json(totps);
}

/* POST /api/vault/:id/totp — add a TOTP (admin+) */
export async function POST(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    const isCreator = await isActorEntryCreator(actor, id);
    if (!isCreator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const { label, secret, algorithm, digits, period } = body;

  if (!secret || typeof secret !== "string" || secret.length < 16) {
    return NextResponse.json(
      { error: "A valid Base32 secret (min 16 chars) is required" },
      { status: 400 }
    );
  }

  const result = await addTotp(id, {
    label,
    secret,
    algorithm,
    digits,
    period,
  });

  await addLog(actor.id, "vault_totp_add", `Added TOTP to vault entry ${id}`);

  return NextResponse.json(result, { status: 201 });
}
