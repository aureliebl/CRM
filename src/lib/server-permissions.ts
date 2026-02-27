import { getAccountById } from "@/lib/account-store";
import { getSessionFromRequest } from "@/lib/server-session";

export async function getActorIdFromRequest(req: Request): Promise<string | null> {
  const actor = await getActorFromRequest(req);
  return actor?.id ?? null;
}

export async function getActorFromRequest(req: Request) {
  const session = getSessionFromRequest(req);
  if (session?.userId) {
    const account = await getAccountById(session.userId);
    if (!account) return null;
    if (!account.isActive) return null;
    if ((account.sessionVersion ?? 1) !== session.sessionVersion) return null;
    return account;
  }

  if (process.env.ALLOW_LEGACY_ACTOR_FALLBACK === "true") {
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("userId");
    if (fromQuery) {
      const account = await getAccountById(fromQuery);
      if (account && account.isActive) return account;
    }

    const fromHeader = req.headers.get("x-user-id");
    if (fromHeader) {
      const account = await getAccountById(fromHeader);
      if (account && account.isActive) return account;
    }
  }

  return null;
}

export async function isActorAdmin(req: Request): Promise<boolean> {
  const actor = await getActorFromRequest(req);
  if (!actor) return false;

  return actor.role === "admin";
}
