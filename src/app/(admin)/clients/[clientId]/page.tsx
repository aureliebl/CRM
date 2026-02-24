"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { CallClientButton } from "@/components/admin/AircallWidget";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import {
  getClientById,
  getClientBookings,
  getClientBoxes,
  getClientCommunications,
  getClientCumulativeStorageArea,
  getClientFollowUpTickets,
  getClientPrimaryBookingStatus,
  isVipKostokClient,
} from "@/lib/mock/clients";
import { boxTypes, centers } from "@/lib/mock/centers-and-pricing";
import { useLocale } from "@/lib/use-locale";

const BOOKING_PRIORITY_ORDER = "confirmed > new > expired > cancelled";

export default function ClientDetailPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = Array.isArray(params?.clientId)
    ? params.clientId[0]
    : params?.clientId;

  const { locale } = useLocale();
  const formatLocale = locale === "fr" ? "fr-FR" : "en-US";

  const labels =
    locale === "fr"
      ? {
          title: "Fiche CRM client",
          description:
            "Attributs Intercom, segmentation et suivi opérationnel multi-réservations.",
          invalidClient: "Client introuvable.",
          intercomTitle: "Attributs Intercom et automatisation",
          cumulativeArea: "Surface cumulée",
          primaryStatus: "Statut principal",
          bookingsCount: "Nombre de réservations",
          unpaidAmount: "Montant impayé",
          walletAmount: "Montant wallet",
          relationshipSummary: "Synthèse relation",
          activeBoxes: "Boxes actives",
          channelsUsed: "Canaux utilisés",
          communicationsLogged: "Communications loggées",
          segmentationTitle: "Segmentation et opérations",
          vipSegment: "VIP Kostok Client (>7 m²)",
          costeCentreSegment: "Gestion Coste-Centre",
          costeCentreHelp:
            "Chaque réservation acceptée garde un ticket de suivi dédié, non clôturé automatiquement.",
          acceptedBookings: "Réservations acceptées",
          openTickets: "Tickets ouverts",
          priorityRule: "Règle de priorité statut",
          impactTitle: "Impact opérationnel multi-booking / multi-box",
          impactWarning:
            "Client avec plusieurs boxes ou réservations: appliquer la priorité statut et traiter les tickets Coste-Centre ouverts en premier.",
          impactNormal:
            "Contexte simple: suivi standard avec la règle de priorité inchangée.",
          boxesTitle: "Historique des boxes",
          bookingsTitle: "Historique des réservations",
          center: "Centre",
          box: "Box",
          channel: "Canal",
          status: "Statut",
          period: "Période",
          amount: "Montant",
          createdAt: "Créée le",
          ticketTitle: "Tickets Coste-Centre",
          ticketStatus: "Statut ticket",
          noTickets: "Aucun ticket Coste-Centre pour le moment.",
          noCommunications: "Aucune communication enregistrée.",
          communicationsTitle: "Historique & notes",
          inProgress: "en cours",
          accepted: "accepted",
          yes: "Oui",
          no: "Non",
          email: "Email",
          phone: "Téléphone",
          segment: "Segment",
        }
      : {
          title: "Client CRM profile",
          description:
            "Intercom-like attributes, segmentation, and multi-booking operational follow-up.",
          invalidClient: "Client not found.",
          intercomTitle: "Intercom attributes and automation",
          cumulativeArea: "Cumulative storage area",
          primaryStatus: "Primary status",
          bookingsCount: "Bookings count",
          unpaidAmount: "Unpaid amount",
          walletAmount: "Wallet amount",
          relationshipSummary: "Relationship summary",
          activeBoxes: "Active boxes",
          channelsUsed: "Used channels",
          communicationsLogged: "Logged communications",
          segmentationTitle: "Segmentation and operations",
          vipSegment: "VIP Kostok Client (>7 m²)",
          costeCentreSegment: "Coste-Centre management",
          costeCentreHelp:
            "Each accepted booking keeps a dedicated follow-up ticket that is not auto-closed.",
          acceptedBookings: "Accepted bookings",
          openTickets: "Open tickets",
          priorityRule: "Status priority rule",
          impactTitle: "Multi-booking / multi-box operational impact",
          impactWarning:
            "Client has multiple boxes or bookings: apply status priority and process open Coste-Centre tickets first.",
          impactNormal:
            "Simple context: standard follow-up with unchanged priority rule.",
          boxesTitle: "Boxes history",
          bookingsTitle: "Bookings history",
          center: "Center",
          box: "Box",
          channel: "Channel",
          status: "Status",
          period: "Period",
          amount: "Amount",
          createdAt: "Created at",
          ticketTitle: "Coste-Centre tickets",
          ticketStatus: "Ticket status",
          noTickets: "No Coste-Centre tickets yet.",
          noCommunications: "No communication recorded.",
          communicationsTitle: "History & notes",
          inProgress: "in progress",
          accepted: "accepted",
          yes: "Yes",
          no: "No",
          email: "Email",
          phone: "Phone",
          segment: "Segment",
        };

  if (!clientId) {
    return (
      <div className="admin-placeholder-card">
        <div className="admin-placeholder-title">{labels.invalidClient}</div>
      </div>
    );
  }

  const client = getClientById(clientId);
  if (!client) {
    return (
      <div className="admin-placeholder-card">
        <div className="admin-placeholder-title">{labels.invalidClient}</div>
      </div>
    );
  }

  const centerById = useMemo(
    () => new Map(centers.map((center) => [center.id, center.name])),
    []
  );
  const boxTypeById = useMemo(
    () => new Map(boxTypes.map((boxType) => [boxType.id, boxType])),
    []
  );

  const boxes = getClientBoxes(clientId);
  const bookings = getClientBookings(clientId);
  const communications = getClientCommunications(clientId);
  const followUpTickets = getClientFollowUpTickets(clientId);

  const cumulativeAreaM2 = getClientCumulativeStorageArea(clientId);
  const primaryBookingStatus = getClientPrimaryBookingStatus(clientId) ?? "—";
  const isVipClient = isVipKostokClient(clientId);
  const acceptedBookingsCount = bookings.filter(
    (booking) => booking.status === "confirmed"
  ).length;
  const openFollowUpTicketsCount = followUpTickets.filter(
    (ticket) => ticket.status === "open"
  ).length;

  const hasMultiOperationalContext = boxes.length > 1 || bookings.length > 1;

  const money = (value: number) =>
    value.toLocaleString(formatLocale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });

  const relationshipSummaryRows = [
    {
      id: "rel-active-boxes",
      label: labels.activeBoxes,
      value: boxes.filter((box) => box.status === "active").length,
    },
    {
      id: "rel-channels",
      label: labels.channelsUsed,
      value: Array.from(new Set(boxes.map((box) => box.channel))).join(", ") || "—",
    },
    {
      id: "rel-comms",
      label: labels.communicationsLogged,
      value: communications.length,
    },
  ];

  return (
    <div>
      <h1 className="admin-page-title">{client.fullName}</h1>
      <p className="admin-page-description">{labels.description}</p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <article className="admin-placeholder-card">
          <div className="admin-placeholder-title">{labels.intercomTitle}</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "0.7rem",
              marginTop: "0.6rem",
              fontSize: "0.85rem",
            }}
          >
            <div>
              <div>{labels.cumulativeArea}</div>
              <strong>{`${cumulativeAreaM2.toFixed(1)} m²`}</strong>
            </div>
            <div>
              <div>{labels.primaryStatus}</div>
              <strong>{primaryBookingStatus}</strong>
            </div>
            <div>
              <div>{labels.bookingsCount}</div>
              <strong>{bookings.length}</strong>
            </div>
            <div>
              <div>{labels.unpaidAmount}</div>
              <strong>{money(client.unpaidAmount ?? 0)}</strong>
            </div>
            <div>
              <div>{labels.walletAmount}</div>
              <strong>{money(client.walletAmount ?? 0)}</strong>
            </div>
            <div>
              <div>{labels.segment}</div>
              <strong>{client.segment ?? "—"}</strong>
            </div>
            <div>
              <div>{labels.email}</div>
              <strong>{client.email}</strong>
            </div>
            <div>
              <div>{labels.phone}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong>{client.phone ?? "—"}</strong>
                {client.phone && <CallClientButton phoneNumber={client.phone} />}
              </div>
            </div>
          </div>
        </article>

        <article className="admin-placeholder-card">
          <div className="admin-placeholder-title">{labels.relationshipSummary}</div>
          <ul
            style={{
              margin: "0.6rem 0 0",
              paddingLeft: "1rem",
              display: "grid",
              gap: "0.45rem",
              fontSize: "0.85rem",
            }}
          >
            {relationshipSummaryRows.map((item) => (
              <li key={item.id}>
                {item.label}: <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <article className="admin-placeholder-card">
          <div className="admin-placeholder-title">{labels.segmentationTitle}</div>
          <ul
            style={{
              margin: "0.6rem 0",
              paddingLeft: "1rem",
              display: "grid",
              gap: "0.45rem",
              fontSize: "0.85rem",
            }}
          >
            <li>
              {labels.vipSegment}: <strong>{isVipClient ? labels.yes : labels.no}</strong>
            </li>
            <li>
              {labels.costeCentreSegment}: <strong>{openFollowUpTicketsCount > 0 ? labels.yes : labels.no}</strong>
            </li>
            <li>
              {labels.acceptedBookings}: <strong>{acceptedBookingsCount}</strong>
            </li>
            <li>
              {labels.openTickets}: <strong>{openFollowUpTicketsCount}</strong>
            </li>
            <li>
              {labels.priorityRule}: <strong>{BOOKING_PRIORITY_ORDER}</strong>
            </li>
          </ul>
          <p className="admin-page-description" style={{ margin: 0 }}>
            {labels.costeCentreHelp}
          </p>
        </article>

        <article className="admin-placeholder-card">
          <div className="admin-placeholder-title">{labels.impactTitle}</div>
          <p className="admin-page-description" style={{ marginTop: "0.6rem" }}>
            {hasMultiOperationalContext ? labels.impactWarning : labels.impactNormal}
          </p>

          <div style={{ marginTop: "0.9rem" }}>
            <div className="admin-placeholder-title" style={{ fontSize: "0.85rem" }}>
              {labels.ticketTitle}
            </div>
            {followUpTickets.length === 0 ? (
              <div style={{ fontSize: "0.85rem" }}>{labels.noTickets}</div>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0.5rem 0 0",
                  display: "grid",
                  gap: "0.5rem",
                  fontSize: "0.8rem",
                }}
              >
                {followUpTickets.map((ticket) => (
                  <li key={ticket.id} className="admin-placeholder-card" style={{ padding: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem" }}>
                      <strong>{ticket.title}</strong>
                      <span>
                        {labels.ticketStatus}: {ticket.status}
                      </span>
                    </div>
                    <div>
                      Booking: {ticket.bookingId} · {labels.createdAt} {new Date(ticket.createdAt).toLocaleDateString(formatLocale)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <TableWithColumnFilters
          title={labels.bookingsTitle}
          data={bookings.map((booking) => ({
            ...booking,
            centerLabel: centerById.get(booking.centerId) ?? booking.centerId,
            boxLabel: boxTypeById.get(booking.boxTypeId)?.name ?? booking.boxTypeId,
            createdAtLabel: new Date(booking.createdAt).toLocaleDateString(formatLocale),
            amountLabel: money(booking.amount),
          }))}
          columns={[
            { key: "id", label: "ID", filterType: "text" },
            { key: "status", label: labels.status, filterType: "select", selectOptions: [
              { value: "confirmed", label: "confirmed" },
              { value: "new", label: "new" },
              { value: "expired", label: "expired" },
              { value: "cancelled", label: "cancelled" },
            ] },
            { key: "channel", label: labels.channel, filterType: "select", selectOptions: [
              { value: "marketplace", label: "marketplace" },
              { value: "kostok", label: "kostok" },
            ] },
            { key: "centerLabel", label: labels.center, filterType: "text" },
            { key: "boxLabel", label: labels.box, filterType: "text" },
            { key: "createdAtLabel", label: labels.createdAt, filterType: "text" },
            { key: "amountLabel", label: labels.amount, filterType: "text" },
          ]}
        />

        <TableWithColumnFilters
          title={labels.boxesTitle}
          data={boxes.map((box) => ({
            ...box,
            centerLabel: centerById.get(box.centerId) ?? box.centerId,
            boxLabel: boxTypeById.get(box.boxTypeId)?.name ?? box.boxTypeId,
            areaLabel: `${(boxTypeById.get(box.boxTypeId)?.sizeM2 ?? 0).toFixed(1)} m²`,
            period: `${new Date(box.startDate).toLocaleDateString(formatLocale)}${
              box.endDate
                ? ` → ${new Date(box.endDate).toLocaleDateString(formatLocale)}`
                : ` (${labels.inProgress})`
            }`,
            amountLabel: money(box.price),
          }))}
          columns={[
            { key: "id", label: "ID", filterType: "text" },
            { key: "status", label: labels.status, filterType: "select", selectOptions: [
              { value: "active", label: "active" },
              { value: "upcoming", label: "upcoming" },
              { value: "ended", label: "ended" },
              { value: "cancelled", label: "cancelled" },
            ] },
            { key: "channel", label: labels.channel, filterType: "select", selectOptions: [
              { value: "marketplace", label: "marketplace" },
              { value: "kostok", label: "kostok" },
            ] },
            { key: "centerLabel", label: labels.center, filterType: "text" },
            { key: "boxLabel", label: labels.box, filterType: "text" },
            { key: "areaLabel", label: labels.cumulativeArea, filterType: "text" },
            { key: "period", label: labels.period, filterType: "text" },
            { key: "amountLabel", label: labels.amount, filterType: "text" },
          ]}
        />
      </section>

      <section className="admin-placeholder-card">
        <div className="admin-placeholder-title">{labels.communicationsTitle}</div>
        {communications.length === 0 ? (
          <div style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>{labels.noCommunications}</div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: "0.6rem 0 0",
              padding: 0,
              display: "grid",
              gap: "0.6rem",
              fontSize: "0.82rem",
            }}
          >
            {communications.map((communication) => (
              <li key={communication.id} className="admin-placeholder-card" style={{ padding: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem" }}>
                  <strong>{communication.summary}</strong>
                  <span>
                    {new Date(communication.timestamp).toLocaleString(formatLocale, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div>
                  {communication.type} · {communication.direction} · {communication.author}
                </div>
                {communication.details && <div>{communication.details}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
