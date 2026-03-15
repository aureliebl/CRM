"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import nextDynamic from "next/dynamic";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { AsyncButton } from "@/components/admin/AsyncButton";
import { useLocale } from "@/lib/use-locale";

const FullPageChat = nextDynamic(
  () => import("flowise-embed-react").then((module) => module.FullPageChat),
  { ssr: false },
);

/* ─── Types ─── */

interface TicketVariable {
  key: string;
  value: string;
  type: "badge" | "date" | "text" | "link" | "progress";
  color?: string;
}

interface TicketCard {
  id: string;
  boardId: string;
  columnKey: string;
  position: number;
  title: string;
  description: string | null;
  variables: TicketVariable[];
  assigneeId: string | null;
  followerIds: string[];
  source: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketComment {
  id: string;
  cardId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

interface TicketAttachment {
  id: string;
  cardId: string;
  commentId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  src: string;
}

interface TicketUser {
  id: string;
  firstName: string | null;
  fullName: string;
  profileImage: string | null;
  isActive: boolean;
}

interface BoardColumn {
  key: string;
  labelFr: string;
  labelEn: string;
  color: string;
}

interface Board {
  id: string;
  name: string;
  columns: BoardColumn[];
}

interface ApiToken {
  id: string;
  label: string;
  boardId: string;
  isActive: boolean;
  createdAt: string;
}

interface SessionActor {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isSuperAdmin?: boolean;
}

type ModalView = "detail" | "create" | "edit" | "tokens" | "flowise";

/* ─── i18n ─── */

const labels = {
  fr: {
    title: "Tickets",
    description: "Tableau de suivi des tickets",
    search: "Rechercher…",
    addTicket: "Nouveau ticket",
    noTickets: "Aucun ticket",
    noResults: "Aucun résultat",
    ticketTitle: "Titre",
    ticketDesc: "Description (HTML)",
    variables: "Variables",
    addVariable: "Ajouter une variable",
    save: "Enregistrer",
    cancel: "Annuler",
    create: "Créer",
    edit: "Modifier",
    delete: "Supprimer",
    deleteConfirm: "Supprimer ce ticket ?",
    moveTo: "Déplacer vers",
    createdAt: "Créé le",
    source: "Source",
    manual: "Manuel",
    api: "API",
    apiTokens: "Tokens API",
    createToken: "Créer un token",
    tokenLabel: "Label du token",
    tokenCreated: "Token créé (copie unique) :",
    deactivate: "Désactiver",
    copy: "Copier",
    copied: "Copié !",
    varKey: "Clé",
    varValue: "Valeur",
    varType: "Type",
    varColor: "Couleur",
    linkText: "Texte du lien",
    linkUrl: "https://…",
    remove: "Retirer",
    priority: "Priorité",
    creator: "Créateur",
    assignee: "Assigné",
    followers: "Followers",
    unassigned: "Non assigné",
    close: "Fermer",
    aiChat: "Chat AI",
    aiChatTitle: "Créer un ticket via Chat AI",
    aiChatCreator: "Créateur du ticket",
    aiChatSelectUser: "Sélectionnez un utilisateur…",
    comments: "Commentaires",
    addComment: "Ajouter un commentaire",
    commentPlaceholder: "Écrire un commentaire… (Ctrl+Entrée pour envoyer)",
    send: "Envoyer",
    noComments: "Aucun commentaire",
    attachments: "Pièces jointes",
    addImage: "Ajouter une image",
    noAttachments: "Aucune pièce jointe",
    uploadingImages: "Envoi des images…",
  },
  en: {
    title: "Tickets",
    description: "Ticket tracking board",
    search: "Search…",
    addTicket: "New ticket",
    noTickets: "No tickets",
    noResults: "No results",
    ticketTitle: "Title",
    ticketDesc: "Description (HTML)",
    variables: "Variables",
    addVariable: "Add variable",
    save: "Save",
    cancel: "Cancel",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this ticket?",
    moveTo: "Move to",
    createdAt: "Created",
    source: "Source",
    manual: "Manual",
    api: "API",
    apiTokens: "API Tokens",
    createToken: "Create token",
    tokenLabel: "Token label",
    tokenCreated: "Token created (copy once):",
    deactivate: "Deactivate",
    copy: "Copy",
    copied: "Copied!",
    varKey: "Key",
    varValue: "Value",
    varType: "Type",
    varColor: "Color",
    linkText: "Link text",
    linkUrl: "https://…",
    remove: "Remove",
    priority: "Priority",
    creator: "Creator",
    assignee: "Assignee",
    followers: "Followers",
    unassigned: "Unassigned",
    close: "Close",
    aiChat: "AI Chat",
    aiChatTitle: "Create a ticket via AI Chat",
    aiChatCreator: "Ticket creator",
    aiChatSelectUser: "Select a user…",
    comments: "Comments",
    addComment: "Add a comment",
    commentPlaceholder: "Write a comment… (Ctrl+Enter to send)",
    send: "Send",
    noComments: "No comments",
    attachments: "Attachments",
    addImage: "Add image",
    noAttachments: "No attachments",
    uploadingImages: "Uploading images…",
  },
};

/* ─── Badge color map ─── */

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  red:    { bg: "var(--badge-red-bg, #fee2e2)",    text: "var(--badge-red-text, #991b1b)" },
  blue:   { bg: "var(--badge-blue-bg, #dbeafe)",   text: "var(--badge-blue-text, #1e40af)" },
  green:  { bg: "var(--badge-green-bg, #dcfce7)",  text: "var(--badge-green-text, #166534)" },
  orange: { bg: "var(--badge-orange-bg, #ffedd5)", text: "var(--badge-orange-text, #9a3412)" },
  yellow: { bg: "var(--badge-yellow-bg, #fef9c3)", text: "var(--badge-yellow-text, #854d0e)" },
  gray:   { bg: "var(--badge-gray-bg, #f3f4f6)",  text: "var(--badge-gray-text, #374151)" },
  purple: { bg: "#f3e8ff", text: "#6b21a8" },
};

/* ─── URL helper ─── */

function ensureAbsoluteUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/* ─── Variable renderer ─── */

function TicketVariableDisplay({ v, locale }: { v: TicketVariable; locale: string }) {
  if (v.type === "badge") {
    const c = BADGE_COLORS[v.color || "gray"] || BADGE_COLORS.gray;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 12, background: c.bg, color: c.text, fontWeight: 600 }}>
        {v.key}: {v.value}
      </span>
    );
  }

  if (v.type === "date") {
    let formatted = v.value;
    try {
      formatted = new Date(v.value).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    } catch { /* keep raw */ }
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
        <MaterialSymbol name="calendar_today" size={12} /> {v.key}: {formatted}
      </span>
    );
  }

  if (v.type === "link") {
    return (
      <a
        href={ensureAbsoluteUrl(v.value)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-primary)", textDecoration: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <MaterialSymbol name="open_in_new" size={12} /> {v.key}
      </a>
    );
  }

  if (v.type === "progress") {
    const pct = Math.max(0, Math.min(100, Number(v.value) || 0));
    const color = pct < 30 ? "var(--color-error, #dc2626)" : pct < 70 ? "var(--color-warning, #f59e0b)" : "var(--color-success, #16a34a)";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
        <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{v.key}</span>
        <div style={{ flex: 1, minWidth: 60, height: 6, borderRadius: 3, background: "var(--surface-secondary, #2a2a3d)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.3s" }} />
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{pct}%</span>
      </div>
    );
  }

  // text (default)
  return (
    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
      <strong>{v.key}:</strong> {v.value}
    </span>
  );
}

