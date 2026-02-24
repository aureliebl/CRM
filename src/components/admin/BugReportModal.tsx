"use client";

import { useState } from "react";
import { useLocale } from "@/lib/use-locale";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useLocale();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    alert(t.bug_modal_sent_alert ?? "Sent");
    setTitle("");
    setDescription("");
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--overlay-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--modal-bg)",
          borderRadius: "1rem",
          padding: "1.5rem",
          width: "90%",
          maxWidth: "500px",
          border: "1px solid var(--border-color)",
          boxShadow: `0 20px 60px var(--shadow-color)`,
        }}
      >
        <h2
          style={{
            fontSize: "1.2rem",
            fontWeight: 600,
            marginBottom: "1rem",
            color: "var(--text-primary)",
          }}
        >
          {t.bug_modal_title}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                marginBottom: "0.35rem",
              }}
            >
              {t.bug_modal_title_label}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-hover)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                marginBottom: "0.35rem",
              }}
            >
              {t.bug_modal_description_label}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-hover)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "999px",
                border: "1px solid rgba(148,163,184,0.4)",
                background: "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              {t.bug_modal_cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "999px",
                border: "1px solid rgba(129,140,248,0.8)",
                background:
                  "linear-gradient(120deg, rgba(30,64,175,0.9), rgba(79,70,229,0.9))",
                color: "var(--text-primary)",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? t.bug_modal_sending : t.bug_modal_send}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
