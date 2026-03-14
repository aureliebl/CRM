import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const account = await getActorFromRequest(req);
  if (!account) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const isSuperAdmin = isAccountSuperAdmin(account);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      isSuperAdmin,
    },
  });
}
