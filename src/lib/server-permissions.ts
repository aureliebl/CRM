import { getAccountById } from "@/lib/account-store";

export function getActorIdFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("userId");
  if (fromQuery) return fromQuery;

  const fromHeader = req.headers.get("x-user-id");
  if (fromHeader) return fromHeader;

  return null;
}

export function isActorAdmin(req: Request): boolean {
  const actorId = getActorIdFromRequest(req);
  if (!actorId) return false;

  const actor = getAccountById(actorId);
  if (!actor) return false;

  return actor.role === "admin";
}
