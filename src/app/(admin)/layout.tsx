"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/admin/Breadcrumb";
import { ClientSearch } from "@/components/admin/ClientSearch";
import { BugReportModal } from "@/components/admin/BugReportModal";
import { AircallButton } from "@/components/admin/AircallButton";
import { AircallWidget } from "@/components/admin/AircallWidget";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/use-locale";
import { APP_MATERIAL_SYMBOLS } from "@/lib/material-symbols";
import { RightPanelProvider } from "@/components/admin/right-panel/RightPanelProvider";

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
  isSuperAdmin?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
  totpEnabled?: number;
};

function AdminSidebar({
  user,
  onToggleSidebar,
  onVisibleRoutesChange,
  routeVisibility,
}: {
  user: LocalUser;
  onToggleSidebar: () => void;
  onVisibleRoutesChange?: (routes: string[]) => void;
  routeVisibility?: { configured: boolean; routeKeys: string[] } | null;
}) {
  const pathname = usePathname() || "/dashboard";
  const { t, locale } = useLocale();
  const isSuperAdmin = user?.isSuperAdmin === true;
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

  const navItems = useMemo(
    () => [
      { href: "/dashboard", label: t.navigation.dashboard, icon: APP_MATERIAL_SYMBOLS.navigation.dashboard },
      { href: "/geo", label: t.navigation.geo ?? "GEO", icon: APP_MATERIAL_SYMBOLS.navigation.geo },
      ...dynamicTabs.map((tab) => ({
        href: `/tabs/${tab.slug}`,
        label: tab.title,
        icon: tab.icon || APP_MATERIAL_SYMBOLS.navigation.components,
        deletable: true,
        tabId: tab.id,
      })),
      { href: "/vault", label: locale === "fr" ? "Coffre-fort" : "Vault", icon: "lock" },
      { href: "/tickets", label: "Tickets", icon: "confirmation_number" },
      { href: "/crm", label: locale === "fr" ? "Fiche client" : "Client file", icon: "person" },
      { href: "/acquisition", label: locale === "fr" ? "Lead" : "Lead", icon: "trending_up" },
      {
        href: "/documentation",
        label: t.navigation.documentation ?? "Documentation",
        icon: APP_MATERIAL_SYMBOLS.navigation.documentation,
      },
      {
        href: "/flowise",
        label: t.navigation.assistant ?? "Assistant",
        icon: "smart_toy",
      },
      ...(user.role === "admin"
        ? [
            {
              href: "/users",
              label: locale === "fr" ? "Utilisateurs" : "Users",
              icon: "group",
            },
          ]
        : []),
      { href: "/tarifs", label: locale === "fr" ? "Grille tarifaire" : "Pricing grid", icon: "payments" },
      ...(isSuperAdmin
        ? [
            {
              href: "/security",
              label: t.navigation.security,
              icon: APP_MATERIAL_SYMBOLS.navigation.security,
            },
          ]
        : []),
    ],
    [
      dynamicTabs,
      isSuperAdmin,
      locale,
      t.navigation.dashboard,
      t.navigation.geo,
      t.navigation.documentation,
      t.navigation.assistant,
      t.navigation.security,
    ]
  );

  const visibleNavItems = useMemo(() => {
    if (isSuperAdmin) return navItems;
    if (!routeVisibility?.configured) return navItems;
    const allowed = new Set(routeVisibility.routeKeys);
    return navItems.filter((item) => allowed.has(item.href));
  }, [isSuperAdmin, navItems, routeVisibility]);

  const legacyTestItems = useMemo(
    () => [
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
    ],
    [
      t.navigation.clients,
      t.navigation.pricing,
      t.navigation.content,
      t.navigation.components,
      t.navigation.bookings,
      t.navigation.live_users,
    ]
  );

  const isTestSectionActive = legacyTestItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  useEffect(() => {
    if (!onVisibleRoutesChange) return;
    const visibleMainRoutes = visibleNavItems.map((item) => item.href);
    const visibleLegacyRoutes = isSuperAdmin ? legacyTestItems.map((item) => item.href) : [];
    onVisibleRoutesChange(Array.from(new Set([...visibleMainRoutes, ...visibleLegacyRoutes])));
  }, [visibleNavItems, legacyTestItems, isSuperAdmin, onVisibleRoutesChange]);

  useEffect(() => {
    if (isTestSectionActive) {
      setIsTestOpen(true);
    }
  }, [isTestSectionActive]);

  const handleGroupToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter((current) => !current);
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-header-row">
        <div className="admin-logo">
          <div className="admin-logo-mark" style={{ background: 'transparent', padding: 0, boxShadow: 'none' }}>
            <Image
              src="/logo.svg"
              alt="CostOP Logo"
              width={28}
              height={28}
              style={{ borderRadius: '0.75rem' }}
            />
          </div>
          <span>{t.costockage_admin}</span>
        </div>
        <button
          type="button"
          className="admin-sidebar-inner-toggle"
          onClick={onToggleSidebar}
          title={locale === "fr" ? "Réduire la barre latérale" : "Collapse sidebar"}
          aria-label={locale === "fr" ? "Réduire la barre latérale" : "Collapse sidebar"}
        >
          <MaterialSymbol name="chevron_left" size={18} weight={500} opticalSize={20} />
        </button>
      </div>
      <div className="admin-sidebar-nav-area">
        <div className="admin-nav-section-label">
          {locale === "fr" ? "Navigation" : "Navigation"}
        </div>
        <ul className="admin-nav-list">
          {visibleNavItems.map((item) => {
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
                  {isSuperAdmin && navItem.deletable && navItem.tabId && (
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

          {isSuperAdmin && (
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
      {isSuperAdmin && (
        <div className="admin-sidebar-footer">
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
  visibleRoutes,
  showAircallButton,
}: {
  user: LocalUser;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  visibleRoutes?: string[];
  showAircallButton: boolean;
}) {
  const [showBugModal, setShowBugModal] = useState(false);
  const { locale, t, setLocale } = useLocale();
  const labels =
    locale === "fr"
      ? {
          languageAria: "Changer la langue",
          connectedAs: "Connecté en tant que",
        }
      : {
          languageAria: "Change language",
          connectedAs: "Connected as",
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
        {isSidebarCollapsed && (
          <button
            type="button"
            className="admin-topbar-toggle-btn"
            onClick={onToggleSidebar}
            title={locale === "fr" ? "Déployer la barre latérale" : "Expand sidebar"}
            aria-label={locale === "fr" ? "Déployer la barre latérale" : "Expand sidebar"}
          >
            <MaterialSymbol name="menu" size={20} weight={500} opticalSize={24} />
          </button>
        )}
        <div className="admin-topbar-search">
          <ClientSearch
            inputId="client-search-input"
            placeholder={t.search_placeholder}
            maxWidth="100%"
            appearance="embedded"
            visibleRoutes={visibleRoutes}
          />
        </div>
        <div className="admin-topbar-controls">
          {showAircallButton && <AircallButton />}
          <button
            type="button"
            onClick={toggleLocale}
            aria-label={labels.languageAria}
            title={locale === "fr" ? "Français" : "English"}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "999px",
              border: "none",
              background: "transparent",
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
              border: "none",
              background: "transparent",
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
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  paddingRight: "2px",
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
                      background: "var(--avatar-gradient)",
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
  const { locale } = useLocale();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [visibleRoutes, setVisibleRoutes] = useState<string[]>([]);
  const [showAircallButton, setShowAircallButton] = useState(true);
  const [routeVisibility, setRouteVisibility] = useState<{ configured: boolean; routeKeys: string[] } | null>(null);

  const handleVisibleRoutesChange = useCallback((routes: string[]) => {
    setVisibleRoutes((prev) => {
      if (prev.length === routes.length && prev.every((value, index) => value === routes[index])) {
        return prev;
      }
      return routes;
    });
  }, []);

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
          isSuperAdmin?: boolean;
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
          isSuperAdmin: sessionUser.isSuperAdmin === true,
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
        isSuperAdmin: sessionUser.isSuperAdmin === true,
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

  const loadUiSecuritySettings = useCallback(async () => {
    try {
      const res = await fetch("/api/security/access", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { showAircallButton?: boolean };
      setShowAircallButton(data.showAircallButton !== false);
    } catch {
      setShowAircallButton(true);
    }
  }, []);

  const loadRouteVisibility = useCallback(async () => {
    try {
      const res = await fetch("/api/navigation/visible-routes", { cache: "no-store" });
      if (!res.ok) {
        setRouteVisibility(null);
        return;
      }
      const data = (await res.json()) as { configured?: boolean; routeKeys?: string[] };
      setRouteVisibility({
        configured: data.configured === true,
        routeKeys: Array.isArray(data.routeKeys) ? data.routeKeys : [],
      });
    } catch {
      setRouteVisibility(null);
    }
  }, []);

  useEffect(() => {
    const savedSidebarState = window.localStorage.getItem("admin:sidebar-collapsed");
    if (savedSidebarState !== null) {
      setIsSidebarCollapsed(savedSidebarState === "1");
    }
    setMounted(true);
    void loadCurrentUser();
    void loadUiSecuritySettings();
    void loadRouteVisibility();
  }, [loadCurrentUser, loadUiSecuritySettings, loadRouteVisibility]);

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
    const handler = () => {
      void loadUiSecuritySettings();
      void loadRouteVisibility();
    };
    window.addEventListener("security:settings-updated", handler);
    return () => window.removeEventListener("security:settings-updated", handler);
  }, [loadUiSecuritySettings, loadRouteVisibility]);

  useEffect(() => {
    if (!mounted || !authResolved) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const isLegacyLabRoute =
      pathname.startsWith("/clients") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/content") ||
      pathname.startsWith("/components-registry") ||
      pathname.startsWith("/bookings") ||
      pathname.startsWith("/live-users");

    const isSuperAdminOnlyRoute =
      pathname.startsWith("/security") ||
      pathname === "/tabs/new" ||
      (pathname.includes("/tabs/") && pathname.endsWith("/edit")) ||
      isLegacyLabRoute;
    if (isSuperAdminOnlyRoute && user.isSuperAdmin !== true) {
      router.push("/dashboard");
      return;
    }

    const isAdminOnlyRoute = pathname.startsWith("/users");
    if (isAdminOnlyRoute && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [router, user, mounted, authResolved, pathname]);

  if (!mounted || !authResolved || !user) return null;

  return (
    <RightPanelProvider>
      <div className={["admin-shell", isSidebarCollapsed ? "sidebar-collapsed" : ""].filter(Boolean).join(" ")}>
        <AdminSidebar
          user={user}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          onVisibleRoutesChange={handleVisibleRoutesChange}
          routeVisibility={routeVisibility}
        />
        <div className="admin-content-shell">
          <AdminTopbar
            user={user}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(false)}
            visibleRoutes={visibleRoutes}
            showAircallButton={showAircallButton}
          />
          <Breadcrumb />
          <main className="admin-main">
            <div className="admin-main-inner">{children}</div>
          </main>
        </div>
        <AircallWidget />
      </div>
    </RightPanelProvider>
  );
}
