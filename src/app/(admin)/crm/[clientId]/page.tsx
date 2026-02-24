"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientById } from "@/lib/mock/clients";
import {
  getContractsByClient,
  getInvoicesByClient,
  getIndividualBoxesByClient,
  getConversationsByClient,
  getQuoteRequestsByClient,
  getHistoryByClient,
  toggleHistoryPin,
  addConversation,
  addMessageToConversation,
} from "@/lib/mock/crm";
import { centers, boxTypes } from "@/lib/mock/centers-and-pricing";
import { CallClientButton } from "@/components/admin/AircallWidget";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";

type SubTab = "info" | "contrats" | "communication" | "transactions" | "booking" | "devis" | "boxes";

const subTabLabels: Record<SubTab, { fr: string; en: string; icon: string }> = {
  info: { fr: "Informations", en: "Information", icon: "person" },
  contrats: { fr: "Contrats", en: "Contracts", icon: "description" },
  communication: { fr: "Communication", en: "Communication", icon: "chat" },
  transactions: { fr: "Transactions", en: "Transactions", icon: "receipt_long" },
  booking: { fr: "Nouveau booking", en: "New Booking", icon: "add_circle" },
  devis: { fr: "Devis", en: "Quotes", icon: "request_quote" },
  boxes: { fr: "Boxes", en: "Boxes", icon: "inventory_2" },
};

