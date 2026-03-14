import { getAccountById } from "@/lib/account-store";
import { getSessionFromRequest } from "@/lib/server-session";

type ActorLike = {
  id: string;
  email?: string | null;
  role?: string | null;
};

function parseEnvList(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.toLowerCase())
  );
}

function getConfiguredSuperAdminIds(): Set<string> {
  const ids = parseEnvList(process.env.SUPER_ADMIN_IDS);
  return new Set(Array.from(ids).map((id) => id.toLowerCase()));
}

function getConfiguredSuperAdminEmails(): Set<string> {
  const emailsFromList = parseEnvList(process.env.SUPER_ADMIN_EMAILS);
  const single = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  if (single) {
    emailsFromList.add(single);
  }
  return emailsFromList;
}

export function isAccountSuperAdmin(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  if (actor.role !== "admin") return false;

  const configuredIds = getConfiguredSuperAdminIds();
  const configuredEmails = getConfiguredSuperAdminEmails();

  if (configuredIds.size === 0 && configuredEmails.size === 0) {
    return true;
  }

  const actorId = String(actor.id || "").trim().toLowerCase();
  const actorEmail = String(actor.email || "").trim().toLowerCase();

  if (actorId && configuredIds.has(actorId)) return true;
  if (actorEmail && configuredEmails.has(actorEmail)) return true;
  return false;
}

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

export async function isActorSuperAdmin(req: Request): Promise<boolean> {
  const actor = await getActorFromRequest(req);
  return isAccountSuperAdmin(actor);
}
