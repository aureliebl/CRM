"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { MaterialSymbol } from "./MaterialSymbol";

/**
 * Curated list of the most useful Material Symbols for an admin panel.
 * Any valid Material Symbol name typed manually in the search will also render correctly.
 */
const ALL_ICONS = [
  // Navigation & layout
  "dashboard", "home", "menu", "apps", "grid_view", "view_list", "view_module",
  "view_agenda", "view_kanban", "view_column", "view_quilt", "table_chart",
  "tab", "widgets", "space_dashboard", "wysiwyg", "web", "window",
  // People & groups
  "group", "groups", "person", "person_add", "person_search", "people",
  "supervisor_account", "manage_accounts", "account_circle", "face",
  "badge", "engineering", "support_agent", "diversity_3",
  // Business & finance
  "euro", "payments", "credit_card", "account_balance", "receipt",
  "receipt_long", "point_of_sale", "store", "storefront", "shopping_cart",
  "shopping_bag", "sell", "price_check", "currency_exchange", "savings",
  "wallet", "paid", "request_quote", "attach_money", "money",
  // Content & editing
  "edit", "edit_square", "edit_note", "create", "draw", "brush",
  "format_paint", "palette", "text_fields", "title", "notes",
  "description", "article", "newspaper", "feed", "rss_feed",
  "library_books", "auto_stories", "menu_book", "book", "import_contacts",
  // Data & analytics
  "analytics", "insights", "query_stats", "trending_up", "trending_down",
  "bar_chart", "pie_chart", "show_chart", "stacked_line_chart", "timeline",
  "leaderboard", "monitoring", "speed", "data_usage", "equalizer",
  "ssid_chart", "area_chart", "candlestick_chart", "waterfall_chart",
  // Files & folders
  "folder", "folder_open", "folder_shared", "create_new_folder",
  "file_copy", "file_present", "attach_file", "upload_file",
  "download", "upload", "cloud_upload", "cloud_download",
  "cloud", "cloud_sync", "backup", "restore",
  // Communication
  "mail", "email", "send", "forum", "chat", "chat_bubble",
  "message", "comment", "textsms", "call", "phone", "contact_phone",
  "notifications", "notification_important", "campaign", "announcement",
  // Actions
  "add", "add_circle", "add_box", "remove", "delete", "close",
  "check", "check_circle", "cancel", "block", "do_not_disturb",
  "search", "filter_list", "sort", "swap_vert", "swap_horiz",
  "refresh", "sync", "autorenew", "restart_alt", "undo", "redo",
  "save", "bookmark", "favorite", "star", "thumb_up", "thumb_down",
  "share", "link", "open_in_new", "launch", "exit_to_app",
  "lock", "lock_open", "key", "vpn_key", "password", "fingerprint",
  "visibility", "visibility_off", "preview", "zoom_in", "zoom_out",
  "fullscreen", "fullscreen_exit", "expand_more", "expand_less",
  "chevron_left", "chevron_right", "arrow_back", "arrow_forward",
  "arrow_upward", "arrow_downward", "unfold_more", "unfold_less",
  // Status & alerts
  "info", "warning", "error", "help", "check_circle",
  "pending", "schedule", "hourglass_empty", "timer", "alarm",
  "verified", "new_releases", "report", "flag", "outlined_flag",
  "priority_high", "low_priority",
  // Settings & tools
  "settings", "tune", "build", "construction", "handyman",
  "admin_panel_settings", "manage_search", "display_settings",
  "app_settings_alt", "developer_mode", "code", "terminal", "api",
  "integration_instructions", "data_object", "schema", "hub",
  // Maps & places
  "map", "location_on", "place", "explore", "public",
  "language", "travel_explore", "my_location", "near_me",
  // Devices & hardware
  "computer", "laptop", "phone_android", "tablet", "watch",
  "devices", "dns", "storage", "memory", "sd_card",
  "usb", "router", "wifi", "bluetooth", "cast",
  // Inventory & logistics
  "inventory", "inventory_2", "package", "local_shipping",
  "deployed_code", "deployed_code_account", "category", "label",
  "sell", "qr_code", "barcode",
  // Media
  "image", "photo_camera", "videocam", "movie", "music_note",
  "mic", "headphones", "play_circle", "pause_circle",
  // Misc
  "emoji_objects", "lightbulb", "rocket_launch", "science",
  "psychology", "school", "work", "business_center",
  "event", "calendar_month", "calendar_today", "date_range",
  "task", "task_alt", "assignment", "checklist", "rule",
  "bug_report", "pest_control", "troubleshoot", "support",
  "health_and_safety", "shield", "security", "gpp_good",
  "verified_user", "policy", "privacy_tip",
  "translate", "g_translate", "spellcheck",
  "print", "local_printshop", "scanner",
  "power", "bolt", "electric_bolt", "flash_on",
  "eco", "park", "forest", "water_drop",
  "auto_awesome", "magic_button", "assistant", "smart_toy",
  "token", "tag", "loyalty", "redeem",
  "credit_score", "score", "grade", "military_tech",
  "emoji_events", "celebration", "cake",
  "workspace_premium", "diamond", "stars",
];

