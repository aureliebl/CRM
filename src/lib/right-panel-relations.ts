import { getAccountById, toSafeAccount } from "@/lib/account-store";
import { getConnectorById, getConnectorConfig } from "@/lib/connectors-store";
import { getTabById } from "@/lib/tabs-store";

type ResolverInput = {
  id?: string;
  [key: string]: unknown;
};

type RelationResolver = (input: ResolverInput) => Promise<unknown>;

const RELATION_RESOLVERS: Record<string, RelationResolver> = {
  async accountById(input) {
    if (!input.id || typeof input.id !== "string") return null;
    const account = await getAccountById(input.id);
    return account ? toSafeAccount(account) : null;
  },
  async connectorById(input) {
    if (!input.id || typeof input.id !== "string") return null;
    const connector = await getConnectorById(input.id);
    if (!connector) return null;
    const config = await getConnectorConfig(input.id);
    return {
      ...connector,
      config,
    };
  },
  async tabById(input) {
    if (!input.id || typeof input.id !== "string") return null;
    return getTabById(input.id);
  },
};

export function getAllowedRelationResolvers() {
  return Object.keys(RELATION_RESOLVERS);
}

export async function resolveRightPanelRelation(
  relationKey: string,
  input: ResolverInput
): Promise<unknown> {
  const resolver = RELATION_RESOLVERS[relationKey];
  if (!resolver) {
    throw new Error("Unknown relation resolver");
  }

  return resolver(input);
}
