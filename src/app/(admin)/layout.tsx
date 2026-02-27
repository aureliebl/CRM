"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/admin/Breadcrumb";
import { ClientSearch } from "@/components/admin/ClientSearch";
import { BugReportModal } from "@/components/admin/BugReportModal";
import { AircallButton } from "@/components/admin/AircallButton";
import { AircallWidget } from "@/components/admin/AircallWidget";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/use-locale";
import { APP_MATERIAL_SYMBOLS } from "@/lib/material-symbols";

interface SidebarTabItem {
  id: string;
  slug: string;
  title: string;
  icon?: string;
}

type LocalUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "operator";
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
  totpEnabled?: number;
};

function AdminSidebar({ user, isSidebarCollapsed, onExpandSidebar }: { user: LocalUser; isSidebarCollapsed: boolean; onExpandSidebar: () => void }) {
  const pathname = usePathname() || "/dashboard";
  const { t, locale } = useLocale();
  const isAdmin = user?.role === "admin";
  const [dynamicTabs, setDynamicTabs] = useState<SidebarTabItem[]>([]);
  const [isTestOpen, setIsTestOpen] = useState(false);

  useEffect(() => {
    const loadTabs = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/tabs`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setDynamicTabs([]);
          return;
        }

        const data = (await res.json()) as Array<{ id: string; slug: string; title: string; icon?: string }>;
        setDynamicTabs(
          data.map((item) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            icon: item.icon,
          }))
        );
      } catch {
        setDynamicTabs([]);
      }
    };

    loadTabs();

    // Re-fetch when a tab is created / edited / deleted
    const refresh = () => { loadTabs(); };
    window.addEventListener("tabs:refresh", refresh);
    return () => window.removeEventListener("tabs:refresh", refresh);
  }, [user?.id]);

  const navItems = [
    { href: "/dashboard", label: t.navigation.dashboard, icon: APP_MATERIAL_SYMBOLS.navigation.dashboard },
    { href: "/geo", label: t.navigation.geo ?? "GEO", icon: APP_MATERIAL_SYMBOLS.navigation.geo },
    ...dynamicTabs.map((tab) => ({
      href: `/tabs/${tab.slug}`,
      label: tab.title,
      icon: tab.icon || APP_MATERIAL_SYMBOLS.navigation.components,
      deletable: true,
      tabId: tab.id,
    })),
    { href: "/crm", label: locale === "fr" ? "Fiche client" : "Client file", icon: "person" },
    { href: "/acquisition", label: locale === "fr" ? "Acquisition" : "Acquisition", icon: "trending_up" },
    { href: "/tarifs", label: locale === "fr" ? "Grille tarifaire" : "Pricing grid", icon: "payments" },
    ...(isAdmin
      ? [
          {
            href: "/security",
            label: t.navigation.security,
            icon: APP_MATERIAL_SYMBOLS.navigation.security,
          },
        ]
      : []),
  ];

  const legacyTestItems = [
    { href: "/clients", label: t.navigation.clients, icon: APP_MATERIAL_SYMBOLS.navigation.clients },
    { href: "/pricing", label: t.navigation.pricing, icon: APP_MATERIAL_SYMBOLS.navigation.pricing },
    { href: "/content", label: t.navigation.content, icon: APP_MATERIAL_SYMBOLS.navigation.content },
    {
      href: "/components-registry",
      label: t.navigation.components,
      icon: APP_MATERIAL_SYMBOLS.navigation.components,
    },
    { href: "/bookings", label: t.navigation.bookings, icon: APP_MATERIAL_SYMBOLS.navigation.bookings },
    { href: "/live-users", label: t.navigation.live_users, icon: APP_MATERIAL_SYMBOLS.navigation.liveUsers },
  ];

  const isTestSectionActive = legacyTestItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  useEffect(() => {
    if (isTestSectionActive) {
      setIsTestOpen(true);
    }
  }, [isTestSectionActive]);

  const handleGroupToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    if (isSidebarCollapsed) {
      onExpandSidebar();
      // After expanding, open the group
      setTimeout(() => setter(true), 50);
    } else {
      setter((current) => !current);
    }
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-logo">
        <div className="admin-logo-mark" style={{ background: 'transparent', padding: 0, boxShadow: 'none' }}>
          <Image
            src="/logo.svg"
            alt="Costockage Logo"
            width={28}
            height={28}
            style={{ borderRadius: '0.75rem' }}
          />
        </div>
        <span>{t.costockage_admin}</span>
      </div>
      <div className="admin-sidebar-nav-area">
        <div className="admin-nav-section-label">
          {locale === "fr" ? "Navigation" : "Navigation"}
        </div>
        <ul className="admin-nav-list">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const navItem = item as typeof item & { deletable?: boolean; tabId?: string };
            return (
              <li key={item.href}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Link
                    href={item.href}
                    className={[
                      "admin-nav-link",
                      isActive ? "admin-nav-link-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ flex: 1 }}
                  >
                    <span className="admin-nav-link-icon">
                      <MaterialSymbol name={item.icon} size={20} weight={500} opticalSize={24} />
                    </span>
                    <span className="admin-nav-link-label">{item.label}</span>
                  </Link>
                  {isAdmin && navItem.deletable && navItem.tabId && (
                    <button
                      type="button"
                      className="admin-nav-delete-btn"
                      title={locale === "fr" ? "Supprimer cet onglet" : "Delete this tab"}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmed = window.confirm(
                          locale === "fr"
                            ? `Supprimer l'onglet « ${item.label} » ?`
                            : `Delete the tab "${item.label}"?`
                        );
                        if (!confirmed) return;
                        try {
                          const res = await fetch(`/api/tabs/${navItem.tabId}`, { method: "DELETE" });
                          if (res.ok) {
                            window.dispatchEvent(new Event("tabs:refresh"));
                            // Navigate away if currently viewing the deleted tab
                            if (pathname.startsWith(item.href)) {
                              window.location.href = "/dashboard";
                            }
                          }
                        } catch { /* ignore */ }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px 6px",
                        color: "var(--text-tertiary, #999)",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <MaterialSymbol name="close" size={16} weight={500} opticalSize={20} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}

          {isAdmin && (
            <li>
              <button
                type="button"
                onClick={() => handleGroupToggle(setIsTestOpen)}
                aria-expanded={isTestOpen}
                className={[
                  "admin-nav-link",
                  "admin-nav-group-header",
                  isTestSectionActive ? "admin-nav-link-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="admin-nav-link-icon">
                  <MaterialSymbol name={APP_MATERIAL_SYMBOLS.navigation.components} size={20} weight={500} opticalSize={24} />
                </span>
                <span className="admin-nav-link-label">Test</span>
                <span className={["admin-subnav-chevron", isTestOpen ? "admin-subnav-chevron-open" : ""].join(" ")}>
                  <MaterialSymbol name={APP_MATERIAL_SYMBOLS.actions.chevronRight} size={18} weight={500} opticalSize={20} />
                </span>
              </button>

              <ul className={["admin-subnav-list", isTestOpen ? "" : "admin-subnav-list-collapsed"].filter(Boolean).join(" ")}>
                {legacyTestItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={[
                          "admin-nav-link",
                          "admin-subnav-link",
                          isActive ? "admin-nav-link-active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="admin-nav-link-icon">
                          <MaterialSymbol name={item.icon} size={18} weight={500} opticalSize={20} />
                        </span>
                        <span className="admin-nav-link-label">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          )}
        </ul>
      </div>
      {isAdmin && (
        <div style={{ marginTop: "auto", paddingTop: "0.75rem" }}>
          <Link
            href="/tabs/new"
            className="admin-nav-link"
            style={{
              borderStyle: "dashed",
              borderColor: "var(--border-color)",
            }}
          >
            <span className="admin-nav-link-icon">
              <MaterialSymbol name={APP_MATERIAL_SYMBOLS.actions.addTab} size={20} weight={500} opticalSize={24} />
            </span>
            <span className="admin-nav-link-label">{t.navigation.new_tab}</span>
          </Link>
        </div>
      )}
    </aside>
  );
}

function AdminTopbar({
  user,
  isSidebarCollapsed,
  onToggleSidebar,
}: {
  user: LocalUser;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const [showBugModal, setShowBugModal] = useState(false);
  const { locale, t, setLocale } = useLocale();
  const labels =
    locale === "fr"
      ? {
          languageAria: "Changer la langue",
          connectedAs: "Connecté en tant que",
          collapseSidebar: "Réduire la barre latérale",
          expandSidebar: "Déployer la barre latérale",
        }
      : {
          languageAria: "Change language",
          connectedAs: "Connected as",
          collapseSidebar: "Collapse sidebar",
          expandSidebar: "Expand sidebar",
        };

  const toggleLocale = async () => {
    const next = locale === "fr" ? "en" : "fr";
    await setLocale(next);
  };

  const displayName = user?.fullName ?? "";
  const firstName = user?.firstName ?? displayName.split(" ")[0] ?? "";
  const lastName = user?.lastName ?? "";
  const resolvedDisplayName = `${firstName} ${lastName}`.trim() || displayName;
  const initialsSource = `${firstName} ${lastName}`.trim() || displayName;
  const initials = initialsSource
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Keyboard shortcut to focus search: Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("client-search-input") as HTMLInputElement | null;
        if (el) {
          el.focus();
          el.select();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar-left" style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={isSidebarCollapsed ? labels.expandSidebar : labels.collapseSidebar}
              title={isSidebarCollapsed ? labels.expandSidebar : labels.collapseSidebar}
              className="admin-sidebar-toggle"
            >
              <MaterialSymbol
                name={
                  isSidebarCollapsed
                    ? APP_MATERIAL_SYMBOLS.actions.chevronRight
                    : APP_MATERIAL_SYMBOLS.actions.chevronLeft
                }
                size={18}
                weight={500}
                opticalSize={20}
              />
            </button>
            <div style={{ flex: 1 }}>
              <ClientSearch inputId="client-search-input" placeholder={t.search_placeholder} maxWidth="100%" />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }} />
          {/* center removed; search moved to the left */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginLeft: "auto" }}>
            <AircallButton />
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={labels.languageAria}
              title={locale === "fr" ? "Français" : "English"}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "999px",
                border: "1px solid var(--border-hover)",
                background: "var(--button-bg)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                lineHeight: 1,
                color: "var(--text-primary)",
                minWidth: "3.2rem",
              }}
            >
              <MaterialSymbol
                name={APP_MATERIAL_SYMBOLS.actions.language}
                size={17}
                weight={500}
                opticalSize={20}
                style={{ marginRight: "0.3rem" }}
              />
              {locale === "fr" ? "FR" : "EN"}
            </button>
            <button
              type="button"
              onClick={() => setShowBugModal(true)}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "999px",
                border: "1px solid var(--border-hover)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
              title={t.report_bug}
            >
              <MaterialSymbol
                name={APP_MATERIAL_SYMBOLS.actions.bug}
                size={16}
                weight={500}
                opticalSize={20}
              />
              {t.bug}
            </button>
            {user && (
              <Link href="/settings" title={t.settings_title}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "var(--text-primary, #e5e7eb)",
                    fontSize: "0.9rem",
                  }}
                    title={`${labels.connectedAs} ${resolvedDisplayName} (${user.role})`}
                >
                  <span style={{ fontWeight: 600 }}>{firstName}</span>
                  {user.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt={resolvedDisplayName}
                      style={{ width: 32, height: 32, borderRadius: 999, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        background: "linear-gradient(135deg,#64748b,#0ea5a9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </div>
              </Link>
            )}
          </div>
        </div>
      </header>
      <BugReportModal
        isOpen={showBugModal}
        onClose={() => setShowBugModal(false)}
      />
    </>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";
  const [user, setUser] = useState<LocalUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const loadCurrentUser = useCallback(async () => {
    try {
      const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
      if (!sessionRes.ok) {
        setUser(null);
        setAuthResolved(true);
        return;
      }

      const sessionPayload = (await sessionRes.json()) as {
        authenticated?: boolean;
        user?: {
          id: string;
          email: string;
          fullName: string;
          role: "admin" | "operator";
        };
      };

      if (!sessionPayload.authenticated || !sessionPayload.user) {
        setUser(null);
        setAuthResolved(true);
        return;
      }

      const sessionUser = sessionPayload.user;

      const accountRes = await fetch(`/api/accounts/${encodeURIComponent(sessionUser.id)}`, {
        cache: "no-store",
      });

      if (!accountRes.ok) {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email,
          fullName: sessionUser.fullName,
          role: sessionUser.role,
          totpEnabled: 0,
        });
        setAuthResolved(true);
        return;
      }

      const account = (await accountRes.json()) as {
        id: string;
        email: string;
        fullName: string;
        role: "admin" | "operator";
        firstName?: string | null;
        lastName?: string | null;
        profileImage?: string | null;
        totpEnabled?: number;
      };

      setUser({
        id: account.id,
        email: account.email,
        fullName: account.fullName,
        role: account.role,
        firstName: account.firstName,
        lastName: account.lastName,
        profileImage: account.profileImage,
        totpEnabled: account.totpEnabled ?? 0,
      });
    } catch {
      setUser(null);
    } finally {
      setAuthResolved(true);
    }
  }, []);

  useEffect(() => {
    const savedSidebarState = window.localStorage.getItem("admin:sidebar-collapsed");
    if (savedSidebarState !== null) {
      setIsSidebarCollapsed(savedSidebarState === "1");
    }
    setMounted(true);
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("admin:sidebar-collapsed", isSidebarCollapsed ? "1" : "0");
  }, [isSidebarCollapsed, mounted]);

  useEffect(() => {
    const handler = () => {
      void loadCurrentUser();
    };
    window.addEventListener("user:update", handler);
    return () => window.removeEventListener("user:update", handler);
  }, [loadCurrentUser]);

  useEffect(() => {
    if (!mounted || !authResolved) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const isAdminOnlyRoute =
      pathname.startsWith("/security") || pathname === "/tabs/new" || pathname.includes("/tabs/") && pathname.endsWith("/edit");
    if (isAdminOnlyRoute && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [router, user, mounted, authResolved, pathname]);

  if (!mounted || !authResolved || !user) return null;

  return (
    <div className={["admin-shell", isSidebarCollapsed ? "sidebar-collapsed" : ""].filter(Boolean).join(" ")}>
      <AdminSidebar user={user} isSidebarCollapsed={isSidebarCollapsed} onExpandSidebar={() => setIsSidebarCollapsed(false)} />
      <div className="admin-content-shell">
        <AdminTopbar
          user={user}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <Breadcrumb />
        <main className="admin-main">
          <div className="admin-main-inner">{children}</div>
        </main>
      </div>
      <AircallWidget />
    </div>
  );
}

