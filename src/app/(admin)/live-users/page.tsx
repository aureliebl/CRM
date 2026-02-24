"use client";

import { useEffect, useState } from "react";
import { getLiveUsers, simulateHeartbeat } from "@/lib/mock/live-users";
import { getCenters } from "@/lib/mock/centers-and-pricing";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { useLocale } from "@/lib/use-locale";

export default function LiveUsersPage() {
  const { t, locale } = useLocale();
  const formatLocale = locale === "fr" ? "fr-FR" : "en-US";
  const centers = getCenters();
  const [sessions, setSessions] = useState(getLiveUsers());

  const labels = locale === "fr"
    ? {
        title: t.live_users_title ?? "Utilisateurs en ligne",
        subtitle:
          t.live_users_description ??
          "Suivi (mock) des visiteurs actuellement sur le site Costockage.",
        tableTitle: t.sessions_active ?? "Sessions actives",
        session: "Session",
        client: "Client",
        center: "Centre",
        boxSize: "Taille box",
        page: "Page",
        since: "Depuis",
        lastActivity: "Dernière activité",
        device: "Appareil",
        referrer: "Source",
      }
    : {
        title: t.live_users_title ?? "Live users",
        subtitle:
          t.live_users_description ??
          "Mock tracking of visitors currently on Costockage.",
        tableTitle: t.sessions_active ?? "Active sessions",
        session: "Session",
        client: "Client",
        center: "Center",
        boxSize: "Box size",
        page: "Page",
        since: "Since",
        lastActivity: "Last activity",
        device: "Device",
        referrer: "Referrer",
      };

  useEffect(() => {
    const interval = setInterval(() => {
      simulateHeartbeat();
      setSessions(getLiveUsers());
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const rows = sessions.map((session) => ({
    ...session,
    userLabel: session.clientId ?? session.anonymousId ?? "—",
    centerLabel:
      centers.find((center) => center.id === session.currentCenterId)?.name ??
      session.currentCenterId ??
      "—",
    startedAtLabel: new Date(session.startedAt).toLocaleTimeString(formatLocale, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    lastSeenAtLabel: new Date(session.lastSeenAt).toLocaleTimeString(formatLocale, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <div>
      <h1 className="admin-page-title">{labels.title}</h1>
      <p className="admin-page-description">{labels.subtitle}</p>

      <TableWithColumnFilters
        title={labels.tableTitle}
        data={rows}
        columns={[
          { key: "id", label: labels.session, filterType: "text" },
          { key: "userLabel", label: labels.client, filterType: "text" },
          { key: "centerLabel", label: labels.center, filterType: "text" },
          { key: "currentBoxSizeRange", label: labels.boxSize, filterType: "text" },
          { key: "page", label: labels.page, filterType: "text" },
          { key: "startedAtLabel", label: labels.since, filterType: "text" },
          { key: "lastSeenAtLabel", label: labels.lastActivity, filterType: "text" },
          {
            key: "deviceType",
            label: labels.device,
            filterType: "select",
            selectOptions: [
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
              { value: "tablet", label: "Tablet" },
            ],
          },
          { key: "referrer", label: labels.referrer, filterType: "text" },
        ]}
      />
    </div>
  );
}