/* ─── Main page ─── */

export default function TicketsPage() {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const t = labels[locale] || labels.fr;

  const [actor, setActor] = useState<SessionActor | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [cards, setCards] = useState<TicketCard[]>([]);
  const [users, setUsers] = useState<TicketUser[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal
  const [modalView, setModalView] = useState<ModalView | null>(null);
  const [selectedCard, setSelectedCard] = useState<TicketCard | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formVars, setFormVars] = useState<TicketVariable[]>([]);
  const [formColumn, setFormColumn] = useState("nouveau");
  const [formAssigneeId, setFormAssigneeId] = useState("");
  const [formFollowerIds, setFormFollowerIds] = useState<string[]>([]);
  const [formSaving, setFormSaving] = useState(false);
  const [formFiles, setFormFiles] = useState<File[]>([]);

  // API tokens
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);

  // Flowise chat
  const [flowiseCreatorId, setFlowiseCreatorId] = useState("");

  // DnD state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertSide, setDragInsertSide] = useState<"before" | "after" | null>(null);

  const isAdmin = actor?.role === "admin";
  const isSuperAdmin = actor?.isSuperAdmin === true;

  /* ─── Data loading ─── */

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.authenticated && data.user) setActor(data.user);
    } catch { /* ignore */ }
  }, []);

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets");
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
        setCards(data.cards);
        setUsers(Array.isArray(data.users) ? data.users : []);
        setCommentCounts(data.commentCounts || {});
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => {
    if (actor) loadBoard();
  }, [actor, loadBoard]);

  // Polling every 5s for near-realtime
  useEffect(() => {
    if (!actor) return;
    const interval = setInterval(loadBoard, 5000);
    return () => clearInterval(interval);
  }, [actor, loadBoard]);

  /* ─── Clipboard ─── */

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch { /* ignore */ }
  }, []);

  /* ─── Modal helpers ─── */

  const closeModal = useCallback(() => {
    setModalView(null);
    setSelectedCard(null);
    setNewTokenValue(null);
  }, []);

  const openDetail = useCallback((card: TicketCard) => {
    setSelectedCard(card);
    setModalView("detail");
  }, []);

  useEffect(() => {
    const headerSearch = searchParams.get("search");
    if (headerSearch !== null) {
      setSearch(headerSearch);
    }
  }, [searchParams]);

  useEffect(() => {
    const ticketId = searchParams.get("ticketId");
    if (!ticketId || cards.length === 0) return;
    const found = cards.find((card) => card.id === ticketId);
    if (found) {
      openDetail(found);
    }
  }, [searchParams, cards, openDetail]);

  const openCreate = useCallback(() => {
    setFormTitle("");
    setFormDesc("");
    setFormVars([]);
    setFormColumn("nouveau");
    setFormAssigneeId("");
    setFormFollowerIds([]);
    setFormFiles([]);
    setModalView("create");
  }, []);

  const openFlowiseChat = useCallback(() => {
    setFlowiseCreatorId("");
    setModalView("flowise");
  }, []);

  const openEdit = useCallback(() => {
    if (!selectedCard) return;
    setFormTitle(selectedCard.title);
    setFormDesc(selectedCard.description || "");
    setFormVars([...selectedCard.variables]);
    setFormColumn(selectedCard.columnKey);
    setFormAssigneeId(selectedCard.assigneeId || "");
    setFormFollowerIds(selectedCard.followerIds || []);
    setFormFiles([]);
    setModalView("edit");
  }, [selectedCard]);

  const handleSave = useCallback(async () => {
    if (!formTitle) return;
    setFormSaving(true);
    try {
      const body = {
        title: formTitle,
        description: formDesc || null,
        variables: formVars,
        columnKey: formColumn,
        assigneeId: formAssigneeId || null,
        followerIds: formFollowerIds,
      };

      let cardId: string | null = null;

      if (modalView === "create") {
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          cardId = created.id;
        }
      } else if (modalView === "edit" && selectedCard) {
        const res = await fetch(`/api/tickets/${selectedCard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          cardId = selectedCard.id;
        }
      }

      // Upload attached images
      if (cardId && formFiles.length > 0) {
        for (const file of formFiles) {
          const fd = new FormData();
          fd.append("file", file);
          await fetch(`/api/tickets/${cardId}/attachments`, { method: "POST", body: fd });
        }
      }

      if (cardId) {
        await loadBoard();
        if (modalView === "create") {
          closeModal();
        } else if (selectedCard) {
          const updatedRes = await fetch(`/api/tickets/${cardId}`);
          if (updatedRes.ok) {
            const updated = await updatedRes.json();
            setSelectedCard(updated);
          }
          setModalView("detail");
        }
      }
    } catch { /* ignore */ }
    setFormSaving(false);
  }, [modalView, selectedCard, formTitle, formDesc, formVars, formColumn, formAssigneeId, formFollowerIds, formFiles, loadBoard, closeModal]);

  const handleDelete = useCallback(async () => {
    if (!selectedCard) return;
    if (!confirm(t.deleteConfirm)) return;
    try {
      await fetch(`/api/tickets/${selectedCard.id}`, { method: "DELETE" });
      await loadBoard();
      closeModal();
    } catch { /* ignore */ }
  }, [selectedCard, loadBoard, closeModal, t.deleteConfirm]);

  const handleMoveCard = useCallback(async (cardId: string, columnKey: string, position: number) => {
    try {
      await fetch("/api/tickets/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, columnKey, position }),
      });
      await loadBoard();
    } catch { /* ignore */ }
  }, [loadBoard]);

  /* ─── DnD handlers ─── */

  const onDragStart = useCallback((cardId: string) => {
    setDraggingId(cardId);
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverColumn(null);
    setDragOverCardId(null);
    setDragInsertSide(null);
  }, []);

  const onColumnDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverColumn(colKey);
  }, []);

  const onCardDragOver = useCallback((e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOverCardId(cardId);
    setDragInsertSide(e.clientY < midY ? "before" : "after");
  }, []);

  const onColumnDrop = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (!draggingId) return;

    // If dropping on a specific card, compute position
    if (dragOverCardId && (dragOverColumn === colKey || !dragOverColumn)) {
      const colCards = cards.filter((c) => c.columnKey === colKey).sort((a, b) => a.position - b.position);
      const targetIdx = colCards.findIndex((c) => c.id === dragOverCardId);
      const pos = dragInsertSide === "before" ? (targetIdx >= 0 ? targetIdx : 0) : (targetIdx >= 0 ? targetIdx + 1 : colCards.length);
      handleMoveCard(draggingId, colKey, pos);
    } else {
      // Drop at end of column
      const colCards = cards.filter((c) => c.columnKey === colKey);
      handleMoveCard(draggingId, colKey, colCards.length);
    }

    onDragEnd();
  }, [draggingId, dragOverCardId, dragOverColumn, dragInsertSide, cards, handleMoveCard, onDragEnd]);

  /* ─── API Tokens ─── */

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets/tokens");
      if (res.ok) setTokens(await res.json());
    } catch { /* ignore */ }
  }, []);

  const openTokensPanel = useCallback(() => {
    loadTokens();
    setNewTokenLabel("");
    setNewTokenValue(null);
    setModalView("tokens");
  }, [loadTokens]);

  const handleCreateToken = useCallback(async () => {
    if (!newTokenLabel) return;
    try {
      const res = await fetch("/api/tickets/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newTokenLabel }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewTokenValue(data.token);
        setNewTokenLabel("");
        loadTokens();
      }
    } catch { /* ignore */ }
  }, [newTokenLabel, loadTokens]);

  const handleDeactivateToken = useCallback(async (tokenId: string) => {
    try {
      await fetch(`/api/tickets/tokens/${tokenId}`, { method: "DELETE" });
      loadTokens();
    } catch { /* ignore */ }
  }, [loadTokens]);

  /* ─── Variable form helpers ─── */

  const addVariable = useCallback(() => {
    setFormVars((prev) => [...prev, { key: "", value: "", type: "badge", color: "gray" }]);
  }, []);

  const updateVariable = useCallback((idx: number, patch: Partial<TicketVariable>) => {
    setFormVars((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }, []);

  const removeVariable = useCallback((idx: number) => {
    setFormVars((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /* ─── Search filter ─── */

  const filteredCards = search
    ? cards.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.variables.some((v) => v.key.toLowerCase().includes(q) || v.value.toLowerCase().includes(q))
        );
      })
    : cards;

  const usersById: Record<string, TicketUser> = {};
  for (const user of users) usersById[user.id] = user;

  /* ─── Column label helper ─── */

  const colLabel = (col: BoardColumn) => (locale === "fr" ? col.labelFr : col.labelEn);

  /* ─── RENDER ─── */

  if (!actor) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        <MaterialSymbol name="hourglass_empty" size={32} />
      </div>
    );
  }

  const columns = board?.columns || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 className="admin-page-title" style={{ margin: 0 }}>{t.title}</h1>
          <p className="admin-page-description" style={{ margin: "4px 0 0" }}>{t.description}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <MaterialSymbol name="search" size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              style={{ ...inputStyle, marginBottom: 0, paddingLeft: 32, width: 200 }}
            />
          </div>
          {isSuperAdmin && (
            <button onClick={openTokensPanel} className="admin-btn" style={{ fontSize: 12, gap: 4 }}>
              <MaterialSymbol name="vpn_key" size={14} /> {t.apiTokens}
            </button>
          )}
          {actor && (
            <button onClick={openFlowiseChat} className="admin-btn" style={{ fontSize: 13, gap: 4 }}>
              <MaterialSymbol name="smart_toy" size={16} /> {t.aiChat}
            </button>
          )}
          {actor && (
            <AsyncButton onClick={openCreate} variant="primary" style={{ fontSize: 13, gap: 4 }}>
              <MaterialSymbol name="add" size={16} /> {t.addTicket}
            </AsyncButton>
          )}
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <MaterialSymbol name="hourglass_empty" size={28} />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`,
            gap: 12,
            flex: 1,
            overflow: "auto",
            paddingBottom: 20,
          }}
        >
          {columns.map((col) => {
            const colCards = filteredCards
              .filter((c) => c.columnKey === col.key)
              .sort((a, b) => a.position - b.position);

            const isOver = dragOverColumn === col.key;

            return (
              <div
                key={col.key}
                onDragOver={(e) => onColumnDragOver(e, col.key)}
                onDrop={(e) => onColumnDrop(e, col.key)}
                onDragLeave={() => {
                  if (dragOverColumn === col.key) setDragOverColumn(null);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 10,
                  border: `1px solid ${isOver ? col.color : "var(--border-color, #333)"}`,
                  background: isOver ? `${col.color}08` : "var(--card-bg, #1e1e2e)",
                  transition: "border-color 0.2s, background 0.2s",
                  minHeight: 280,
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--border-color, #333)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{colLabel(col)}</span>
                  <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 10, background: "var(--surface-secondary)", color: "var(--text-muted)", fontWeight: 600 }}>
                    {colCards.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
                  {colCards.length === 0 && !isOver && (
                    <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-muted)", fontSize: 12 }}>
                      {t.noTickets}
                    </div>
                  )}

                  {colCards.map((card) => (
                    <div key={card.id}>
                      {/* Insert indicator before */}
                      {dragOverCardId === card.id && dragInsertSide === "before" && (
                        <div className="kanban-insert-line" style={{ height: 3, borderRadius: 2, marginBottom: 4 }} />
                      )}

                      <div
                        draggable
                        onDragStart={() => onDragStart(card.id)}
                        onDragEnd={onDragEnd}
                        onDragOver={(e) => onCardDragOver(e, card.id)}
                        onClick={() => openDetail(card)}
                        className="ui-hover-premium"
                        style={{
                          padding: "10px 12px",
                          background: "var(--surface-primary, #232338)",
                          border: "1px solid var(--border-color, #333)",
                          borderRadius: 8,
                          cursor: "pointer",
                          opacity: draggingId === card.id ? 0 : 1,
                          transition: "opacity 0.15s, border-color 0.2s, box-shadow 0.2s",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {card.title}
                        </div>

                        {/* Show max 3 badge variables on card */}
                        {card.variables.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {card.variables.filter((v) => v.type === "badge").slice(0, 3).map((v, i) => {
                              const c = BADGE_COLORS[v.color || "gray"] || BADGE_COLORS.gray;
                              return (
                                <span key={i} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: c.bg, color: c.text, fontWeight: 600 }}>
                                  {v.value}
                                </span>
                              );
                            })}
                            {card.variables.filter((v) => v.type === "date").slice(0, 1).map((v, i) => {
                              let formatted = v.value;
                              try { formatted = new Date(v.value).toLocaleDateString(locale, { day: "numeric", month: "short" }); } catch { /* raw */ }
                              return (
                                <span key={`d${i}`} style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 2 }}>
                                  <MaterialSymbol name="calendar_today" size={10} /> {formatted}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Source + date line */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {card.source === "api" ? "API" : ""}
                            {(commentCounts[card.id] || 0) > 0 && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "var(--accent-primary, #6366f1)" }}>
                                <MaterialSymbol name="chat_bubble" size={12} />
                                <span style={{ fontWeight: 700 }}>{commentCounts[card.id]}</span>
                              </span>
                            )}
                          </span>
                          <span>{new Date(card.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          <UserInlineChip user={card.createdBy ? usersById[card.createdBy] : undefined} fallbackLabel={t.unassigned} />
                          <UserInlineChip user={card.assigneeId ? usersById[card.assigneeId] : undefined} fallbackLabel={t.unassigned} />
                        </div>
                      </div>

                      {/* Insert indicator after */}
                      {dragOverCardId === card.id && dragInsertSide === "after" && (
                        <div className="kanban-insert-line" style={{ height: 3, borderRadius: 2, marginTop: 4 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal overlay */}
      {modalView && typeof document !== "undefined" && createPortal((
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, backgroundColor: "var(--overlay-bg, rgba(0,0,0,0.6))",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000,
            padding: "20px 14px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--modal-bg, #1a1a2e)",
              borderRadius: 16, padding: 28,
              width: modalView === "flowise" ? "min(900px, calc(100vw - 28px))" : "min(760px, calc(100vw - 28px))",
              maxHeight: "calc(100vh - 40px)", overflowY: "auto",
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            {/* Close button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                <MaterialSymbol name="close" size={20} />
              </button>
            </div>

            {modalView === "detail" && selectedCard && <TicketDetailView card={selectedCard} locale={locale} t={t} columns={columns} colLabel={colLabel} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} openEdit={openEdit} handleDelete={handleDelete} handleMoveCard={handleMoveCard} loadBoard={loadBoard} usersById={usersById} />}
            {(modalView === "create" || modalView === "edit") && renderForm(t, columns, colLabel, locale, formTitle, setFormTitle, formDesc, setFormDesc, formVars, formColumn, setFormColumn, formAssigneeId, setFormAssigneeId, formFollowerIds, setFormFollowerIds, users, addVariable, updateVariable, removeVariable, formSaving, handleSave, closeModal, modalView, formFiles, setFormFiles)}
            {modalView === "tokens" && renderTokens(t, tokens, newTokenLabel, setNewTokenLabel, newTokenValue, handleCreateToken, handleDeactivateToken, copyToClipboard, copiedField)}
            {modalView === "flowise" && renderFlowiseChat(t, users, flowiseCreatorId, setFlowiseCreatorId)}
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

/* ─── Detail component ─── */

function TicketDetailView({
  card,
  locale,
  t,
  columns,
  colLabel,
  isAdmin,
  isSuperAdmin,
  openEdit,
  handleDelete,
  handleMoveCard,
  loadBoard,
  usersById,
}: {
  card: TicketCard;
  locale: string;
  t: typeof labels.fr;
  columns: { key: string; labelFr: string; labelEn: string; color: string }[];
  colLabel: (c: BoardColumn) => string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  openEdit: () => void;
  handleDelete: () => void;
  handleMoveCard: (id: string, col: string, pos: number) => void;
  loadBoard: () => void;
  usersById: Record<string, TicketUser>;
}) {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);

  const loadAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${card.id}/attachments`);
      if (res.ok) setAttachments(await res.json());
    } catch { /* ignore */ }
  }, [card.id]);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${card.id}/comments`);
      if (res.ok) setComments(await res.json());
    } catch { /* ignore */ }
  }, [card.id]);

  useEffect(() => { loadComments(); loadAttachments(); }, [loadComments, loadAttachments]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() && commentFiles.length === 0) return;
    setCommentSending(true);
    try {
      const res = await fetch(`/api/tickets/${card.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentText.trim() || "📎" }),
      });
      if (res.ok) {
        const newComment = await res.json();
        // Upload comment images
        if (commentFiles.length > 0) {
          for (const file of commentFiles) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("commentId", newComment.id);
            await fetch(`/api/tickets/${card.id}/attachments`, { method: "POST", body: fd });
          }
        }
        setCommentText("");
        setCommentFiles([]);
        await loadComments();
        await loadAttachments();
        loadBoard(); // refresh counts
      }
    } catch { /* ignore */ }
    setCommentSending(false);
  }, [card.id, commentText, commentFiles, loadComments, loadAttachments, loadBoard]);

  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    try {
      await fetch(`/api/tickets/attachments/${attachmentId}`, { method: "DELETE" });
      await loadAttachments();
    } catch { /* ignore */ }
  }, [loadAttachments]);

  const currentCol = columns.find((c) => c.key === card.columnKey);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: "var(--text-primary)" }}>{card.title}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            {currentCol && (
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 12, background: currentCol.color + "22", color: currentCol.color, fontWeight: 700, border: `1px solid ${currentCol.color}44` }}>
                {colLabel(currentCol)}
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {card.source === "api" ? "via API" : t.manual}
            </span>
          </div>
        </div>
      </div>

      {/* Variables */}
      {card.variables.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, padding: "12px 14px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>{t.variables}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {card.variables.map((v, i) => (
              <TicketVariableDisplay key={i} v={v} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {/* Description (HTML rendered) */}
      {card.description && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>Description</div>
          <div
            style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, padding: "12px 14px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8, overflowWrap: "break-word" }}
            dangerouslySetInnerHTML={{ __html: card.description }}
          />
        </div>
      )}

      {/* Metadata */}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>{t.createdAt}: {new Date(card.createdAt).toLocaleString(locale)}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <strong>{t.creator}:</strong>
            <UserInlineChip user={card.createdBy ? usersById[card.createdBy] : undefined} fallbackLabel={t.unassigned} />
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <strong>{t.assignee}:</strong>
            <UserInlineChip user={card.assigneeId ? usersById[card.assigneeId] : undefined} fallbackLabel={t.unassigned} />
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong>{t.followers}:</strong>
          {card.followerIds.length === 0 ? (
            <span>{t.unassigned}</span>
          ) : (
            card.followerIds.map((userId) => (
              <UserInlineChip key={userId} user={usersById[userId]} fallbackLabel={t.unassigned} />
            ))
          )}
        </div>
      </div>

      {/* Ticket Attachments (card-level, no commentId) */}
      {(() => {
        const cardAttachments = attachments.filter((a) => !a.commentId);
        return cardAttachments.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <MaterialSymbol name="image" size={14} />
              {t.attachments} ({cardAttachments.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {cardAttachments.map((att) => (
                <div key={att.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                  <img
                    src={att.src}
                    alt={att.fileName}
                    style={{ display: "block", maxWidth: 200, maxHeight: 150, objectFit: "cover" }}
                  />
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    title={t.delete}
                    style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                  >
                    <MaterialSymbol name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Comments */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <MaterialSymbol name="chat_bubble" size={14} />
          {t.comments} ({comments.length})
        </div>

        {comments.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 14px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8, textAlign: "center" }}>
            {t.noComments}
          </div>
        )}

        {comments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {comments.map((comment) => {
              const author = usersById[comment.authorId];
              const commentAttachments = attachments.filter((a) => a.commentId === comment.id);
              return (
                <div key={comment.id} style={{ display: "flex", gap: 10, padding: "10px 14px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8 }}>
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    <InlineAvatar user={author} size={28} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                        {displayUserName(author)}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(comment.createdAt).toLocaleString(locale)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                      {comment.body}
                    </div>
                    {commentAttachments.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {commentAttachments.map((att) => (
                          <div key={att.id} style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                            <img
                              src={att.src}
                              alt={att.fileName}
                              style={{ display: "block", maxWidth: 180, maxHeight: 120, objectFit: "cover" }}
                            />
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              title={t.delete}
                              style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                            >
                              <MaterialSymbol name="close" size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add comment form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t.commentPlaceholder}
              rows={2}
              style={{ ...inputStyle, marginBottom: 0, flex: 1, resize: "vertical", fontSize: 13 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label
                className="admin-btn"
                style={{ fontSize: 12, gap: 4, padding: "8px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
              >
                <MaterialSymbol name="image" size={14} />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files) setCommentFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                onClick={handleAddComment}
                disabled={commentSending || (!commentText.trim() && commentFiles.length === 0)}
                className="admin-btn"
                style={{
                  fontSize: 12,
                  gap: 4,
                  padding: "8px 14px",
                  opacity: commentSending || (!commentText.trim() && commentFiles.length === 0) ? 0.5 : 1,
                  cursor: commentSending || (!commentText.trim() && commentFiles.length === 0) ? "not-allowed" : "pointer",
                }}
              >
                <MaterialSymbol name="send" size={14} /> {t.send}
              </button>
            </div>
          </div>
          {commentFiles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {commentFiles.map((file, i) => (
                <div key={i} style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    style={{ display: "block", width: 60, height: 60, objectFit: "cover" }}
                  />
                  <button
                    onClick={() => setCommentFiles((prev) => prev.filter((_, j) => j !== i))}
                    style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                  >
                    <MaterialSymbol name="close" size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border-color)", paddingTop: 14 }}>
        <select
          onChange={(e) => {
            if (e.target.value) {
              handleMoveCard(card.id, e.target.value, 0);
              // Update locally
              setTimeout(loadBoard, 300);
            }
          }}
          value=""
          style={{ ...inputStyle, marginBottom: 0, fontSize: 12, width: "auto" }}
        >
          <option value="">{t.moveTo}…</option>
          {columns.filter((c) => c.key !== card.columnKey).map((c) => (
            <option key={c.key} value={c.key}>{colLabel(c)}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={openEdit} className="admin-btn" style={{ fontSize: 13, gap: 4 }}>
          <MaterialSymbol name="edit" size={16} /> {t.edit}
        </button>
        <button onClick={handleDelete} className="admin-btn" style={{ fontSize: 13, gap: 4, color: "var(--color-error, #dc2626)" }}>
          <MaterialSymbol name="delete" size={16} /> {t.delete}
        </button>
      </div>
    </div>
  );
}

/* ─── Form render ─── */

function renderForm(
  t: typeof labels.fr,
  columns: BoardColumn[],
  colLabel: (c: BoardColumn) => string,
  locale: string,
  formTitle: string, setFormTitle: (v: string) => void,
  formDesc: string, setFormDesc: (v: string) => void,
  formVars: TicketVariable[], formColumn: string, setFormColumn: (v: string) => void,
  formAssigneeId: string, setFormAssigneeId: (v: string) => void,
  formFollowerIds: string[], setFormFollowerIds: (v: string[]) => void,
  users: TicketUser[],
  addVariable: () => void,
  updateVariable: (i: number, p: Partial<TicketVariable>) => void,
  removeVariable: (i: number) => void,
  formSaving: boolean,
  handleSave: () => void,
  closeModal: () => void,
  modalView: string,
  formFiles: File[],
  setFormFiles: (v: File[] | ((prev: File[]) => File[])) => void,
) {
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text-primary)" }}>
        {modalView === "create" ? t.create : t.edit}
      </h2>

      <label style={labelStyle}>{t.ticketTitle} *</label>
      <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={inputStyle} />

      <label style={labelStyle}>{t.ticketDesc}</label>
      <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} placeholder="<p>Description <strong>riche</strong> en HTML…</p>" />

      <label style={labelStyle}>{t.moveTo}</label>
      <select value={formColumn} onChange={(e) => setFormColumn(e.target.value)} style={{ ...inputStyle }}>
        {columns.map((c) => (
          <option key={c.key} value={c.key}>{colLabel(c)}</option>
        ))}
      </select>

      <label style={labelStyle}>{t.assignee}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <button
          onClick={() => setFormAssigneeId("")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 999,
            border: !formAssigneeId ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
            background: !formAssigneeId ? "var(--accent-primary)" : "transparent",
            color: !formAssigneeId ? "#fff" : "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.unassigned}
        </button>
        {users.filter((user) => user.isActive).map((user) => {
          const active = formAssigneeId === user.id;
          return (
            <button
              key={user.id}
              onClick={() => setFormAssigneeId(active ? "" : user.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                borderRadius: 999,
                border: active ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                background: active ? "var(--accent-primary)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <InlineAvatar user={user} size={20} />
              {displayUserName(user)}
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>{t.followers}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {users.filter((user) => user.isActive).map((user) => {
          const active = formFollowerIds.includes(user.id);
          return (
            <button
              key={user.id}
              onClick={() => {
                setFormFollowerIds(
                  active
                    ? formFollowerIds.filter((value) => value !== user.id)
                    : [...formFollowerIds, user.id]
                );
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                borderRadius: 999,
                border: active ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                background: active ? "var(--accent-primary)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <InlineAvatar user={user} size={20} />
              {displayUserName(user)}
            </button>
          );
        })}
      </div>

      {/* Variables */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{t.variables}</label>
        <button onClick={addVariable} className="admin-btn" style={{ fontSize: 11, padding: "2px 8px" }}>
          <MaterialSymbol name="add" size={12} /> {t.addVariable}
        </button>
      </div>

      {formVars.map((v, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input value={v.key} onChange={(e) => updateVariable(i, { key: e.target.value })} placeholder={v.type === "link" ? t.linkText : t.varKey} style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }} />
          <input type={v.type === "link" ? "url" : "text"} value={v.value} onChange={(e) => updateVariable(i, { value: e.target.value })} placeholder={v.type === "link" ? t.linkUrl : t.varValue} style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }} />
          <select value={v.type} onChange={(e) => updateVariable(i, { type: e.target.value as TicketVariable["type"] })} style={{ ...inputStyle, marginBottom: 0, fontSize: 12, width: 90 }}>
            <option value="badge">Badge</option>
            <option value="date">Date</option>
            <option value="text">Text</option>
            <option value="link">Link</option>
            <option value="progress">Progress</option>
          </select>
          {v.type === "badge" && (
            <select value={v.color || "gray"} onChange={(e) => updateVariable(i, { color: e.target.value })} style={{ ...inputStyle, marginBottom: 0, fontSize: 12, width: 80 }}>
              {["red","blue","green","orange","yellow","gray","purple"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {v.type !== "badge" && <div />}
          <button onClick={() => removeVariable(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-error, #dc2626)", padding: 4 }}>
            <MaterialSymbol name="close" size={14} />
          </button>
        </div>
      ))}

      {/* Image Attachments */}
      <label style={labelStyle}>{t.attachments}</label>
      <div style={{ marginBottom: 14 }}>
        <label
          className="admin-btn"
          style={{ fontSize: 12, gap: 4, padding: "6px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
        >
          <MaterialSymbol name="image" size={14} /> {t.addImage}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) setFormFiles((prev: File[]) => [...prev, ...Array.from(e.target.files!)]);
              e.target.value = "";
            }}
          />
        </label>
        {formFiles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {formFiles.map((file, i) => (
              <div key={i} style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  style={{ display: "block", width: 80, height: 80, objectFit: "cover" }}
                />
                <button
                  onClick={() => setFormFiles((prev: File[]) => prev.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                >
                  <MaterialSymbol name="close" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={closeModal} className="admin-btn" style={{ fontSize: 13 }}>{t.cancel}</button>
        <AsyncButton
          onClick={handleSave}
          variant="primary"
          isLoading={formSaving}
          disabled={formSaving || !formTitle}
          style={{ fontSize: 13 }}
        >
          {t.save}
        </AsyncButton>
      </div>
    </div>
  );
}

/* ─── Tokens render ─── */

function renderTokens(
  t: typeof labels.fr,
  tokens: ApiToken[],
  newTokenLabel: string,
  setNewTokenLabel: (v: string) => void,
  newTokenValue: string | null,
  handleCreateToken: () => void,
  handleDeactivateToken: (id: string) => void,
  copyToClipboard: (text: string, field: string) => void,
  copiedField: string | null,
) {
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text-primary)" }}>{t.apiTokens}</h2>

      {/* New token created */}
      {newTokenValue && (
        <div style={{ padding: "12px 14px", background: "var(--success-bg, #dcfce7)", borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--success-text)", marginBottom: 4 }}>{t.tokenCreated}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{ fontFamily: "monospace", fontSize: 11, flex: 1, wordBreak: "break-all", color: "var(--success-text, #166534)" }}>{newTokenValue}</code>
            <button onClick={() => copyToClipboard(newTokenValue, "token")} className="admin-btn" style={{ fontSize: 11, padding: "2px 8px" }}>
              {copiedField === "token" ? "✓" : t.copy}
            </button>
          </div>
        </div>
      )}

      {/* Create token form */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={newTokenLabel} onChange={(e) => setNewTokenLabel(e.target.value)} placeholder={t.tokenLabel} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
        <AsyncButton
          onClick={handleCreateToken}
          variant="primary"
          style={{ fontSize: 12 }}
          disabled={!newTokenLabel}
        >
          {t.createToken}
        </AsyncButton>
      </div>

      {/* curl example */}
      <div style={{ padding: "10px 14px", background: "var(--surface-secondary)", borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Exemple curl :</div>
        <code style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {`curl -X POST ${typeof window !== "undefined" ? window.location.origin : "https://your-app.com"}/api/tickets/ingest \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Bug report","description":"<p>Details</p>","variables":[{"key":"Priorité","value":"Haute","type":"badge","color":"red"}]}'`}
        </code>
      </div>

      {/* Token list */}
      {tokens.map((tok) => (
        <div key={tok.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
          border: "1px solid var(--border-color)", borderRadius: 8, marginBottom: 6,
          opacity: tok.isActive ? 1 : 0.5,
        }}>
          <MaterialSymbol name="vpn_key" size={16} style={{ color: tok.isActive ? "var(--accent-primary)" : "var(--text-muted)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{tok.label}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(tok.createdAt).toLocaleDateString()}</div>
          </div>
          {tok.isActive ? (
            <button onClick={() => handleDeactivateToken(tok.id)} className="admin-btn" style={{ fontSize: 11, color: "var(--color-error)" }}>
              {t.deactivate}
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Inactive</span>
          )}
        </div>
      ))}

      {tokens.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
          Aucun token
        </div>
      )}
    </div>
  );
}

/* ─── Flowise chat render ─── */

const FLOWISE_TICKET_CHATFLOW_ID = "e86ba344-9e5d-4cdc-b6e5-2f55481f1c0f";

function renderFlowiseChat(
  t: typeof labels.fr,
  users: TicketUser[],
  flowiseCreatorId: string,
  setFlowiseCreatorId: (v: string) => void,
) {
  const selectedUser = users.find((u) => u.id === flowiseCreatorId);

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text-primary)" }}>
        {t.aiChatTitle}
      </h2>

      {/* User selector */}
      <label style={labelStyle}>{t.aiChatCreator}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {users.filter((user) => user.isActive).map((user) => {
          const active = flowiseCreatorId === user.id;
          return (
            <button
              key={user.id}
              onClick={() => setFlowiseCreatorId(active ? "" : user.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                borderRadius: 999,
                border: active ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                background: active ? "var(--accent-primary)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <InlineAvatar user={user} size={20} />
              {displayUserName(user)}
            </button>
          );
        })}
      </div>

      {selectedUser && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 12px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8, fontSize: 13 }}>
          <InlineAvatar user={selectedUser} size={24} />
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            {displayUserName(selectedUser)}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            — {t.aiChatCreator}
          </span>
        </div>
      )}

      {/* Flowise chat embed */}
      <div
        style={{
          overflow: "hidden",
          borderRadius: 12,
          height: 500,
          border: "1px solid var(--border-color)",
        }}
      >
        <FullPageChat
          chatflowid={FLOWISE_TICKET_CHATFLOW_ID}
          apiHost="/api/flowise"
          chatflowConfig={flowiseCreatorId ? { createdBy: flowiseCreatorId } : {}}
          theme={{ chatWindow: { height: 500 } }}
        />
      </div>
    </div>
  );
}

function displayUserName(user?: TicketUser | null): string {
  if (!user) return "-";
  const first = (user.firstName || "").trim();
  if (first) return first;
  const full = (user.fullName || "").trim();
  return full ? full.split(/\s+/)[0] : user.id;
}

function InlineAvatar({ user, size = 18 }: { user?: TicketUser | null; size?: number }) {
  if (user?.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={displayUserName(user)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  const fallback = displayUserName(user);
  const initial = fallback && fallback !== "-" ? fallback[0].toUpperCase() : "?";
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface-secondary, #2a2a3d)",
        color: "var(--text-secondary)",
        fontSize: Math.max(10, Math.floor(size * 0.55)),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}

function UserInlineChip({ user, fallbackLabel }: { user?: TicketUser | null; fallbackLabel: string }) {
  if (!user) {
    return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fallbackLabel}</span>;
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
      <InlineAvatar user={user} size={18} />
      {displayUserName(user)}
    </span>
  );
}

/* ─── Shared styles ─── */

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-color, #333)",
  background: "var(--input-bg, #1e1e2e)",
  color: "var(--text-primary)",
  fontSize: 14,
  marginBottom: 14,
  outline: "none",
  boxSizing: "border-box" as const,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-muted)",
  marginBottom: 4,
  fontWeight: 600,
};
