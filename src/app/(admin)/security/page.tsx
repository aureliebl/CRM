"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "@/lib/mock/auth";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { AsyncButton } from "@/components/admin/AsyncButton";
import { useLocale } from "@/lib/use-locale";
import type { AccountGroupMembership, IpAllowlistEntry, SecuritySettings, UserGroup } from "@/lib/types";

type AccountLite = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

interface SecurityOverview {
  accounts: AccountLite[];
  groups: UserGroup[];
  memberships: AccountGroupMembership[];
  settings: SecuritySettings;
  ipAllowlist: IpAllowlistEntry[];
}

type TabAccessLite = {
  id: string;
  title: string;
  slug: string;
  groupIds: string[];
};

type ConnectorLite = {
  id: string;
  name: string;
  provider: "bigquery";
  enabled: boolean;
  config?: {
    projectId?: string;
    dataset?: string;
  };
};

export default function SecurityPage() {
  const { locale } = useLocale();
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [newIpValue, setNewIpValue] = useState("");
  const [newIpLabel, setNewIpLabel] = useState("");
  const [connectors, setConnectors] = useState<ConnectorLite[]>([]);
  const [connectorName, setConnectorName] = useState("BigQuery");
  const [connectorProvider, setConnectorProvider] = useState<"mock" | "bigquery">("mock");
  const [projectId, setProjectId] = useState("");
  const [dataset, setDataset] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [connectorTables, setConnectorTables] = useState<Array<{ table: string; rowCount?: number }>>([]);
  const [tabs, setTabs] = useState<TabAccessLite[]>([]);
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountFullName, setNewAccountFullName] = useState("");
  const [newAccountRole, setNewAccountRole] = useState<"admin" | "operator">("operator");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [accountCreateError, setAccountCreateError] = useState<string | null>(null);
  const [savingTabAccess, setSavingTabAccess] = useState<string | null>(null);
  const [deletingConnectorId, setDeletingConnectorId] = useState<string | null>(null);
  const [previewingConnectorId, setPreviewingConnectorId] = useState<string | null>(null);
  const [previewedConnectorId, setPreviewedConnectorId] = useState<string | null>(null);
  const [deletedConnectorId, setDeletedConnectorId] = useState<string | null>(null);
  const [connectorFeedback, setConnectorFeedback] = useState<string | null>(null);
  const [connectorFeedbackTone, setConnectorFeedbackTone] = useState<"info" | "error">("info");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupCreated, setGroupCreated] = useState(false);
  const [addingIp, setAddingIp] = useState(false);
  const [ipAdded, setIpAdded] = useState(false);
  const [addingConnector, setAddingConnector] = useState(false);
  const [connectorAdded, setConnectorAdded] = useState(false);

  const labels =
    locale === "fr"
      ? {
          title: "Admin & sécurité",
          description:
            "Gestion des groupes, des affectations utilisateurs et de la restriction d'accès par IP.",
          createGroup: "Créer un groupe",
          groupName: "Nom du groupe",
          add: "Ajouter",
          assignGroup: "Affecter un groupe",
          groupTabs: "Onglets autorisés par groupe",
          groupTabsDescription: "Cochez les onglets visibles pour chaque groupe opérateur.",
          noTabs: "Aucun onglet configurable",
          role: "Rôle",
          account: "Compte",
          group: "Groupe",
          noGroup: "Aucun groupe",
          ipTitle: "Restriction IP",
          ipEnabled: "Activer la restriction d'accès par IP",
          ipInput: "IP ou CIDR",
          ipLabel: "Label",
          ipListTitle: "Entrées allowlist",
          ip: "IP / CIDR",
          active: "Actif",
          yes: "Oui",
          no: "Non",
          loading: "Chargement...",
          forbidden: "Accès réservé aux administrateurs.",
          operatorsOnly: "Les comptes non-admin sont traités comme opérateurs.",
          createAccount: "Créer un compte",
          accountEmail: "Email",
          accountFullName: "Nom complet",
          accountRole: "Rôle",
          accountPassword: "Mot de passe temporaire",
          accountCreateSuccess: "Compte créé",
          accountCreateError: "Impossible de créer le compte",
          resetPassword: "Réinitialiser mot de passe",
          resetPasswordPrompt: "Nouveau mot de passe temporaire (min 8 caractères)",
          resetPasswordError: "Impossible de réinitialiser le mot de passe",
          connectorsTitle: "Connecteurs de données",
          connectorName: "Nom",
          projectId: "Project ID",
          dataset: "Dataset",
          serviceAccount: "Service account JSON",
          provider: "Provider",
          enabled: "Actif",
          table: "Table",
          rowCount: "Nb lignes",
          previewTables: "Aperçu tables",
          actions: "Actions",
          remove: "Supprimer",
          previewError: "Impossible de récupérer les tables du connecteur.",
          previewEmpty: "Aucune table trouvée pour ce connecteur.",
          previewSuccess: "Tables chargées.",
          activeConnector: "Connecteur actif",
        }
      : {
          title: "Admin & security",
          description:
            "Manage groups, user assignments and IP-based access restriction.",
          createGroup: "Create group",
          groupName: "Group name",
          add: "Add",
          assignGroup: "Assign group",
          groupTabs: "Allowed tabs by group",
          groupTabsDescription: "Select which tabs are visible for each operator group.",
          noTabs: "No configurable tabs",
          role: "Role",
          account: "Account",
          group: "Group",
          noGroup: "No group",
          ipTitle: "IP restriction",
          ipEnabled: "Enable IP allowlist login restriction",
          ipInput: "IP or CIDR",
          ipLabel: "Label",
          ipListTitle: "Allowlist entries",
          ip: "IP / CIDR",
          active: "Active",
          yes: "Yes",
          no: "No",
          loading: "Loading...",
          forbidden: "Admin-only access.",
          operatorsOnly: "Non-admin accounts are treated as operators.",
          createAccount: "Create account",
          accountEmail: "Email",
          accountFullName: "Full name",
          accountRole: "Role",
          accountPassword: "Temporary password",
          accountCreateSuccess: "Account created",
          accountCreateError: "Unable to create account",
          resetPassword: "Reset password",
          resetPasswordPrompt: "Temporary new password (min 8 characters)",
          resetPasswordError: "Unable to reset password",
          connectorsTitle: "Data connectors",
          connectorName: "Name",
          projectId: "Project ID",
          dataset: "Dataset",
          serviceAccount: "Service account JSON",
          provider: "Provider",
          enabled: "Enabled",
          table: "Table",
          rowCount: "Rows",
          previewTables: "Tables preview",
          actions: "Actions",
          remove: "Delete",
          previewError: "Unable to fetch connector tables.",
          previewEmpty: "No tables found for this connector.",
          previewSuccess: "Tables loaded.",
          activeConnector: "Active connector",
        };

  const actor = getCurrentUser();

  const loadOverview = async () => {
    if (!actor) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/security/overview?userId=${encodeURIComponent(actor.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setOverview(null);
        return;
      }
      const data = (await res.json()) as SecurityOverview;
      setOverview(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const loadTabs = async () => {
    if (!actor) return;
    const res = await fetch(`/api/tabs?userId=${encodeURIComponent(actor.id)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setTabs([]);
      return;
    }
    const data = (await res.json()) as Array<{
      id: string;
      title: string;
      slug: string;
      groupIds?: string[];
    }>;
    setTabs(
      data.map((tab) => ({
        id: tab.id,
        title: tab.title,
        slug: tab.slug,
        groupIds: tab.groupIds ?? [],
      }))
    );
  };

  useEffect(() => {
    loadTabs();
  }, [actor?.id]);

  const loadConnectors = async () => {
    if (!actor) return;
    const res = await fetch(`/api/connectors?userId=${encodeURIComponent(actor.id)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setConnectors([]);
      return;
    }
    const data = (await res.json()) as ConnectorLite[];
    setConnectors(data);
  };

  useEffect(() => {
    loadConnectors();
  }, [actor?.id]);

  const membershipMap = useMemo(() => {
    const map = new Map<string, string>();
    overview?.memberships.forEach((membership) => {
      map.set(membership.accountId, membership.groupId);
    });
    return map;
  }, [overview]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    overview?.groups.forEach((group) => {
      map.set(group.id, group.name);
    });
    return map;
  }, [overview]);

  const operatorGroupIds = useMemo(() => {
    const ids = new Set<string>();
    if (!overview) return ids;
    for (const account of overview.accounts) {
      if (account.role !== "operator") continue;
      const groupId = membershipMap.get(account.id);
      if (groupId) ids.add(groupId);
    }
    return ids;
  }, [overview, membershipMap]);

  if (actor?.role !== "admin") {
    return (
      <div>
        <h1 className="admin-page-title">{labels.title}</h1>
        <p className="admin-page-description">{labels.forbidden}</p>
      </div>
    );
  }

  const createGroup = async () => {
    if (!actor || !groupName.trim()) return;
    setCreatingGroup(true);
    try {
      await fetch(`/api/security/groups?userId=${encodeURIComponent(actor.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim() }),
      });
      setGroupName("");
      await loadOverview();
      setGroupCreated(true);
      setTimeout(() => setGroupCreated(false), 900);
    } finally {
      setCreatingGroup(false);
    }
  };

  const setMembership = async (accountId: string, groupId: string) => {
    if (!actor || !groupId) return;
    await fetch(`/api/security/memberships?userId=${encodeURIComponent(actor.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, groupId }),
    });
    await loadOverview();
  };

  const setRole = async (accountId: string, role: "admin" | "operator") => {
    if (!actor) return;
    await fetch(
      `/api/security/accounts/${encodeURIComponent(accountId)}/role?userId=${encodeURIComponent(actor.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }
    );
    await loadOverview();
  };

  const resetPasswordForAccount = async (accountId: string) => {
    if (!actor) return;
    const password = window.prompt(labels.resetPasswordPrompt, "");
    if (!password) return;

    const res = await fetch(
      `/api/security/accounts/${encodeURIComponent(accountId)}/password?userId=${encodeURIComponent(actor.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setAccountCreateError(body.error || labels.resetPasswordError);
      return;
    }

    setAccountCreateError(null);
  };

  const createUserAccount = async () => {
    if (!actor) return;
    setCreatingAccount(true);
    setAccountCreateError(null);
    try {
      const res = await fetch(`/api/security/accounts?userId=${encodeURIComponent(actor.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newAccountEmail.trim(),
          fullName: newAccountFullName.trim(),
          role: newAccountRole,
          password: newAccountPassword,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setAccountCreateError(body.error || labels.accountCreateError);
        return;
      }

      setNewAccountEmail("");
      setNewAccountFullName("");
      setNewAccountRole("operator");
      setNewAccountPassword("");
      setAccountCreated(true);
      setTimeout(() => setAccountCreated(false), 900);
      await loadOverview();
    } finally {
      setCreatingAccount(false);
    }
  };

  const setIpEnabled = async (enabled: boolean) => {
    if (!actor) return;
    await fetch(`/api/security/ip-allowlist?userId=${encodeURIComponent(actor.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipAllowlistEnabled: enabled }),
    });
    await loadOverview();
  };

  const addIpEntry = async () => {
    if (!actor || !newIpValue.trim()) return;
    setAddingIp(true);
    try {
      await fetch(`/api/security/ip-allowlist?userId=${encodeURIComponent(actor.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipOrCidr: newIpValue.trim(),
          label: newIpLabel.trim() || undefined,
          isActive: true,
        }),
      });
      setNewIpValue("");
      setNewIpLabel("");
      await loadOverview();
      setIpAdded(true);
      setTimeout(() => setIpAdded(false), 900);
    } finally {
      setAddingIp(false);
    }
  };

  const addConnector = async () => {
    if (!actor || !connectorName.trim()) return;
    if (connectorProvider === "bigquery" && (!projectId.trim() || !dataset.trim())) return;
    setAddingConnector(true);
    try {
      await fetch(`/api/connectors?userId=${encodeURIComponent(actor.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: connectorName.trim(),
          provider: connectorProvider,
          projectId: projectId.trim(),
          dataset: dataset.trim(),
          serviceAccountJson: serviceAccountJson.trim() || undefined,
        }),
      });
      await loadConnectors();
      setConnectorAdded(true);
      setTimeout(() => setConnectorAdded(false), 900);
    } finally {
      setAddingConnector(false);
    }
  };

  const previewTables = async (connectorId?: string) => {
    if (!actor) return;
    if (!connectorId) return;
    setPreviewingConnectorId(connectorId);
    setConnectorFeedback(null);
    const query = connectorId ? `&connectorId=${encodeURIComponent(connectorId)}` : "";
    try {
      const res = await fetch(
        `/api/connectors/tables?userId=${encodeURIComponent(actor.id)}${query}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as {
        connector?: { name?: string; provider?: string } | null;
        tables?: Array<{ table: string; rowCount?: number }>;
        error?: string;
      };

      const connectorLabel = data.connector?.name
        ? `${labels.activeConnector}: ${data.connector.name}${data.connector.provider ? ` (${data.connector.provider})` : ""}`
        : labels.activeConnector;

      if (!res.ok) {
        setConnectorTables([]);
        setConnectorFeedbackTone("error");
        setConnectorFeedback(`${labels.previewError} ${data.error ? `(${data.error})` : ""}`.trim());
        return;
      }

      const tables = data.tables ?? [];
      setConnectorTables(tables);
      setConnectorFeedbackTone("info");
      setConnectorFeedback(
        tables.length === 0
          ? `${labels.previewEmpty} (${connectorLabel})`
          : `${labels.previewSuccess} (${connectorLabel})`
      );
      setPreviewedConnectorId(connectorId);
      setTimeout(() => setPreviewedConnectorId((current) => (current === connectorId ? null : current)), 900);
    } finally {
      setPreviewingConnectorId(null);
    }
  };

  const removeConnector = async (connectorId: string, connectorName: string) => {
    if (!actor) return;
    const confirmed = window.confirm(
      locale === "fr"
        ? `Supprimer le connecteur \"${connectorName}\" ?`
        : `Delete connector \"${connectorName}\"?`
    );
    if (!confirmed) return;

    setDeletingConnectorId(connectorId);
    try {
      await fetch(`/api/connectors/${encodeURIComponent(connectorId)}?userId=${encodeURIComponent(actor.id)}`, {
        method: "DELETE",
      });
      setDeletedConnectorId(connectorId);
      await new Promise((resolve) => setTimeout(resolve, 700));
      setConnectorTables([]);
      setConnectorFeedback(null);
      await loadConnectors();
    } finally {
      setDeletingConnectorId(null);
      setDeletedConnectorId((current) => (current === connectorId ? null : current));
    }
  };

  const setGroupTabAccess = async (groupId: string, tabId: string, enabled: boolean) => {
    if (!actor) return;

    const currentTab = tabs.find((tab) => tab.id === tabId);
    if (!currentTab) return;

    const nextGroupIds = enabled
      ? Array.from(new Set([...currentTab.groupIds, groupId]))
      : currentTab.groupIds.filter((id) => id !== groupId);

    setSavingTabAccess(tabId);
    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, groupIds: nextGroupIds } : tab))
    );

    const res = await fetch(`/api/tabs/${encodeURIComponent(tabId)}?userId=${encodeURIComponent(actor.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupIds: nextGroupIds }),
    });

    if (!res.ok) {
      await loadTabs();
    }

    setSavingTabAccess(null);
  };

  return (
    <div>
      <h1 className="admin-page-title">{labels.title}</h1>
      <p className="admin-page-description">{labels.description}</p>

      {loading || !overview ? (
        <section className="admin-placeholder-card">{labels.loading}</section>
      ) : (
        <>
          <section className="admin-placeholder-card" style={{ marginBottom: "1rem" }}>
            <div className="admin-placeholder-title">{labels.createAccount}</div>
            <div
              style={{
                display: "grid",
                gap: "0.55rem",
                marginTop: "0.7rem",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              }}
            >
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.accountEmail}</span>
                <input
                  type="email"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.accountFullName}</span>
                <input
                  value={newAccountFullName}
                  onChange={(e) => setNewAccountFullName(e.target.value)}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.accountRole}</span>
                <select
                  value={newAccountRole}
                  onChange={(e) => setNewAccountRole(e.target.value as "admin" | "operator")}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="operator">operator</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.accountPassword}</span>
                <input
                  type="password"
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.8rem" }}>
              <AsyncButton
                type="button"
                onClick={createUserAccount}
                disabled={!newAccountEmail.trim() || !newAccountFullName.trim() || newAccountPassword.length < 8}
                isLoading={creatingAccount}
                isSuccess={accountCreated}
                loadingLabel={labels.add}
                successLabel={labels.accountCreateSuccess}
                minWidth={140}
              >
                {labels.createAccount}
              </AsyncButton>
              {accountCreateError && (
                <span style={{ color: "var(--error-text)", fontSize: "0.82rem" }}>
                  {accountCreateError}
                </span>
              )}
            </div>
          </section>

          <section className="admin-placeholder-card" style={{ marginBottom: "1rem" }}>
            <div className="admin-placeholder-title">{labels.createGroup}</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
              {labels.operatorsOnly}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                value={groupName}
                placeholder={labels.groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{
                  minWidth: "260px",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "0.45rem",
                  border: "1px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                }}
              />
              <AsyncButton
                type="button"
                onClick={createGroup}
                disabled={!groupName.trim()}
                isLoading={creatingGroup}
                isSuccess={groupCreated}
                loadingLabel={labels.add}
                successLabel={labels.add}
                minWidth={110}
              >
                {labels.add}
              </AsyncButton>
            </div>
          </section>

          <section className="admin-placeholder-card" style={{ marginBottom: "1rem" }}>
            <div className="admin-placeholder-title">{labels.assignGroup}</div>
            <div style={{ marginTop: "0.7rem" }}>
              <TableWithColumnFilters
                title={labels.assignGroup}
                stickyFilters={false}
                data={overview.accounts.map((account) => ({
                  id: account.id,
                  accountId: account.id,
                  account: account.fullName,
                  role: account.role,
                  group: groupNameById.get(membershipMap.get(account.id) || "") || labels.noGroup,
                }))}
                columns={[
                  { key: "account", label: labels.account, filterType: "text" },
                  {
                    key: "role",
                    label: labels.role,
                    filterType: "select",
                    selectOptions: [
                      { value: "admin", label: "admin" },
                      { value: "operator", label: "operator" },
                    ],
                    render: (row) => {
                      if (!row.accountId) return row.role;

                      return (
                        <select
                          value={row.role}
                          onChange={(e) => setRole(row.accountId, e.target.value as "admin" | "operator")}
                          style={{
                            width: "100%",
                            maxWidth: "180px",
                            padding: "0.35rem 0.55rem",
                            borderRadius: "0.45rem",
                            border: "1px solid var(--border-color)",
                            background: "var(--input-bg)",
                            color: "var(--text-primary)",
                          }}
                        >
                          <option value="admin">admin</option>
                          <option value="operator">operator</option>
                        </select>
                      );
                    },
                  },
                  {
                    key: "group",
                    label: labels.group,
                    filterType: "none",
                    render: (row) => {
                      if (!row.accountId) return row.group;
                      const currentGroupId = membershipMap.get(row.accountId) || "";
                      return (
                        <select
                          value={currentGroupId}
                          onChange={(e) => setMembership(row.accountId, e.target.value)}
                          style={{
                            width: "100%",
                            maxWidth: "220px",
                            padding: "0.35rem 0.55rem",
                            borderRadius: "0.45rem",
                            border: "1px solid var(--border-color)",
                            background: "var(--input-bg)",
                            color: "var(--text-primary)",
                          }}
                        >
                          <option value="">{labels.noGroup}</option>
                          {overview.groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      );
                    },
                  },
                  {
                    key: "actions",
                    label: labels.actions,
                    filterType: "none",
                    render: (row) => {
                      if (!row.accountId) return "-";
                      return (
                        <button
                          type="button"
                          onClick={() => resetPasswordForAccount(row.accountId)}
                          style={{
                            padding: "0.35rem 0.55rem",
                            borderRadius: "0.45rem",
                            border: "1px solid var(--border-color)",
                            background: "var(--button-bg)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            fontSize: "0.78rem",
                          }}
                        >
                          {labels.resetPassword}
                        </button>
                      );
                    },
                  },
                ]}
              />
            </div>

            <div style={{ marginTop: "1rem" }}>
              <div className="admin-placeholder-title">{labels.groupTabs}</div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0.45rem 0 0.65rem 0" }}>
                {labels.groupTabsDescription}
              </p>

              {tabs.length === 0 ? (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>{labels.noTabs}</div>
              ) : (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  {overview.groups
                    .filter((group) => operatorGroupIds.size === 0 || operatorGroupIds.has(group.id))
                    .map((group) => (
                      <div
                        key={group.id}
                        style={{
                          border: "1px solid var(--border-color)",
                          borderRadius: "0.55rem",
                          padding: "0.6rem",
                          display: "grid",
                          gap: "0.4rem",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{group.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", alignItems: "center" }}>
                          {tabs.map((tab) => {
                            const checked = tab.groupIds.includes(group.id);
                            const disabled = savingTabAccess === tab.id;
                            return (
                              <label
                                key={`${group.id}-${tab.id}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  border: "1px solid var(--border-color)",
                                  borderRadius: "999px",
                                  padding: "0.2rem 0.45rem",
                                  opacity: disabled ? 0.7 : 1,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={(e) => setGroupTabAccess(group.id, tab.id, e.target.checked)}
                                />
                                <span style={{ fontSize: "0.78rem" }}>
                                  {tab.title}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>

          <section className="admin-placeholder-card">
            <div className="admin-placeholder-title">{labels.ipTitle}</div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", margin: "0.6rem 0" }}>
              <input
                type="checkbox"
                checked={overview.settings.ipAllowlistEnabled}
                onChange={(e) => setIpEnabled(e.target.checked)}
              />
              <span>{labels.ipEnabled}</span>
            </label>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.7rem" }}>
              <input
                type="text"
                value={newIpValue}
                placeholder={labels.ipInput}
                onChange={(e) => setNewIpValue(e.target.value)}
                style={{
                  minWidth: "260px",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "0.45rem",
                  border: "1px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                }}
              />
              <input
                type="text"
                value={newIpLabel}
                placeholder={labels.ipLabel}
                onChange={(e) => setNewIpLabel(e.target.value)}
                style={{
                  minWidth: "220px",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "0.45rem",
                  border: "1px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                }}
              />
              <AsyncButton
                type="button"
                onClick={addIpEntry}
                disabled={!newIpValue.trim()}
                isLoading={addingIp}
                isSuccess={ipAdded}
                loadingLabel={labels.add}
                successLabel={labels.add}
                minWidth={110}
              >
                {labels.add}
              </AsyncButton>
            </div>

            <TableWithColumnFilters
              title={labels.ipListTitle}
              stickyFilters={false}
              data={overview.ipAllowlist.map((entry) => ({
                id: entry.id,
                ip: entry.ipOrCidr,
                label: entry.label ?? "",
                active: entry.isActive ? labels.yes : labels.no,
              }))}
              columns={[
                { key: "ip", label: labels.ip, filterType: "text" },
                { key: "label", label: labels.ipLabel, filterType: "text" },
                { key: "active", label: labels.active, filterType: "select", selectOptions: [
                  { value: labels.yes, label: labels.yes },
                  { value: labels.no, label: labels.no },
                ] },
              ]}
            />
          </section>

          <section className="admin-placeholder-card" style={{ marginTop: "1rem" }}>
            <div className="admin-placeholder-title">{labels.connectorsTitle}</div>
            <div
              style={{
                display: "grid",
                gap: "0.55rem",
                marginBottom: "0.8rem",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              }}
            >
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.connectorName}</span>
                <input
                  value={connectorName}
                  onChange={(e) => setConnectorName(e.target.value)}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.provider}</span>
                <select
                  value={connectorProvider}
                  onChange={(e) => setConnectorProvider(e.target.value as "mock" | "bigquery")}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="mock">mock</option>
                  <option value="bigquery">bigquery</option>
                </select>
              </label>
              {connectorProvider === "bigquery" && (
                <>
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.projectId}</span>
                <input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.dataset}</span>
                <input
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.2rem" }}>
                <span>{labels.serviceAccount}</span>
                <input
                  value={serviceAccountJson}
                  onChange={(e) => setServiceAccountJson(e.target.value)}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.45rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.8rem" }}>
              <AsyncButton
                type="button"
                onClick={addConnector}
                disabled={!connectorName.trim() || (connectorProvider === "bigquery" && (!projectId.trim() || !dataset.trim()))}
                isLoading={addingConnector}
                isSuccess={connectorAdded}
                loadingLabel={labels.add}
                successLabel={labels.add}
                minWidth={120}
              >
                {labels.add}
              </AsyncButton>
              {connectorFeedback && (
                <span
                  style={{
                    color:
                      connectorFeedbackTone === "error"
                        ? "var(--error-text)"
                        : "var(--text-secondary)",
                    fontSize: "0.82rem",
                  }}
                >
                  {connectorFeedback}
                </span>
              )}
            </div>

            <TableWithColumnFilters
              title={labels.connectorsTitle}
              stickyFilters={false}
              data={connectors.map((connector) => ({
                id: connector.id,
                connectorId: connector.id,
                name: connector.name,
                provider: connector.provider,
                projectId: connector.config?.projectId ?? "",
                dataset: connector.config?.dataset ?? "",
                enabled: connector.enabled ? labels.yes : labels.no,
                actions: "",
              }))}
              columns={[
                { key: "name", label: labels.connectorName, filterType: "text" },
                {
                  key: "provider",
                  label: labels.provider,
                  filterType: "select",
                  selectOptions: [
                    { value: "mock", label: "mock" },
                    { value: "bigquery", label: "bigquery" },
                  ],
                },
                { key: "projectId", label: labels.projectId, filterType: "text" },
                { key: "dataset", label: labels.dataset, filterType: "text" },
                {
                  key: "enabled",
                  label: labels.enabled,
                  filterType: "select",
                  selectOptions: [
                    { value: labels.yes, label: labels.yes },
                    { value: labels.no, label: labels.no },
                  ],
                },
                {
                  key: "actions",
                  label: labels.actions,
                  filterType: "none",
                  render: (row) => {
                    if (!row.connectorId) return "-";
                    const isDeleting = deletingConnectorId === row.connectorId;
                    const isPreviewing = previewingConnectorId === row.connectorId;
                    return (
                      <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                        <AsyncButton
                          type="button"
                          onClick={() => previewTables(row.connectorId)}
                          isLoading={isPreviewing}
                          isSuccess={previewedConnectorId === row.connectorId}
                          loadingLabel={labels.previewTables}
                          successLabel={labels.previewTables}
                          minWidth={145}
                        >
                          {labels.previewTables}
                        </AsyncButton>
                        <AsyncButton
                          type="button"
                          onClick={() => removeConnector(row.connectorId, row.name || row.connectorId)}
                          isLoading={isDeleting}
                          isSuccess={deletedConnectorId === row.connectorId}
                          loadingLabel={labels.remove}
                          successLabel={labels.remove}
                          minWidth={110}
                        >
                          {labels.remove}
                        </AsyncButton>
                      </div>
                    );
                  },
                },
              ]}
            />

            <div style={{ marginTop: "0.8rem" }}>
              <TableWithColumnFilters
                title={labels.previewTables}
                stickyFilters={false}
                data={connectorTables.map((table) => ({
                  id: table.table,
                  table: table.table,
                  rowCount: table.rowCount ?? "-",
                }))}
                columns={[
                  { key: "table", label: labels.table, filterType: "text" },
                  { key: "rowCount", label: labels.rowCount, filterType: "text" },
                ]}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
