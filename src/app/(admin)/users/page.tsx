"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useLocale } from "@/lib/use-locale";
import type { UserGroup, UserInvitation } from "@/lib/types";

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  isActive: number;
  profileImage?: string | null;
  groupId: string | null;
  groupName: string | null;
  createdAt?: string | null;
};

type GroupWithCount = UserGroup & { memberCount: number };

type SessionActor = {
  id: string;
  role: string;
  isSuperAdmin?: boolean;
  email?: string;
  fullName?: string;
};

type TabVisibilityRow = {
  id: string;
  title: string;
  enabled: boolean;
  superAdminOnly?: boolean;
  groupIds: string[];
};

type SubTab = "users" | "invitations" | "groups" | "tab-visibility";

export default function UsersPage() {
  const { locale } = useLocale();
  const [activeTab, setActiveTab] = useState<SubTab>("users");
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [loading, setLoading] = useState(true);

  // Users state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGroup, setFilterGroup] = useState("");

  // Invitations state
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [filterStatus, setFilterStatus] = useState("");

  // Groups state
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [tabVisibilityRows, setTabVisibilityRows] = useState<TabVisibilityRow[]>([]);
  const [selectedVisibilityGroupId, setSelectedVisibilityGroupId] = useState("");
  const [tabVisibilitySavingId, setTabVisibilitySavingId] = useState<string | null>(null);
  const [tabVisibilityError, setTabVisibilityError] = useState<string | null>(null);

  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  // Group creation
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupLoading, setNewGroupLoading] = useState(false);

  // Group editing
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  // Group change inline
  const [changingGroupUserId, setChangingGroupUserId] = useState<string | null>(null);

  const isSuperAdmin = actor?.isSuperAdmin === true;

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { method: "GET", cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.authenticated && data.user) {
        setActor(data.user);
      } else {
        setActor(null);
      }
    } catch { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) return;
      setUsers(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const res = await fetch("/api/invitations", { cache: "no-store" });
      if (!res.ok) return;
      setInvitations(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups", { cache: "no-store" });
      if (!res.ok) return;
      setGroups(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadTabVisibilityRows = useCallback(async () => {
    try {
      const res = await fetch("/api/tabs", { cache: "no-store" });
      if (!res.ok) {
        setTabVisibilityRows([]);
        return;
      }
      const rows = (await res.json()) as Array<{
        id: string;
        title: string;
        enabled?: boolean;
        superAdminOnly?: boolean;
        groupIds?: string[];
      }>;
      setTabVisibilityRows(
        rows
          .filter((row) => row.enabled !== false)
          .filter((row) => row.superAdminOnly !== true)
          .map((row) => ({
            id: row.id,
            title: row.title,
            enabled: row.enabled !== false,
            superAdminOnly: row.superAdminOnly,
            groupIds: Array.isArray(row.groupIds) ? row.groupIds : [],
          }))
      );
    } catch {
      setTabVisibilityRows([]);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadSession();
      await Promise.all([loadUsers(), loadInvitations(), loadGroups(), loadTabVisibilityRows()]);
      setLoading(false);
    };
    init();
  }, [loadSession, loadUsers, loadInvitations, loadGroups, loadTabVisibilityRows]);

  // ── Filtered data ──
  const filteredUsers = useMemo(() => {
    let list = users;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    if (filterGroup) {
      list = list.filter((u) => u.groupId === filterGroup);
    }
    return list;
  }, [users, searchQuery, filterGroup]);

  const filteredInvitations = useMemo(() => {
    if (!filterStatus) return invitations;
    return invitations.filter((i) => i.status === filterStatus);
  }, [invitations, filterStatus]);

  const availableGroupsForInvite = useMemo(() => {
    if (isSuperAdmin) return groups;
    return groups.filter((g) => !g.isAdmin);
  }, [groups, isSuperAdmin]);

  const tabVisibilitySelectableGroups = useMemo(
    () => (isSuperAdmin ? groups : groups.filter((group) => !group.isAdmin)),
    [groups, isSuperAdmin]
  );

  useEffect(() => {
    if (selectedVisibilityGroupId) return;
    if (tabVisibilitySelectableGroups.length === 0) return;
    setSelectedVisibilityGroupId(tabVisibilitySelectableGroups[0].id);
  }, [tabVisibilitySelectableGroups, selectedVisibilityGroupId]);

  const availableGroupsForChange = useCallback(
    (targetUser: UserRow) => {
      if (isSuperAdmin) return groups;
      // Admins can only change non-admin users to non-admin groups
      if (targetUser.role === "admin") return [];
      return groups.filter((g) => !g.isAdmin);
    },
    [groups, isSuperAdmin]
  );

  // ── Handlers ──
  const handleInvite = async () => {
    if (!inviteEmails.trim() || !inviteGroupId) return;
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const emails = inviteEmails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter(Boolean);
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, groupId: inviteGroupId }),
      });
      const data = await res.json();
      if (res.ok) {
        const results = data.results as Array<{ email: string; status: string }>;
        const sent = results.filter((r) => r.status === "sent").length;
        setInviteResult(
          locale === "fr"
            ? `${sent} invitation(s) envoyée(s) sur ${results.length}`
            : `${sent} invitation(s) sent out of ${results.length}`
        );
        setInviteEmails("");
        await loadInvitations();
      } else {
        setInviteResult(data.error || "Error");
      }
    } catch {
      setInviteResult("Error");
    }
    setInviteLoading(false);
  };

  const handleCancelInvitation = async (id: string) => {
    const ok = window.confirm(
      locale === "fr"
        ? "Annuler cette invitation ?"
        : "Cancel this invitation?"
    );
    if (!ok) return;
    await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    await loadInvitations();
  };

  const handleResendInvitation = async (id: string) => {
    await fetch(`/api/invitations/${id}/resend`, { method: "POST" });
    await loadInvitations();
  };

  const handleChangeGroup = async (userId: string, groupId: string) => {
    const user = users.find((u) => u.id === userId);
    const group = groups.find((g) => g.id === groupId);
    if (!user || !group) return;

    const ok = window.confirm(
      locale === "fr"
        ? `Changer le groupe de ${user.fullName} en "${group.name}" ?`
        : `Change ${user.fullName}'s group to "${group.name}"?`
    );
    if (!ok) {
      setChangingGroupUserId(null);
      return;
    }

    await fetch(`/api/users/${userId}/group`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    setChangingGroupUserId(null);
    await loadUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const ok = window.confirm(
      locale === "fr"
        ? `Supprimer l'utilisateur ${user.fullName} ?`
        : `Delete user ${user.fullName}?`
    );
    if (!ok) return;
    await fetch(`/api/users/${userId}`, { method: "DELETE" });
    await loadUsers();
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setNewGroupLoading(true);
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setNewGroupName("");
    setNewGroupLoading(false);
    await loadGroups();
  };

  const handleRenameGroup = async (id: string) => {
    if (!editingGroupName.trim()) return;
    await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingGroupName.trim() }),
    });
    setEditingGroupId(null);
    setEditingGroupName("");
    await loadGroups();
  };

  const handleDeleteGroup = async (id: string) => {
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    const ok = window.confirm(
      locale === "fr"
        ? `Supprimer le groupe "${group.name}" ?`
        : `Delete group "${group.name}"?`
    );
    if (!ok) return;
    const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Error");
      return;
    }
    await loadGroups();
  };

  const isGroupVisibleForTab = useCallback(
    (row: TabVisibilityRow, groupId: string) => {
      if (row.groupIds.length === 0) return true;
      return row.groupIds.includes(groupId);
    },
    []
  );

  const toggleTabVisibilityForGroup = useCallback(
    (tabId: string, groupId: string) => {
      const selectableGroupIdSet = new Set(tabVisibilitySelectableGroups.map((group) => group.id));
      setTabVisibilityRows((prev) =>
        prev.map((row) => {
          if (row.id !== tabId) return row;

          const preservedGroupIds = row.groupIds.filter((id) => !selectableGroupIdSet.has(id));
          const currentSelectableGroupIds =
            row.groupIds.length === 0
              ? tabVisibilitySelectableGroups.map((group) => group.id)
              : row.groupIds.filter((id) => selectableGroupIdSet.has(id));

          const isCurrentlyVisible =
            row.groupIds.length === 0 ? true : currentSelectableGroupIds.includes(groupId);

          const nextSelectableGroupIds = isCurrentlyVisible
            ? currentSelectableGroupIds.filter((id) => id !== groupId)
            : Array.from(new Set([...currentSelectableGroupIds, groupId]));

          return {
            ...row,
            groupIds: Array.from(new Set([...preservedGroupIds, ...nextSelectableGroupIds])),
          };
        })
      );
    },
    [tabVisibilitySelectableGroups]
  );

  const handleSaveTabVisibility = useCallback(
    async (tabId: string) => {
      const row = tabVisibilityRows.find((item) => item.id === tabId);
      if (!row) return;

      setTabVisibilitySavingId(tabId);
      setTabVisibilityError(null);
      try {
        const res = await fetch(`/api/tabs/${tabId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupIds: row.groupIds }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setTabVisibilityError(data?.error || "Error");
          return;
        }
        await loadTabVisibilityRows();
      } catch {
        setTabVisibilityError("Error");
      } finally {
        setTabVisibilitySavingId(null);
      }
    },
    [loadTabVisibilityRows, tabVisibilityRows]
  );

  // ── Helpers ──
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      pending: { bg: "rgba(234, 179, 8, 0.15)", text: "#eab308", icon: "🟡" },
      accepted: { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e", icon: "🟢" },
      expired: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", icon: "🔴" },
    };
    const c = colors[status] ?? colors.pending;
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: "0.75rem",
          fontWeight: 500,
          background: c.bg,
          color: c.text,
        }}
      >
        {c.icon} {status}
      </span>
    );
  };

  const inviterName = (invitedBy: string) => {
    const u = users.find((u) => u.id === invitedBy);
    return u?.fullName || invitedBy;
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
        {locale === "fr" ? "Chargement…" : "Loading…"}
      </div>
    );
  }

  // ── Styles ──
  const sectionStyle: React.CSSProperties = {
    padding: "1.5rem",
    maxWidth: 1200,
    margin: "0 auto",
  };

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    gap: "0.25rem",
    borderBottom: "1px solid var(--border-color)",
    marginBottom: "1.5rem",
  };

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1rem",
    border: "none",
    borderBottom: active ? "2px solid var(--accent-color, #2563eb)" : "2px solid transparent",
    background: "none",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    fontSize: "0.875rem",
    transition: "all 0.15s ease",
  });

  const cardStyle: React.CSSProperties = {
    background: "var(--card-bg, var(--bg-secondary))",
    borderRadius: "0.75rem",
    border: "1px solid var(--border-color)",
    overflow: "hidden",
  };

  const thStyle: React.CSSProperties = {
    padding: "0.75rem 1rem",
    textAlign: "left",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border-color)",
    background: "var(--bg-tertiary, var(--bg-secondary))",
  };

  const tdStyle: React.CSSProperties = {
    padding: "0.75rem 1rem",
    fontSize: "0.875rem",
    borderBottom: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  const inputStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid var(--border-color)",
    background: "var(--input-bg, var(--bg-primary))",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    outline: "none",
    width: "100%",
  };

  const btnPrimary: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.5rem 1rem",
    borderRadius: "0.5rem",
    border: "1px solid rgba(129, 140, 248, 0.8)",
    background: "linear-gradient(120deg, rgba(30, 64, 175, 0.9), rgba(79, 70, 229, 0.9))",
    color: "#fff",
    fontWeight: 500,
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const btnSecondary: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.5rem 1rem",
    borderRadius: "0.5rem",
    border: "1px solid var(--border-color)",
    background: "var(--button-bg, var(--bg-secondary))",
    color: "var(--text-primary)",
    fontWeight: 500,
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const btnDanger: React.CSSProperties = {
    ...btnSecondary,
    color: "#ef4444",
    borderColor: "rgba(239, 68, 68, 0.3)",
  };

  const btnSmall: React.CSSProperties = {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
  };

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: "0.75rem",
    fontWeight: 500,
    background: `${color}20`,
    color,
    cursor: "pointer",
  });

  const groupBadgeForUser = (user: UserRow) => {
    const isChanging = changingGroupUserId === user.id;
    const availableGroups = availableGroupsForChange(user);
    const canChange = user.id !== actor?.id && availableGroups.length > 0;

    if (isChanging && canChange && availableGroups.length > 0) {
      return (
        <select
          autoFocus
          style={{
            ...inputStyle,
            width: "auto",
            padding: "2px 6px",
            fontSize: "0.75rem",
          }}
          value={user.groupId ?? ""}
          onChange={(e) => handleChangeGroup(user.id, e.target.value)}
          onBlur={() => setChangingGroupUserId(null)}
        >
          <option value="" disabled>
            {locale === "fr" ? "Choisir un groupe" : "Select group"}
          </option>
          {availableGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      );
    }

    return (
      <span
        style={badgeStyle(user.role === "admin" ? "#8b5cf6" : "#2563eb")}
        onClick={canChange ? () => setChangingGroupUserId(user.id) : undefined}
        title={canChange ? (locale === "fr" ? "Cliquer pour modifier" : "Click to change") : ""}
      >
        {user.groupName || (locale === "fr" ? "Aucun" : "None")}
      </span>
    );
  };

  // ── Modal ──
  const inviteModal = showInviteModal ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={() => setShowInviteModal(false)}
    >
      <div
        style={{
          background: "var(--modal-bg, var(--bg-primary))",
          borderRadius: "0.75rem",
          border: "1px solid var(--border-color)",
          padding: "1.5rem",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", color: "var(--text-primary)" }}>
          {locale === "fr" ? "Inviter des utilisateurs" : "Invite Users"}
        </h3>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 4 }}>
            {locale === "fr" ? "Email(s) — séparés par virgule ou retour à la ligne" : "Email(s) — comma or newline separated"}
          </label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 4 }}>
            {locale === "fr" ? "Groupe" : "Group"}
          </label>
          <select
            style={inputStyle}
            value={inviteGroupId}
            onChange={(e) => setInviteGroupId(e.target.value)}
          >
            <option value="">{locale === "fr" ? "Sélectionner un groupe" : "Select a group"}</option>
            {availableGroupsForInvite.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        {inviteResult && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              background: "var(--bg-tertiary)",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              marginBottom: "1rem",
            }}
          >
            {inviteResult}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            style={btnSecondary}
            onClick={() => {
              setShowInviteModal(false);
              setInviteResult(null);
            }}
          >
            {locale === "fr" ? "Annuler" : "Cancel"}
          </button>
          <button
            type="button"
            style={{
              ...btnPrimary,
              opacity: inviteLoading || !inviteEmails.trim() || !inviteGroupId ? 0.6 : 1,
            }}
            disabled={inviteLoading || !inviteEmails.trim() || !inviteGroupId}
            onClick={handleInvite}
          >
            {inviteLoading
              ? locale === "fr"
                ? "Envoi…"
                : "Sending…"
              : locale === "fr"
              ? "Envoyer l'invitation"
              : "Send Invitation"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div style={sectionStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          {locale === "fr" ? "Utilisateurs" : "Users"}
        </h1>
      </div>

      {/* Sub-tabs */}
      <div style={tabBarStyle}>
        {(
          [
            { key: "users" as SubTab, label: locale === "fr" ? "Utilisateurs" : "Users" },
            { key: "invitations" as SubTab, label: "Invitations" },
            { key: "groups" as SubTab, label: locale === "fr" ? "Groupes" : "Groups" },
            { key: "tab-visibility" as SubTab, label: locale === "fr" ? "Visibilité des onglets" : "Tab visibility" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            style={tabButtonStyle(activeTab === tab.key)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════ Users Tab ═══════ */}
      {activeTab === "users" && (
        <div>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
            }}
          >
            <input
              style={{ ...inputStyle, maxWidth: 300 }}
              placeholder={locale === "fr" ? "Rechercher par nom ou email…" : "Search by name or email…"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              style={{ ...inputStyle, maxWidth: 200 }}
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
            >
              <option value="">{locale === "fr" ? "Tous les groupes" : "All groups"}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <div style={{ flex: 1 }} />
            <button type="button" style={btnPrimary} onClick={() => setShowInviteModal(true)}>
              + {locale === "fr" ? "Inviter" : "Invite"}
            </button>
          </div>

          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>{locale === "fr" ? "Utilisateur" : "User"}</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>{locale === "fr" ? "Groupe" : "Group"}</th>
                  <th style={thStyle}>{locale === "fr" ? "Inscrit le" : "Joined"}</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "var(--text-secondary)" }}>
                      {locale === "fr" ? "Aucun utilisateur trouvé" : "No users found"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="admin-table-row">
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {user.profileImage ? (
                            <Image
                              src={user.profileImage}
                              alt=""
                              width={32}
                              height={32}
                              style={{
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                              }}
                            >
                              {getInitials(user.fullName)}
                            </div>
                          )}
                          <span style={{ fontWeight: 500 }}>{user.fullName}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>{user.email}</td>
                      <td style={tdStyle}>{groupBadgeForUser(user)}</td>
                      <td style={tdStyle}>{formatDate(user.createdAt)}</td>
                      <td style={tdStyle}>
                        {isSuperAdmin && user.id !== actor?.id && (
                          <button
                            type="button"
                            style={{ ...btnDanger, ...btnSmall }}
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            {locale === "fr" ? "Supprimer" : "Delete"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ Invitations Tab ═══════ */}
      {activeTab === "invitations" && (
        <div>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
            }}
          >
            <select
              style={{ ...inputStyle, maxWidth: 200 }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">{locale === "fr" ? "Tous les statuts" : "All statuses"}</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="expired">Expired</option>
            </select>
            <div style={{ flex: 1 }} />
            <button type="button" style={btnPrimary} onClick={() => setShowInviteModal(true)}>
              + {locale === "fr" ? "Inviter" : "Invite"}
            </button>
          </div>

          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>{locale === "fr" ? "Groupe" : "Group"}</th>
                  <th style={thStyle}>{locale === "fr" ? "Statut" : "Status"}</th>
                  <th style={thStyle}>{locale === "fr" ? "Invité par" : "Invited by"}</th>
                  <th style={thStyle}>{locale === "fr" ? "Envoyé le" : "Sent"}</th>
                  <th style={thStyle}>{locale === "fr" ? "Expire le" : "Expires"}</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "var(--text-secondary)" }}>
                      {locale === "fr" ? "Aucune invitation" : "No invitations"}
                    </td>
                  </tr>
                ) : (
                  filteredInvitations.map((inv) => {
                    const group = groups.find((g) => g.id === inv.groupId);
                    return (
                      <tr key={inv.id} className="admin-table-row">
                        <td style={tdStyle}>{inv.email}</td>
                        <td style={tdStyle}>
                          <span style={badgeStyle("#2563eb")}>{group?.name ?? "—"}</span>
                        </td>
                        <td style={tdStyle}>{getStatusBadge(inv.status)}</td>
                        <td style={tdStyle}>{inviterName(inv.invitedBy)}</td>
                        <td style={tdStyle}>{formatDate(inv.createdAt)}</td>
                        <td style={tdStyle}>{formatDate(inv.expiresAt)}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {(inv.status === "pending" || inv.status === "expired") && (
                              <button
                                type="button"
                                style={{ ...btnSecondary, ...btnSmall }}
                                onClick={() => handleResendInvitation(inv.id)}
                              >
                                {locale === "fr" ? "Renvoyer" : "Resend"}
                              </button>
                            )}
                            {inv.status === "pending" && (
                              <button
                                type="button"
                                style={{ ...btnDanger, ...btnSmall }}
                                onClick={() => handleCancelInvitation(inv.id)}
                              >
                                {locale === "fr" ? "Annuler" : "Cancel"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ Groups Tab ═══════ */}
      {activeTab === "groups" && (
        <div>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <input
              style={{ ...inputStyle, maxWidth: 250 }}
              placeholder={locale === "fr" ? "Nom du nouveau groupe" : "New group name"}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
            />
            <button
              type="button"
              style={{
                ...btnPrimary,
                opacity: newGroupLoading || !newGroupName.trim() ? 0.6 : 1,
              }}
              disabled={newGroupLoading || !newGroupName.trim()}
              onClick={handleCreateGroup}
            >
              + {locale === "fr" ? "Nouveau groupe" : "New group"}
            </button>
          </div>

          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>{locale === "fr" ? "Nom" : "Name"}</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>{locale === "fr" ? "Membres" : "Members"}</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="admin-table-row">
                    <td style={tdStyle}>
                      {editingGroupId === group.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <input
                            autoFocus
                            style={{ ...inputStyle, width: "auto", padding: "2px 6px", fontSize: "0.85rem" }}
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameGroup(group.id);
                              if (e.key === "Escape") {
                                setEditingGroupId(null);
                                setEditingGroupName("");
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontWeight: 500 }}>{group.name}</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={badgeStyle(group.isAdmin ? "#8b5cf6" : "#6b7280")}
                      >
                        {group.isAdmin
                          ? locale === "fr"
                            ? "Système"
                            : "System"
                          : "Custom"}
                      </span>
                    </td>
                    <td style={tdStyle}>{group.memberCount}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {editingGroupId === group.id ? (
                          <>
                            <button
                              type="button"
                              style={{ ...btnPrimary, ...btnSmall }}
                              disabled={!editingGroupName.trim()}
                              onClick={() => handleRenameGroup(group.id)}
                            >
                              {locale === "fr" ? "Enregistrer" : "Save"}
                            </button>
                            <button
                              type="button"
                              style={{ ...btnSecondary, ...btnSmall }}
                              onClick={() => {
                                setEditingGroupId(null);
                                setEditingGroupName("");
                              }}
                            >
                              {locale === "fr" ? "Annuler" : "Cancel"}
                            </button>
                          </>
                        ) : (
                          !group.isAdmin && (
                            <button
                              type="button"
                              style={{ ...btnSecondary, ...btnSmall }}
                              onClick={() => {
                                setEditingGroupId(group.id);
                                setEditingGroupName(group.name);
                              }}
                            >
                              {locale === "fr" ? "Renommer" : "Rename"}
                            </button>
                          )
                        )}
                        {editingGroupId !== group.id && isSuperAdmin && !group.isAdmin && group.memberCount === 0 && (
                          <button
                            type="button"
                            style={{ ...btnDanger, ...btnSmall }}
                            onClick={() => handleDeleteGroup(group.id)}
                          >
                            {locale === "fr" ? "Supprimer" : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ Tab visibility Tab ═══════ */}
      {activeTab === "tab-visibility" && (
        <div>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
            }}
          >
            <select
              style={{ ...inputStyle, maxWidth: 280 }}
              value={selectedVisibilityGroupId}
              onChange={(e) => setSelectedVisibilityGroupId(e.target.value)}
            >
              <option value="">{locale === "fr" ? "Sélectionner un groupe" : "Select a group"}</option>
              {tabVisibilitySelectableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {tabVisibilityError && (
            <div
              style={{
                marginBottom: "0.75rem",
                color: "#ef4444",
                fontSize: "0.85rem",
              }}
            >
              {tabVisibilityError}
            </div>
          )}

          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>{locale === "fr" ? "Onglet" : "Tab"}</th>
                  <th style={thStyle}>{locale === "fr" ? "Visible" : "Visible"}</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tabVisibilityRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "var(--text-secondary)" }}>
                      {locale === "fr" ? "Aucun onglet dynamique" : "No dynamic tabs"}
                    </td>
                  </tr>
                ) : (
                  tabVisibilityRows.map((row) => {
                    const disabled = !selectedVisibilityGroupId;
                    const checked =
                      selectedVisibilityGroupId.length > 0
                        ? isGroupVisibleForTab(row, selectedVisibilityGroupId)
                        : false;

                    return (
                      <tr key={row.id} className="admin-table-row">
                        <td style={tdStyle}>{row.title}</td>
                        <td style={tdStyle}>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: disabled ? "not-allowed" : "pointer" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => {
                                if (!selectedVisibilityGroupId) return;
                                toggleTabVisibilityForGroup(row.id, selectedVisibilityGroupId);
                              }}
                            />
                            <span>{checked ? (locale === "fr" ? "Oui" : "Yes") : (locale === "fr" ? "Non" : "No")}</span>
                          </label>
                        </td>
                        <td style={tdStyle}>
                          <button
                            type="button"
                            style={{ ...btnPrimary, ...btnSmall }}
                            disabled={tabVisibilitySavingId === row.id}
                            onClick={() => handleSaveTabVisibility(row.id)}
                          >
                            {tabVisibilitySavingId === row.id
                              ? locale === "fr"
                                ? "Enregistrement…"
                                : "Saving…"
                              : locale === "fr"
                              ? "Enregistrer"
                              : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inviteModal}
    </div>
  );
}
