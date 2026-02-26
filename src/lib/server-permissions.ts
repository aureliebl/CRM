import { getAccountById } from "@/lib/account-store";
import { getSessionFromRequest } from "@/lib/server-session";

export function getActorIdFromRequest(req: Request): string | null {
  const session = getSessionFromRequest(req);
  if (session?.userId) return session.userId;

  if (process.env.ALLOW_LEGACY_ACTOR_FALLBACK === "true") {
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("userId");
    if (fromQuery) return fromQuery;

    const fromHeader = req.headers.get("x-user-id");
    if (fromHeader) return fromHeader;
  }

  return null;
}

export async function isActorAdmin(req: Request): Promise<boolean> {
  const actorId = getActorIdFromRequest(req);
  if (!actorId) return false;

  const actor = await getAccountById(actorId);
  if (!actor) return false;

  return actor.role === "admin";
}