// Deduplicate
const UNIQUE_ICONS = Array.from(new Set(ALL_ICONS));

interface IconPickerModalProps {
  isOpen: boolean;
  currentIcon: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function IconPickerModal({ isOpen, currentIcon, onSelect, onClose }: IconPickerModalProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    if (!search.trim()) return UNIQUE_ICONS;
    const q = search.trim().toLowerCase();
    return UNIQUE_ICONS.filter((name) => name.includes(q));
  }, [search]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--card-bg, #1e1e2e)",
          border: "1px solid var(--border-color)",
          borderRadius: "0.75rem",
          width: "min(640px, 92vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.85rem 1rem",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Material Symbols</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              color: "var(--text-primary)",
              cursor: "pointer",
              padding: "0.2rem",
              display: "inline-flex",
            }}
          >
            <MaterialSymbol name="close" size={20} weight={500} opticalSize={24} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "0.65rem 1rem" }}>
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un symbole..."
            style={{
              width: "100%",
              padding: "0.5rem 0.65rem",
              borderRadius: "0.45rem",
              border: "1px solid var(--border-color)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "0.85rem",
            }}
          />
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
            {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            {search.trim() && !filtered.includes(search.trim()) && (
              <span> — vous pouvez aussi taper un nom libre et appuyer Entrée</span>
            )}
          </div>
        </div>

        {/* Grid */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.5rem 1rem 1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
            gap: "0.35rem",
            alignContent: "start",
          }}
        >
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onSelect(name);
                onClose();
              }}
              style={{
                appearance: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.2rem",
                padding: "0.55rem 0.25rem",
                borderRadius: "0.45rem",
                border: currentIcon === name ? "2px solid var(--accent-color, #0ea5e9)" : "1px solid var(--border-color)",
                background: currentIcon === name ? "rgba(14,165,233,0.08)" : "var(--button-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                minHeight: "60px",
              }}
              title={name}
            >
              <MaterialSymbol name={name} size={24} weight={400} opticalSize={24} />
              <span style={{ fontSize: "0.6rem", lineHeight: 1.2, textAlign: "center", wordBreak: "break-all", color: "var(--text-secondary)" }}>
                {name}
              </span>
            </button>
          ))}

          {/* Allow free-form entry if search term is not in the list */}
          {search.trim() && !filtered.includes(search.trim()) && (
            <button
              type="button"
              onClick={() => {
                onSelect(search.trim());
                onClose();
              }}
              style={{
                appearance: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.2rem",
                padding: "0.55rem 0.25rem",
                borderRadius: "0.45rem",
                border: "2px dashed var(--border-color)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
                minHeight: "60px",
              }}
              title={`Utiliser "${search.trim()}"`}
            >
              <MaterialSymbol name={search.trim()} size={24} weight={400} opticalSize={24} />
              <span style={{ fontSize: "0.6rem", lineHeight: 1.2, textAlign: "center", wordBreak: "break-all", color: "var(--text-secondary)" }}>
                {search.trim()}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
