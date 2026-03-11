"use client";

import { useEffect, useMemo, useState } from "react";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { AsyncButton } from "@/components/admin/AsyncButton";
import { TabLoadingIndicator } from "@/components/admin/TabLoadingIndicator";
import { useLocale } from "@/lib/use-locale";
import type { AccountGroupMembership, IpAllowlistEntry, SecuritySettings, UserGroup } from "@/lib/types";
import type { RightPanelConfig } from "@/lib/right-panel-types";

type AccountLite = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive?: number;
};

interface SecurityOverview {
  accounts: AccountLite[];
  groups: UserGroup[];
  memberships: AccountGroupMembership[];
  settings: SecuritySettings;
  ipAllowlist: IpAllowlistEntry[];
  logs?: AuditLogLite[];
}

type AuditLogLite = {
  id: string;
  accountId: string;
  actorName?: string;
  type: string;
  message: string;
  timestamp: string;
};

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

type SessionActor = {
  id: string;
  role: string;
  email?: string;
  fullName?: string;
};

type RightPanelEditorMode = "guided" | "json";
type RightPanelOverride = Record<string, unknown>;

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
  const [accountActionInfo, setAccountActionInfo] = useState<string | null>(null);
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
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [rightPanels, setRightPanels] = useState<RightPanelConfig[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState("");
  const [panelEditorText, setPanelEditorText] = useState("{}");
  const [panelEditorMode, setPanelEditorMode] = useState<RightPanelEditorMode>("guided");
  const [savingPanelConfig, setSavingPanelConfig] = useState(false);
  const [panelConfigSaved, setPanelConfigSaved] = useState(false);
  const [panelConfigError, setPanelConfigError] = useState<string | null>(null);

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
          sendResetEmail: "Envoyer email reset",
          resetEmailSent: "Email de réinitialisation envoyé",
          resetEmailFallback: "SMTP non configuré. Lien de reset:",
          resetPasswordError: "Impossible de réinitialiser le mot de passe",
          accountStatus: "Statut",
          activateAccount: "Activer",
          deactivateAccount: "Désactiver",
          activationError: "Impossible de modifier le statut du compte",
          auditTrail: "Journal d'audit",
          eventType: "Type",
          eventActor: "Auteur",
          eventMessage: "Message",
          eventTime: "Horodatage",
          noLogs: "Aucun événement",
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
          rightPanelsTitle: "Configuration des panneaux lateraux",
          rightPanelsDescription:
            "Configurer uniquement le contenu des panneaux existants (sans creation ni suppression).",
          panelId: "Panel ID",
          panelName: "Nom",
          panelContexts: "Contextes",
          panelEditor: "Override JSON",
          panelEditorGuided: "Editeur guide",
          panelEditorJson: "JSON brut",
          panelDisplayName: "Nom affiche",
          panelTitleTemplate: "Template titre",
          panelSubtitleTemplate: "Template sous-titre",
          panelSections: "Sections",
          panelFields: "Champs",
          panelAddSection: "Ajouter section",
          panelRemoveSection: "Supprimer section",
          panelAddField: "Ajouter champ",
          panelRemoveField: "Supprimer champ",
          panelSave: "Enregistrer la configuration",
          panelSaved: "Configuration enregistree",
          panelSaveError: "Configuration invalide ou non enregistrable",
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
          sendResetEmail: "Send reset email",
          resetEmailSent: "Password reset email sent",
          resetEmailFallback: "SMTP not configured. Reset link:",
          resetPasswordError: "Unable to reset password",
          accountStatus: "Status",
          activateAccount: "Activate",
          deactivateAccount: "Deactivate",
          activationError: "Unable to change account status",
          auditTrail: "Audit trail",
          eventType: "Type",
          eventActor: "Actor",
          eventMessage: "Message",
          eventTime: "Timestamp",
          noLogs: "No events",
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
          rightPanelsTitle: "Right panel configuration",
          rightPanelsDescription:
            "Configure content only for existing panels (no create/delete).",
          panelId: "Panel ID",
          panelName: "Name",
          panelContexts: "Contexts",
          panelEditor: "JSON override",
          panelEditorGuided: "Guided editor",
          panelEditorJson: "Raw JSON",
          panelDisplayName: "Display name",
          panelTitleTemplate: "Title template",
          panelSubtitleTemplate: "Subtitle template",
          panelSections: "Sections",
          panelFields: "Fields",
          panelAddSection: "Add section",
          panelRemoveSection: "Remove section",
          panelAddField: "Add field",
          panelRemoveField: "Remove field",
          panelSave: "Save configuration",
          panelSaved: "Configuration saved",
          panelSaveError: "Invalid or non-saveable configuration",
        };

  useEffect(() => {
    const loadActor = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) {
          setActor(null);
          setAuthResolved(true);
          return;
        }

        const data = (await res.json()) as { authenticated?: boolean; user?: SessionActor };
        setActor(data?.authenticated ? data.user ?? null : null);
      } finally {
        setAuthResolved(true);
      }
    };

    loadActor();
  }, []);

  const loadOverview = async (options?: { silent?: boolean }) => {
    if (!actor) return;
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/security/overview`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setOverview(null);
        return;
      }
      const data = (await res.json()) as SecurityOverview;
      setOverview(data);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadOverview();
  }, [actor?.id]);

  useEffect(() => {
    if (!actor || actor.role !== "admin") return;
    const interval = window.setInterval(() => {
      loadOverview({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [actor?.id, actor?.role]);

  const loadTabs = async () => {
    if (!actor) return;
    const res = await fetch(`/api/tabs`, {
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
    const res = await fetch(`/api/connectors`, {
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

  const loadRightPanels = async () => {
    if (!actor) return;
    const res = await fetch(`/api/security/right-panels`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setRightPanels([]);
      return;
    }

    const data = (await res.json()) as RightPanelConfig[];
    setRightPanels(data);
    if (!selectedPanelId && data.length > 0) {
      setSelectedPanelId(data[0].panelId);
    }
  };

  useEffect(() => {
    void loadRightPanels();
  }, [actor?.id]);

  const parsePanelEditor = (): RightPanelOverride | null => {
    try {
      const parsed = JSON.parse(panelEditorText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parsed as RightPanelOverride;
    } catch {
      return null;
    }
  };

  const updatePanelEditor = (updater: (current: RightPanelOverride) => RightPanelOverride) => {
    const current = parsePanelEditor() || {};
    const next = updater(current);
    setPanelEditorText(JSON.stringify(next, null, 2));
  };

  const updateSection = (sectionIndex: number, patch: Record<string, unknown>) => {
    updatePanelEditor((current) => {
      const sections = (
        Array.isArray(current.sections) ? [...(current.sections as unknown[])] : []
      ) as Array<Record<string, unknown>>;
      const section = sections[sectionIndex];
      if (!section) return current;
      sections[sectionIndex] = {
        ...section,
        ...patch,
      };
      return {
        ...current,
        sections,
      };
    });
  };

  const addSection = () => {
    updatePanelEditor((current) => {
      const sections = (
        Array.isArray(current.sections) ? [...(current.sections as unknown[])] : []
      ) as Array<Record<string, unknown>>;
      sections.push({
        key: `section_${sections.length + 1}`,
        title: "",
        fields: [],
      });
      return {
        ...current,
        sections,
      };
    });
  };

  const removeSection = (sectionIndex: number) => {
    updatePanelEditor((current) => {
      const sections = (
        Array.isArray(current.sections) ? [...(current.sections as unknown[])] : []
      ) as Array<Record<string, unknown>>;
      sections.splice(sectionIndex, 1);
      return {
        ...current,
        sections,
      };
    });
  };

  const addField = (sectionIndex: number) => {
    updatePanelEditor((current) => {
      const sections = (
        Array.isArray(current.sections) ? [...(current.sections as unknown[])] : []
      ) as Array<Record<string, unknown>>;
      const section = (sections[sectionIndex] || { key: "", title: "", fields: [] }) as Record<string, unknown>;
      const fields = Array.isArray(section.fields) ? [...(section.fields as unknown[])] : [];
      fields.push({
        key: `field_${fields.length + 1}`,
        label: "",
        source: "raw",
        path: "",
        renderer: "text",
      });
      sections[sectionIndex] = {
        ...section,
        fields,
      };
      return {
        ...current,
        sections,
      };
    });
  };

  const removeField = (sectionIndex: number, fieldIndex: number) => {
    updatePanelEditor((current) => {
      const sections = (
        Array.isArray(current.sections) ? [...(current.sections as unknown[])] : []
      ) as Array<Record<string, unknown>>;
      const section = (sections[sectionIndex] || { fields: [] }) as Record<string, unknown>;
      const fields = Array.isArray(section.fields) ? [...(section.fields as unknown[])] : [];
      fields.splice(fieldIndex, 1);
      sections[sectionIndex] = {
        ...section,
        fields,
      };
      return {
        ...current,
        sections,
      };
    });
  };

  const updateField = (sectionIndex: number, fieldIndex: number, patch: Record<string, unknown>) => {
    updatePanelEditor((current) => {
      const sections = (
        Array.isArray(current.sections) ? [...(current.sections as unknown[])] : []
      ) as Array<Record<string, unknown>>;
      const section = (sections[sectionIndex] || { fields: [] }) as Record<string, unknown>;
      const fields = Array.isArray(section.fields) ? [...(section.fields as unknown[])] : [];
      const field = (fields[fieldIndex] || {}) as Record<string, unknown>;
      fields[fieldIndex] = {
        ...field,
        ...patch,
      };
      sections[sectionIndex] = {
        ...section,
        fields,
      };
      return {
        ...current,
        sections,
      };
    });
  };

  useEffect(() => {
    const selected = rightPanels.find((item) => item.panelId === selectedPanelId);
    if (!selected) {
      setPanelEditorText("{}");
      return;
    }

    const initial: RightPanelOverride = {
      displayName: selected.displayName,
      titleTemplate: selected.titleTemplate,
      subtitleTemplate: selected.subtitleTemplate,
      contexts: selected.contexts,
      sections: selected.sections,
      relations: selected.relations,
      formulas: selected.formulas,
      globalActions: selected.globalActions,
      localActions: selected.localActions,
      uiOptions: selected.uiOptions,
    };
    setPanelEditorText(JSON.stringify(initial, null, 2));
  }, [selectedPanelId, rightPanels]);

  const membershipMap = useMemo(() => {
    const map = new Map<string, string>();
    overview?.memberships.forEach((membership) => {
      map.set(membership.accountId, membership.groupId);
    });
    return map;
  }, [overview]);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    (overview?.accounts ?? []).forEach((account) => {
      map.set(account.id, account.fullName || account.email || account.id);
    });
    return map;
  }, [overview?.accounts]);

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

  if (!authResolved) {
    return <TabLoadingIndicator label={labels.loading} />;
  }

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
      await fetch(`/api/security/groups`, {
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
    await fetch(`/api/security/memberships`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, groupId }),
    });
    await loadOverview();
  };

  const setRole = async (accountId: string, role: "admin" | "operator") => {
    if (!actor) return;
    await fetch(
      `/api/security/accounts/${encodeURIComponent(accountId)}/role`,
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
    setAccountCreateError(null);
    setAccountActionInfo(null);

    const res = await fetch(
      `/api/security/accounts/${encodeURIComponent(accountId)}/password-reset`,
      {
        method: "POST",
      }
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setAccountCreateError(body.error || labels.resetPasswordError);
      return;
    }

    const body = (await res.json().catch(() => ({}))) as { mode?: "smtp" | "log"; resetUrl?: string };
    if (body.mode === "log" && body.resetUrl) {
      setAccountActionInfo(`${labels.resetEmailFallback} ${body.resetUrl}`);
    } else {
      setAccountActionInfo(labels.resetEmailSent);
    }

    setAccountCreateError(null);
    await loadOverview();
  };

  const setAccountActive = async (accountId: string, isActive: boolean) => {
    if (!actor) return;

    const res = await fetch(
      `/api/security/accounts/${encodeURIComponent(accountId)}/activation`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setAccountCreateError(body.error || labels.activationError);
      return;
    }

    setAccountCreateError(null);
    await loadOverview();
  };

  const createUserAccount = async () => {
    if (!actor) return;

    if (newAccountPassword.length < 8) {
      setAccountCreateError("Password must be at least 8 characters");
      return;
    }

    setCreatingAccount(true);
    setAccountCreateError(null);
    setAccountActionInfo(null);
    try {
      const res = await fetch(`/api/security/accounts`, {
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

      const body = (await res.json().catch(() => ({}))) as {
        onboarding?: { mode?: "smtp" | "log"; resetUrl?: string; error?: string };
      };

      if (body.onboarding?.mode === "log" && body.onboarding.resetUrl) {
        setAccountActionInfo(`${labels.resetEmailFallback} ${body.onboarding.resetUrl}`);
      } else if (body.onboarding?.mode === "smtp") {
        setAccountActionInfo(labels.resetEmailSent);
      } else if (body.onboarding?.error) {
        setAccountActionInfo(`${labels.resetPasswordError}: ${body.onboarding.error}`);
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
    await fetch(`/api/security/ip-allowlist`, {
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
      await fetch(`/api/security/ip-allowlist`, {
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
      await fetch(`/api/connectors`, {
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
    try {
      const res = await fetch(`/api/connectors/tables?connectorId=${encodeURIComponent(connectorId)}`, {
        cache: "no-store",
      });
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
      await fetch(`/api/connectors/${encodeURIComponent(connectorId)}`, {
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

    const res = await fetch(`/api/tabs/${encodeURIComponent(tabId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupIds: nextGroupIds }),
    });

    if (!res.ok) {
      await loadTabs();
    }

    setSavingTabAccess(null);
  };

  const saveRightPanelConfig = async () => {
    if (!actor || !selectedPanelId) return;

    setPanelConfigError(null);
    setSavingPanelConfig(true);
    try {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(panelEditorText);
      } catch {
        setPanelConfigError(labels.panelSaveError);
        return;
      }

      const res = await fetch(`/api/security/right-panels/${encodeURIComponent(selectedPanelId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setPanelConfigError(body.error || labels.panelSaveError);
        return;
      }

      setPanelConfigSaved(true);
      setTimeout(() => setPanelConfigSaved(false), 900);
      await loadRightPanels();
    } finally {
      setSavingPanelConfig(false);
    }
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
                disabled={!newAccountEmail.trim() || !newAccountFullName.trim()}
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
              {accountActionInfo && (
                <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  {accountActionInfo}
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
                  isActive: account.isActive === 1 ? labels.yes : labels.no,
                  group: groupNameById.get(membershipMap.get(account.id) || "") || labels.noGroup,
                  actions: "",
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
                    key: "isActive",
                    label: labels.accountStatus,
                    filterType: "select",
                    selectOptions: [
                      { value: labels.yes, label: labels.yes },
                      { value: labels.no, label: labels.no },
                    ],
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
                      const isActive = row.isActive === labels.yes;
                      return (
                        <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
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
                            {labels.sendResetEmail}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccountActive(row.accountId, !isActive)}
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
                            {isActive ? labels.deactivateAccount : labels.activateAccount}
                          </button>
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>

            <div style={{ marginTop: "1rem" }}>
              <div className="admin-placeholder-title">{labels.auditTrail}</div>
              {(overview.logs ?? []).length === 0 ? (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.55rem" }}>
                  {labels.noLogs}
                </div>
              ) : (
                <div style={{ marginTop: "0.6rem" }}>
                  <TableWithColumnFilters
                    title={labels.auditTrail}
                    stickyFilters={false}
                    data={(overview.logs ?? []).map((entry) => ({
                      id: entry.id,
                      type: entry.type,
                      actorName: accountNameById.get(entry.accountId) || entry.accountId,
                      message: entry.message,
                      timestamp: entry.timestamp,
                    }))}
                    columns={[
                      { key: "type", label: labels.eventType, filterType: "text" },
                      { key: "actorName", label: labels.eventActor, filterType: "text" },
                      { key: "message", label: labels.eventMessage, filterType: "text" },
                      { key: "timestamp", label: labels.eventTime, filterType: "text" },
                    ]}
                  />
                </div>
              )}
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

          <section className="admin-placeholder-card" style={{ marginBottom: "1rem" }}>
            <div className="admin-placeholder-title">{labels.rightPanelsTitle}</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0.45rem 0 0.65rem 0" }}>
              {labels.rightPanelsDescription}
            </p>

            <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "minmax(260px, 320px) 1fr" }}>
              <div style={{ border: "1px solid var(--border-color)", borderRadius: "0.55rem", overflow: "hidden" }}>
                <div style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--border-color)", fontWeight: 600, fontSize: "0.82rem" }}>
                  {labels.rightPanelsTitle}
                </div>
                <div style={{ maxHeight: 320, overflow: "auto", display: "grid" }}>
                  {rightPanels.map((panel) => {
                    const selected = panel.panelId === selectedPanelId;
                    return (
                      <button
                        key={panel.panelId}
                        type="button"
                        onClick={() => setSelectedPanelId(panel.panelId)}
                        style={{
                          textAlign: "left",
                          border: "none",
                          borderBottom: "1px solid var(--border-color)",
                          background: selected ? "var(--surface-secondary)" : "transparent",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          padding: "0.5rem 0.6rem",
                          display: "grid",
                          gap: 2,
                        }}
                      >
                        <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{panel.displayName}</span>
                        <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{panel.panelId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.55rem" }}>
                <div style={{ display: "inline-flex", border: "1px solid var(--border-color)", borderRadius: 999, padding: 2, width: "fit-content" }}>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setPanelEditorMode("guided")}
                    style={{
                      padding: "0.25rem 0.7rem",
                      borderRadius: 999,
                      border: "none",
                      fontSize: 12,
                      background: panelEditorMode === "guided" ? "var(--accent-primary)" : "transparent",
                      color: panelEditorMode === "guided" ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {labels.panelEditorGuided}
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setPanelEditorMode("json")}
                    style={{
                      padding: "0.25rem 0.7rem",
                      borderRadius: 999,
                      border: "none",
                      fontSize: 12,
                      background: panelEditorMode === "json" ? "var(--accent-primary)" : "transparent",
                      color: panelEditorMode === "json" ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {labels.panelEditorJson}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.45rem" }}>
                  <label style={{ display: "grid", gap: "0.2rem" }}>
                    <span>{labels.panelId}</span>
                    <input
                      value={selectedPanelId}
                      readOnly
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
                    <span>{labels.panelContexts}</span>
                    <input
                      value={(rightPanels.find((item) => item.panelId === selectedPanelId)?.contexts || []).join(", ")}
                      readOnly
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

                {panelEditorMode === "guided" ? (
                  <div style={{ display: "grid", gap: "0.55rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.45rem" }}>
                      <label style={{ display: "grid", gap: "0.2rem" }}>
                        <span>{labels.panelDisplayName}</span>
                        <input
                          value={parsePanelEditor()?.displayName ? String(parsePanelEditor()?.displayName) : ""}
                          onChange={(event) =>
                            updatePanelEditor((current) => ({ ...current, displayName: event.target.value }))
                          }
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
                        <span>{labels.panelTitleTemplate}</span>
                        <input
                          value={parsePanelEditor()?.titleTemplate ? String(parsePanelEditor()?.titleTemplate) : ""}
                          onChange={(event) =>
                            updatePanelEditor((current) => ({ ...current, titleTemplate: event.target.value }))
                          }
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
                        <span>{labels.panelSubtitleTemplate}</span>
                        <input
                          value={parsePanelEditor()?.subtitleTemplate ? String(parsePanelEditor()?.subtitleTemplate) : ""}
                          onChange={(event) =>
                            updatePanelEditor((current) => ({ ...current, subtitleTemplate: event.target.value }))
                          }
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
                        <span>{labels.panelContexts}</span>
                        <input
                          value={Array.isArray(parsePanelEditor()?.contexts) ? (parsePanelEditor()?.contexts as string[]).join(", ") : ""}
                          onChange={(event) =>
                            updatePanelEditor((current) => ({
                              ...current,
                              contexts: event.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            }))
                          }
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

                    <div style={{ display: "grid", gap: "0.45rem" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ fontSize: "0.82rem" }}>{labels.panelSections}</strong>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          style={{ fontSize: "0.75rem" }}
                          onClick={addSection}
                        >
                          {labels.panelAddSection}
                        </button>
                      </div>

                      {(Array.isArray(parsePanelEditor()?.sections)
                        ? (parsePanelEditor()?.sections as Array<Record<string, unknown>>)
                        : []
                      ).map((section, sectionIndex) => (
                        <div key={`section_editor_${sectionIndex}`} style={{ border: "1px solid var(--border-color)", borderRadius: "0.55rem", padding: "0.55rem", display: "grid", gap: "0.45rem" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.35rem" }}>
                            <input
                              value={String(section.key || "")}
                              placeholder="section key"
                              onChange={(event) => updateSection(sectionIndex, { key: event.target.value })}
                              style={{
                                padding: "0.42rem 0.6rem",
                                borderRadius: "0.45rem",
                                border: "1px solid var(--border-color)",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                              }}
                            />
                            <input
                              value={String(section.title || "")}
                              placeholder="section title"
                              onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
                              style={{
                                padding: "0.42rem 0.6rem",
                                borderRadius: "0.45rem",
                                border: "1px solid var(--border-color)",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                              }}
                            />
                            <button
                              type="button"
                              className="admin-btn admin-btn-secondary"
                              style={{ fontSize: "0.75rem" }}
                              onClick={() => removeSection(sectionIndex)}
                            >
                              {labels.panelRemoveSection}
                            </button>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <strong style={{ fontSize: "0.78rem" }}>{labels.panelFields}</strong>
                            <button
                              type="button"
                              className="admin-btn admin-btn-secondary"
                              style={{ fontSize: "0.75rem" }}
                              onClick={() => addField(sectionIndex)}
                            >
                              {labels.panelAddField}
                            </button>
                          </div>

                          {(Array.isArray(section.fields) ? (section.fields as Array<Record<string, unknown>>) : []).map((field, fieldIndex) => (
                            <div key={`field_editor_${sectionIndex}_${fieldIndex}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.9fr 0.9fr auto", gap: "0.3rem" }}>
                              <input
                                value={String(field.key || "")}
                                placeholder="field key"
                                onChange={(event) => updateField(sectionIndex, fieldIndex, { key: event.target.value })}
                                style={{
                                  padding: "0.38rem 0.55rem",
                                  borderRadius: "0.45rem",
                                  border: "1px solid var(--border-color)",
                                  background: "var(--input-bg)",
                                  color: "var(--text-primary)",
                                }}
                              />
                              <input
                                value={String(field.label || "")}
                                placeholder="label"
                                onChange={(event) => updateField(sectionIndex, fieldIndex, { label: event.target.value })}
                                style={{
                                  padding: "0.38rem 0.55rem",
                                  borderRadius: "0.45rem",
                                  border: "1px solid var(--border-color)",
                                  background: "var(--input-bg)",
                                  color: "var(--text-primary)",
                                }}
                              />
                              <select
                                value={String(field.source || "raw")}
                                onChange={(event) => updateField(sectionIndex, fieldIndex, { source: event.target.value })}
                                style={{
                                  padding: "0.38rem 0.55rem",
                                  borderRadius: "0.45rem",
                                  border: "1px solid var(--border-color)",
                                  background: "var(--input-bg)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="raw">raw</option>
                                <option value="computed">computed</option>
                                <option value="relation">relation</option>
                                <option value="external">external</option>
                              </select>
                              <select
                                value={String(field.renderer || "text")}
                                onChange={(event) => updateField(sectionIndex, fieldIndex, { renderer: event.target.value })}
                                style={{
                                  padding: "0.38rem 0.55rem",
                                  borderRadius: "0.45rem",
                                  border: "1px solid var(--border-color)",
                                  background: "var(--input-bg)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="text">text</option>
                                <option value="formatted">formatted</option>
                                <option value="badge">badge</option>
                                <option value="progress">progress</option>
                                <option value="donut">donut</option>
                                <option value="link">link</option>
                              </select>
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                style={{ fontSize: "0.75rem" }}
                                onClick={() => removeField(sectionIndex, fieldIndex)}
                              >
                                {labels.panelRemoveField}
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label style={{ display: "grid", gap: "0.3rem" }}>
                    <span>{labels.panelEditor}</span>
                    <textarea
                      value={panelEditorText}
                      onChange={(event) => setPanelEditorText(event.target.value)}
                      rows={14}
                      style={{
                        width: "100%",
                        resize: "vertical",
                        padding: "0.55rem 0.65rem",
                        borderRadius: "0.45rem",
                        border: "1px solid var(--border-color)",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: "0.78rem",
                      }}
                    />
                  </label>
                )}

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <AsyncButton
                    type="button"
                    onClick={saveRightPanelConfig}
                    disabled={!selectedPanelId}
                    isLoading={savingPanelConfig}
                    isSuccess={panelConfigSaved}
                    loadingLabel={labels.panelSave}
                    successLabel={labels.panelSaved}
                    minWidth={220}
                  >
                    {labels.panelSave}
                  </AsyncButton>
                  {panelConfigError ? (
                    <span style={{ color: "var(--error-text)", fontSize: "0.82rem" }}>{panelConfigError}</span>
                  ) : null}
                </div>
              </div>
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