export default function CrmClientDetailPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = Array.isArray(params?.clientId) ? params.clientId[0] : params?.clientId;
  const router = useRouter();
  const { locale } = useLocale();
  const fr = locale === "fr";

  const [activeTab, setActiveTab] = useState<SubTab>("info");
  const [historyPins, setHistoryPins] = useState<Record<string, boolean>>({});

  const client = useMemo(() => clientId ? getClientById(clientId) : null, [clientId]);
  const contracts = useMemo(() => clientId ? getContractsByClient(clientId) : [], [clientId]);
  const invoices = useMemo(() => clientId ? getInvoicesByClient(clientId) : [], [clientId]);
  const boxes = useMemo(() => clientId ? getIndividualBoxesByClient(clientId) : [], [clientId]);
  const conversations = useMemo(() => clientId ? getConversationsByClient(clientId) : [], [clientId]);
  const quotes = useMemo(() => clientId ? getQuoteRequestsByClient(clientId) : [], [clientId]);
  const historyRaw = useMemo(() => clientId ? getHistoryByClient(clientId) : [], [clientId]);

  const history = useMemo(() => {
    return historyRaw.map((h) => ({
      ...h,
      pinned: historyPins[h.id] !== undefined ? historyPins[h.id] : h.pinned,
    }));
  }, [historyRaw, historyPins]);

  const pinnedHistory = history.filter((h) => h.pinned);
  const unpinnedHistory = history.filter((h) => !h.pinned);

  if (!client) {
    return (
      <div>
        <h1 className="admin-page-title">{fr ? "Client introuvable" : "Client not found"}</h1>
        <button type="button" onClick={() => router.push("/crm")} className="admin-btn admin-btn-secondary" style={{ marginTop: 16 }}>
          ← {fr ? "Retour à la liste" : "Back to list"}
        </button>
      </div>
    );
  }

  const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));
  const boxTypeMap = Object.fromEntries(boxTypes.map((b) => [b.id, b]));

  const handleTogglePin = (eventId: string) => {
    const newVal = toggleHistoryPin(eventId);
    setHistoryPins((prev) => ({ ...prev, [eventId]: newVal }));
  };

  const historyIcon = (type: string) => {
    switch (type) {
      case "call": return "call";
      case "email": return "mail";
      case "note": return "sticky_note_2";
      case "contract": return "description";
      case "payment": return "payments";
      case "action": return "bolt";
      default: return "info";
    }
  };

  return (
    <div style={{ display: "flex", gap: 24, minHeight: "calc(100vh - 120px)" }}>
      {/* Main content area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <button type="button" onClick={() => router.push("/crm")} className="admin-btn admin-btn-secondary" style={{ padding: "4px 12px" }}>
            ←
          </button>
          <h1 className="admin-page-title" style={{ margin: 0 }}>{client.fullName}</h1>
          <span style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            background: client.status === "active" ? "var(--badge-green-bg, #dcfce7)" : client.status === "lead" ? "var(--badge-blue-bg, #dbeafe)" : "var(--badge-red-bg, #fee2e2)",
            color: client.status === "active" ? "var(--badge-green-text, #166534)" : client.status === "lead" ? "var(--badge-blue-text, #1e40af)" : "var(--badge-red-text, #991b1b)",
          }}>
            {client.status}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{client.segment}</span>
          <div style={{ marginLeft: "auto" }}>
            <CallClientButton phoneNumber={client.phone ?? ""} />
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>{client.email} · {client.phone}</p>

        {/* Sub-tabs */}
        <div style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid var(--border-primary)",
          marginBottom: 20,
          overflowX: "auto",
        }}>
          {(Object.keys(subTabLabels) as SubTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--accent-primary)" : "2px solid transparent",
                marginBottom: -2,
                color: activeTab === tab ? "var(--accent-primary)" : "var(--text-secondary)",
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              <MaterialSymbol name={subTabLabels[tab].icon} style={{ fontSize: 18 }} />
              {fr ? subTabLabels[tab].fr : subTabLabels[tab].en}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "info" && <InfoTab client={client} fr={fr} />}
        {activeTab === "contrats" && <ContratsTab contracts={contracts} centerMap={centerMap} boxTypeMap={boxTypeMap} fr={fr} />}
        {activeTab === "communication" && <CommunicationTab conversations={conversations} clientId={client.id} fr={fr} />}
        {activeTab === "transactions" && <TransactionsTab invoices={invoices} fr={fr} />}
        {activeTab === "booking" && <BookingTab client={client} fr={fr} />}
        {activeTab === "devis" && <DevisTab quotes={quotes} centerMap={centerMap} fr={fr} />}
        {activeTab === "boxes" && <BoxesTab boxes={boxes} centerMap={centerMap} fr={fr} />}
      </div>

      {/* History panel */}
      <div style={{
        width: 340,
        minWidth: 340,
        borderLeft: "1px solid var(--border-primary)",
        paddingLeft: 20,
        overflowY: "auto",
        maxHeight: "calc(100vh - 120px)",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          <MaterialSymbol name="history" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 6 }} />
          {fr ? "Historique" : "History"}
        </h3>

        {pinnedHistory.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 8 }}>
              {fr ? "Épinglés" : "Pinned"}
            </div>
            {pinnedHistory.map((event) => (
              <HistoryCard key={event.id} event={event} onTogglePin={handleTogglePin} historyIcon={historyIcon} />
            ))}
            <hr style={{ border: "none", borderTop: "1px solid var(--border-primary)", margin: "12px 0" }} />
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 8 }}>
          {fr ? "Récent" : "Recent"}
        </div>
        {unpinnedHistory.length === 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fr ? "Aucun événement." : "No events."}</p>}
        {unpinnedHistory.map((event) => (
          <HistoryCard key={event.id} event={event} onTogglePin={handleTogglePin} historyIcon={historyIcon} />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// HISTORY CARD
// ──────────────────────────────────────────

function HistoryCard({ event, onTogglePin, historyIcon }: { event: any; onTogglePin: (id: string) => void; historyIcon: (type: string) => string }) {
  return (
    <div style={{
      display: "flex",
      gap: 10,
      padding: "8px 10px",
      borderRadius: 8,
      background: event.pinned ? "var(--surface-highlight, rgba(59,130,246,0.06))" : "transparent",
      marginBottom: 6,
      fontSize: 13,
    }}>
      <MaterialSymbol name={historyIcon(event.type)} style={{ fontSize: 16, marginTop: 2, color: "var(--text-secondary)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{event.summary}</div>
        {event.details && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{event.details}</div>}
        <div style={{ fontSize: 11, color: "var(--text-tertiary, #999)", marginTop: 2 }}>
          {new Date(event.timestamp).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onTogglePin(event.id)}
        title={event.pinned ? "Désépingler" : "Épingler"}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 2,
          color: event.pinned ? "var(--accent-primary)" : "var(--text-tertiary, #999)",
        }}
      >
        <MaterialSymbol name={event.pinned ? "push_pin" : "push_pin"} style={{ fontSize: 16, opacity: event.pinned ? 1 : 0.4 }} />
      </button>
    </div>
  );
}

// ──────────────────────────────────────────
// SUB-TAB: INFORMATIONS
// ──────────────────────────────────────────

function InfoTab({ client, fr }: { client: any; fr: boolean }) {
  const fieldStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-secondary, #eee)", fontSize: 13 };
  const labelStyle: React.CSSProperties = { fontWeight: 500, color: "var(--text-secondary)" };

  return (
    <div style={{ maxWidth: 600 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{fr ? "Informations personnelles" : "Personal Information"}</h3>
      <div className="admin-placeholder-card" style={{ padding: 20 }}>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Prénom" : "First Name"}</span><span>{client.firstName || "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Nom" : "Last Name"}</span><span>{client.lastName || "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>Email</span><span>{client.email}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Téléphone" : "Phone"}</span><span>{client.phone || "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Adresse" : "Address"}</span><span>{client.address || "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Ville" : "City"}</span><span>{client.city || "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Code postal" : "Postal Code"}</span><span>{client.postalCode || "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Date de naissance" : "Birth Date"}</span><span>{client.birthDate ? new Date(client.birthDate).toLocaleDateString("fr-FR") : "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>Segment</span><span>{client.segment || "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Source" : "Lead Source"}</span><span>{client.leadSource || "—"}</span></div>
        <div style={fieldStyle}><span style={labelStyle}>{fr ? "Boxes consultées" : "Viewed Box Sizes"}</span><span>{client.viewedBoxSizes?.join(", ") || "—"} m²</span></div>
        <div style={{ ...fieldStyle, borderBottom: "none" }}><span style={labelStyle}>{fr ? "Statut" : "Status"}</span><span>{client.status}</span></div>
      </div>

      {client.longComment && (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>{fr ? "Note interne" : "Internal Note"}</h3>
          <div className="admin-placeholder-card" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "var(--text-primary)", margin: 0 }}>{client.longComment}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// SUB-TAB: CONTRATS
// ──────────────────────────────────────────

function ContratsTab({ contracts, centerMap, boxTypeMap, fr }: { contracts: any[]; centerMap: Record<string, any>; boxTypeMap: Record<string, any>; fr: boolean }) {
  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      actif: { bg: "var(--badge-green-bg, #dcfce7)", text: "var(--badge-green-text, #166534)" },
      terminé: { bg: "var(--badge-gray-bg, #f3f4f6)", text: "var(--badge-gray-text, #374151)" },
      impayé: { bg: "var(--badge-red-bg, #fee2e2)", text: "var(--badge-red-text, #991b1b)" },
      squatteur: { bg: "var(--badge-orange-bg, #ffedd5)", text: "var(--badge-orange-text, #9a3412)" },
    };
    const c = colors[status] || colors.terminé;
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>{status}</span>;
  };

  const rows = contracts.map((c) => ({
    ...c,
    centerName: centerMap[c.centerId]?.name ?? c.centerId,
    boxLabel: c.boxId,
    monthlyRentLabel: `${c.monthlyRent} €`,
    promoLabel: c.promoCode ? `${c.promoCode} → ${c.promoEndDate ? new Date(c.promoEndDate).toLocaleDateString("fr-FR") : "∞"}` : "—",
    increaseLabel: c.priceIncreaseAmount ? `+${c.priceIncreaseAmount} € le ${c.priceIncreaseDate ? new Date(c.priceIncreaseDate).toLocaleDateString("fr-FR") : "?"}` : "—",
    startLabel: new Date(c.startDate).toLocaleDateString("fr-FR"),
    endLabel: c.endDate ? new Date(c.endDate).toLocaleDateString("fr-FR") : "—",
  }));

  return (
    <TableWithColumnFilters
      title={fr ? "Contrats" : "Contracts"}
      description={fr ? "Tous les contrats de ce client." : "All contracts for this client."}
      data={rows}
      columns={[
        { key: "id", label: "ID", filterType: "text" },
        {
          key: "status",
          label: fr ? "Statut" : "Status",
          filterType: "select",
          selectOptions: [
            { value: "actif", label: "Actif" },
            { value: "terminé", label: "Terminé" },
            { value: "impayé", label: "Impayé" },
            { value: "squatteur", label: "Squatteur" },
          ],
          render: (row) => statusBadge(row.status),
        },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "boxLabel", label: "Box", filterType: "text" },
        { key: "monthlyRentLabel", label: fr ? "Loyer mensuel" : "Monthly Rent", filterType: "text" },
        { key: "promoLabel", label: "Promo", filterType: "text" },
        { key: "increaseLabel", label: fr ? "Hausse prévue" : "Price Increase", filterType: "text" },
        { key: "startLabel", label: fr ? "Début" : "Start", filterType: "text" },
        { key: "endLabel", label: fr ? "Fin" : "End", filterType: "text" },
        {
          key: "contractUrl",
          label: "PDF",
          filterType: "text",
          render: (row) => row.contractUrl ? (
            <button type="button" onClick={() => window.alert(`Ouverture: ${row.contractUrl}`)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-primary)" }}>
              <MaterialSymbol name="picture_as_pdf" style={{ fontSize: 18 }} />
            </button>
          ) : null,
        },
      ]}
    />
  );
}

// ──────────────────────────────────────────
// SUB-TAB: COMMUNICATION
// ──────────────────────────────────────────

function CommunicationTab({ conversations, clientId, fr }: { conversations: any[]; clientId: string; fr: boolean }) {
  const [selectedConv, setSelectedConv] = useState<string | null>(conversations[0]?.id ?? null);
  const [newMessage, setNewMessage] = useState("");
  const [convList, setConvList] = useState(conversations);
  const [newSubject, setNewSubject] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const activeConv = convList.find((c) => c.id === selectedConv);

  const handleSendMessage = () => {
    if (!selectedConv || !newMessage.trim()) return;
    addMessageToConversation(selectedConv, "outbound", newMessage.trim());
    setNewMessage("");
    setConvList([...getConversationsByClient(clientId)]);
  };

  const handleNewConversation = () => {
    if (!newSubject.trim()) return;
    const conv = addConversation(clientId, "email", newSubject.trim());
    setConvList([...getConversationsByClient(clientId)]);
    setSelectedConv(conv.id);
    setNewSubject("");
    setShowNewForm(false);
  };

  return (
    <div style={{ display: "flex", gap: 16, minHeight: 400 }}>
      {/* Conversation list */}
      <div style={{ width: 260, borderRight: "1px solid var(--border-primary)", paddingRight: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{fr ? "Conversations" : "Conversations"}</h4>
          <button type="button" onClick={() => setShowNewForm(!showNewForm)} className="admin-btn admin-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>+</button>
        </div>

        {showNewForm && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder={fr ? "Sujet…" : "Subject…"}
              className="admin-input"
              style={{ fontSize: 12, marginBottom: 4, width: "100%" }}
            />
            <button type="button" onClick={handleNewConversation} className="admin-btn admin-btn-primary" style={{ fontSize: 11, padding: "3px 8px", width: "100%" }}>
              {fr ? "Créer" : "Create"}
            </button>
          </div>
        )}

        {convList.map((conv) => {
          const unread = conv.messages.filter((m: any) => !m.read && m.direction === "inbound").length;
          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => setSelectedConv(conv.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                marginBottom: 4,
                borderRadius: 6,
                border: "none",
                background: selectedConv === conv.id ? "var(--surface-highlight, rgba(59,130,246,0.08))" : "transparent",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <MaterialSymbol name={conv.type === "email" ? "mail" : "sms"} style={{ fontSize: 14, color: "var(--text-secondary)" }} />
                <span style={{ fontWeight: selectedConv === conv.id ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conv.subject}
                </span>
                {unread > 0 && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: "var(--accent-primary)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                  }}>
                    {unread}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary, #999)", marginTop: 2 }}>
                {conv.messages.length} msg · {new Date(conv.createdAt).toLocaleDateString("fr-FR")}
              </div>
            </button>
          );
        })}
      </div>

      {/* Message thread */}
      <div style={{ flex: 1 }}>
        {activeConv ? (
          <>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              <MaterialSymbol name={activeConv.type === "email" ? "mail" : "sms"} style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }} />
              {activeConv.subject}
            </h4>
            <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 12 }}>
              {activeConv.messages.map((msg: any) => (
                <div key={msg.id} style={{
                  display: "flex",
                  justifyContent: msg.direction === "outbound" ? "flex-end" : "flex-start",
                  marginBottom: 8,
                }}>
                  <div style={{
                    maxWidth: "70%",
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: msg.direction === "outbound" ? "var(--accent-primary)" : "var(--surface-secondary, #f3f4f6)",
                    color: msg.direction === "outbound" ? "#fff" : "var(--text-primary)",
                    fontSize: 13,
                  }}>
                    <div>{msg.content}</div>
                    <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: "right" }}>
                      {new Date(msg.timestamp).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                className="admin-input"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder={fr ? "Écrire un message…" : "Write a message…"}
                style={{ flex: 1, fontSize: 13 }}
              />
              <button type="button" onClick={handleSendMessage} className="admin-btn admin-btn-primary" style={{ padding: "6px 14px" }}>
                <MaterialSymbol name="send" style={{ fontSize: 18 }} />
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", padding: 20 }}>
            {fr ? "Aucune conversation sélectionnée." : "No conversation selected."}
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// SUB-TAB: TRANSACTIONS
// ──────────────────────────────────────────

function TransactionsTab({ invoices, fr }: { invoices: any[]; fr: boolean }) {
  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      payé: { bg: "var(--badge-green-bg, #dcfce7)", text: "var(--badge-green-text, #166534)" },
      impayé: { bg: "var(--badge-red-bg, #fee2e2)", text: "var(--badge-red-text, #991b1b)" },
      "en retard": { bg: "var(--badge-orange-bg, #ffedd5)", text: "var(--badge-orange-text, #9a3412)" },
    };
    const c = colors[status] || colors.payé;
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>{status}</span>;
  };

  const rows = invoices.map((inv) => ({
    ...inv,
    amountLabel: `${inv.amount} €`,
    dueDateLabel: new Date(inv.dueDate).toLocaleDateString("fr-FR"),
    paidDateLabel: inv.paidDate ? new Date(inv.paidDate).toLocaleDateString("fr-FR") : "—",
  }));

  const totalPaid = invoices.filter((i) => i.status === "payé").reduce((s, i) => s + i.amount, 0);
  const totalUnpaid = invoices.filter((i) => i.status !== "payé").reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
        <div className="admin-placeholder-card" style={{ padding: "12px 20px", flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fr ? "Total payé" : "Total Paid"}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-success, #16a34a)" }}>{totalPaid} €</div>
        </div>
        <div className="admin-placeholder-card" style={{ padding: "12px 20px", flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fr ? "Total impayé" : "Total Unpaid"}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-error, #dc2626)" }}>{totalUnpaid} €</div>
        </div>
      </div>

      <TableWithColumnFilters
        title={fr ? "Transactions" : "Transactions"}
        description={fr ? "Factures et prélèvements liés à ce client." : "Invoices and debits for this client."}
        data={rows}
        columns={[
          { key: "id", label: "ID", filterType: "text" },
          { key: "label", label: fr ? "Libellé" : "Label", filterType: "text" },
          { key: "type", label: "Type", filterType: "select", selectOptions: [{ value: "loyer", label: "Loyer" }, { value: "frais", label: "Frais" }] },
          { key: "amountLabel", label: fr ? "Montant" : "Amount", filterType: "text" },
          {
            key: "status",
            label: fr ? "Statut" : "Status",
            filterType: "select",
            selectOptions: [{ value: "payé", label: "Payé" }, { value: "impayé", label: "Impayé" }, { value: "en retard", label: "En retard" }],
            render: (row) => statusBadge(row.status),
          },
          { key: "dueDateLabel", label: fr ? "Échéance" : "Due Date", filterType: "text" },
          { key: "paidDateLabel", label: fr ? "Payé le" : "Paid Date", filterType: "text" },
        ]}
      />
    </div>
  );
}

// ──────────────────────────────────────────
// SUB-TAB: NOUVEAU BOOKING
// ──────────────────────────────────────────

function BookingTab({ client, fr }: { client: any; fr: boolean }) {
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("1");
  const [promoCode, setPromoCode] = useState("");

  const handleCreateBooking = () => {
    window.alert(
      fr
        ? `Fonctionnalité simulée — Booking créé pour ${client.fullName} au centre ${selectedCenter}, taille ${selectedSize}m², durée ${selectedDuration} mois. Promo: ${promoCode || "aucune"}.`
        : `Simulated — Booking created for ${client.fullName} at center ${selectedCenter}, size ${selectedSize}m², duration ${selectedDuration} months. Promo: ${promoCode || "none"}.`
    );
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{fr ? "Créer une réservation" : "Create Booking"}</h3>
      <div className="admin-placeholder-card" style={{ padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{fr ? "Centre" : "Center"}</label>
          <select className="admin-input" value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)} style={{ width: "100%" }}>
            <option value="">{fr ? "Sélectionner…" : "Select…"}</option>
            {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{fr ? "Taille (m²)" : "Size (m²)"}</label>
          <select className="admin-input" value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} style={{ width: "100%" }}>
            <option value="">{fr ? "Sélectionner…" : "Select…"}</option>
            {[1, 2, 3, 4, 5, 6, 7, 10, 15, 20].map((s) => <option key={s} value={s}>{s} m²</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{fr ? "Durée (mois)" : "Duration (months)"}</label>
          <select className="admin-input" value={selectedDuration} onChange={(e) => setSelectedDuration(e.target.value)} style={{ width: "100%" }}>
            {[1, 2, 3, 6, 12].map((d) => <option key={d} value={d}>{d} {fr ? "mois" : "months"}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{fr ? "Code promo" : "Promo Code"}</label>
          <input type="text" className="admin-input" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="WELCOME10" style={{ width: "100%" }} />
        </div>
        <button type="button" onClick={handleCreateBooking} className="admin-btn admin-btn-primary" style={{ width: "100%", marginTop: 8 }}>
          <MaterialSymbol name="add_circle" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 6 }} />
          {fr ? "Créer la réservation" : "Create Booking"}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// SUB-TAB: DEVIS
// ──────────────────────────────────────────

function DevisTab({ quotes, centerMap, fr }: { quotes: any[]; centerMap: Record<string, any>; fr: boolean }) {
  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      new: { bg: "var(--badge-blue-bg, #dbeafe)", text: "var(--badge-blue-text, #1e40af)" },
      sent: { bg: "var(--badge-yellow-bg, #fef9c3)", text: "var(--badge-yellow-text, #854d0e)" },
      accepted: { bg: "var(--badge-green-bg, #dcfce7)", text: "var(--badge-green-text, #166534)" },
      expired: { bg: "var(--badge-gray-bg, #f3f4f6)", text: "var(--badge-gray-text, #374151)" },
      abandoned: { bg: "var(--badge-red-bg, #fee2e2)", text: "var(--badge-red-text, #991b1b)" },
    };
    const c = colors[status] || colors.new;
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>{status}</span>;
  };

  if (quotes.length === 0) {
    return (
      <div className="admin-placeholder-card" style={{ padding: 20, textAlign: "center" }}>
        <MaterialSymbol name="request_quote" style={{ fontSize: 40, color: "var(--text-tertiary, #999)", marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fr ? "Aucun devis pour ce client." : "No quotes for this client."}</p>
      </div>
    );
  }

  const rows = quotes.map((q) => ({
    ...q,
    centerName: centerMap[q.centerId]?.name ?? q.centerId,
    sizeLabel: `${q.boxSizeWanted} m²`,
    createdLabel: new Date(q.createdAt).toLocaleDateString("fr-FR"),
    sentLabel: q.sentAt ? new Date(q.sentAt).toLocaleDateString("fr-FR") : "—",
  }));

  return (
    <TableWithColumnFilters
      title={fr ? "Devis" : "Quotes"}
      description={fr ? "Demandes de devis de ce client." : "Quote requests from this client."}
      data={rows}
      columns={[
        { key: "id", label: "ID", filterType: "text" },
        {
          key: "status",
          label: fr ? "Statut" : "Status",
          filterType: "select",
          selectOptions: [
            { value: "new", label: fr ? "Nouveau" : "New" },
            { value: "sent", label: fr ? "Envoyé" : "Sent" },
            { value: "accepted", label: fr ? "Accepté" : "Accepted" },
            { value: "expired", label: fr ? "Expiré" : "Expired" },
            { value: "abandoned", label: fr ? "Abandonné" : "Abandoned" },
          ],
          render: (row) => statusBadge(row.status),
        },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "sizeLabel", label: fr ? "Taille souhaitée" : "Desired Size", filterType: "text" },
        { key: "createdLabel", label: fr ? "Créé le" : "Created", filterType: "text" },
        { key: "sentLabel", label: fr ? "Envoyé le" : "Sent", filterType: "text" },
      ]}
    />
  );
}

// ──────────────────────────────────────────
// SUB-TAB: BOXES
// ──────────────────────────────────────────

function BoxesTab({ boxes, centerMap, fr }: { boxes: any[]; centerMap: Record<string, any>; fr: boolean }) {
  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      libre: { bg: "var(--badge-green-bg, #dcfce7)", text: "var(--badge-green-text, #166534)" },
      occupé: { bg: "var(--badge-blue-bg, #dbeafe)", text: "var(--badge-blue-text, #1e40af)" },
      réservé: { bg: "var(--badge-yellow-bg, #fef9c3)", text: "var(--badge-yellow-text, #854d0e)" },
      maintenance: { bg: "var(--badge-gray-bg, #f3f4f6)", text: "var(--badge-gray-text, #374151)" },
    };
    const c = colors[status] || colors.libre;
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>{status}</span>;
  };

  if (boxes.length === 0) {
    return (
      <div className="admin-placeholder-card" style={{ padding: 20, textAlign: "center" }}>
        <MaterialSymbol name="inventory_2" style={{ fontSize: 40, color: "var(--text-tertiary, #999)", marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fr ? "Aucune box attribuée à ce client." : "No boxes assigned to this client."}</p>
      </div>
    );
  }

  const rows = boxes.map((b) => ({
    ...b,
    centerName: centerMap[b.centerId]?.name ?? b.centerId,
    floorLabel: b.floor === 0 ? "RDC" : `${fr ? "Étage" : "Floor"} ${b.floor}`,
    sizeLabel: `${b.sizeM2} m²`,
    heightLabel: `${b.heightM} m`,
  }));

  return (
    <TableWithColumnFilters
      title="Boxes"
      description={fr ? "Boxes attribuées à ce client." : "Boxes assigned to this client."}
      data={rows}
      columns={[
        { key: "code", label: "Code", filterType: "text" },
        {
          key: "status",
          label: fr ? "Statut" : "Status",
          filterType: "select",
          selectOptions: [
            { value: "libre", label: "Libre" },
            { value: "occupé", label: "Occupé" },
            { value: "réservé", label: "Réservé" },
            { value: "maintenance", label: "Maintenance" },
          ],
          render: (row) => statusBadge(row.status),
        },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "floorLabel", label: fr ? "Étage" : "Floor", filterType: "text" },
        { key: "sizeLabel", label: fr ? "Taille" : "Size", filterType: "text" },
        { key: "heightLabel", label: fr ? "Hauteur" : "Height", filterType: "text" },
        { key: "comment", label: fr ? "Commentaire" : "Comment", filterType: "text", render: (row) => <span style={{ fontSize: 12 }}>{row.comment || "—"}</span> },
      ]}
    />
  );
}
