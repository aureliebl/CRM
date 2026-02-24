"use client";

import { getBookings } from "@/lib/mock/bookings-and-dashboard";
import { getCenters } from "@/lib/mock/centers-and-pricing";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { useLocale } from "@/lib/use-locale";

export default function BookingsPage() {
  const { locale } = useLocale();
  const formatLocale = locale === "fr" ? "fr-FR" : "en-US";
  const centers = getCenters();
  const allBookings = getBookings();

  const labels = locale === "fr"
    ? {
        pageTitle: "Bookings",
        pageDescription:
          "Vue consolidée de tous les bookings avec statut, centre et canal de vente.",
        tableTitle: "Tableau des bookings",
        tableDescription:
          "Les entrées les plus récentes sont affichées en haut et légèrement mises en avant.",
        client: "Client",
        center: "Centre",
        channel: "Canal",
        status: "Statut",
        createdAt: "Création",
        checkIn: "Check-in",
        amount: "Montant",
        source: "Source",
        statusNew: "Nouveau",
        statusConfirmed: "Confirmé",
        statusCancelled: "Annulé",
        statusExpired: "Expiré",
      }
    : {
        pageTitle: "Bookings",
        pageDescription:
          "Consolidated view of all bookings with status, center and sales channel.",
        tableTitle: "Bookings table",
        tableDescription:
          "Most recent entries are displayed first and slightly highlighted.",
        client: "Client",
        center: "Center",
        channel: "Channel",
        status: "Status",
        createdAt: "Created",
        checkIn: "Check-in",
        amount: "Amount",
        source: "Source",
        statusNew: "New",
        statusConfirmed: "Confirmed",
        statusCancelled: "Cancelled",
        statusExpired: "Expired",
      };

  const rows = allBookings.map((booking) => {
    const center = centers.find((item) => item.id === booking.centerId);
    return {
      ...booking,
      centerLabel: center?.name ?? booking.centerId,
      createdAtLabel: new Date(booking.createdAt).toLocaleString(formatLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      checkInLabel: booking.checkIn
        ? new Date(booking.checkIn).toLocaleDateString(formatLocale)
        : "—",
      amountLabel: booking.amount.toLocaleString(formatLocale, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
    };
  });

  return (
    <div>
      <h1 className="admin-page-title">{labels.pageTitle}</h1>
      <p className="admin-page-description">{labels.pageDescription}</p>
      <TableWithColumnFilters
        title={labels.tableTitle}
        description={labels.tableDescription}
        data={rows}
        columns={[
          { key: "id", label: "ID", filterType: "text" },
          { key: "clientId", label: labels.client, filterType: "text" },
          { key: "centerLabel", label: labels.center, filterType: "text" },
          {
            key: "channel",
            label: labels.channel,
            filterType: "select",
            selectOptions: [
              { value: "marketplace", label: "Marketplace" },
              { value: "kostok", label: "Kostok" },
            ],
          },
          {
            key: "status",
            label: labels.status,
            filterType: "select",
            selectOptions: [
              { value: "new", label: labels.statusNew },
              { value: "confirmed", label: labels.statusConfirmed },
              { value: "cancelled", label: labels.statusCancelled },
              { value: "expired", label: labels.statusExpired },
            ],
          },
          { key: "createdAtLabel", label: labels.createdAt, filterType: "text" },
          { key: "checkInLabel", label: labels.checkIn, filterType: "text" },
          { key: "amountLabel", label: labels.amount, filterType: "text" },
          {
            key: "source",
            label: labels.source,
            filterType: "select",
            selectOptions: [
              { value: "web", label: "Web" },
              { value: "phone", label: "Phone" },
              { value: "partner", label: "Partner" },
            ],
          },
        ]}
      />
    </div>
  );
}


