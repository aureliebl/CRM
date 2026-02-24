"use client";

import { useState } from "react";
import {
  getContentBlocks,
  updateContentBlock,
} from "@/lib/mock/content-and-components";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { useLocale } from "@/lib/use-locale";

export default function ContentPage() {
  const { locale } = useLocale();
  const labels =
    locale === "fr"
      ? {
          title: "Contenus front",
          description:
            "Mini CMS pour gérer les textes du site public Costockage par composant et par langue.",
          listAria: "Liste des blocs",
          tableTitle: "Blocs de contenu",
          tableDescription:
            "Sélectionnez un bloc pour en modifier le texte. Chaque bloc est lié à un composant front et une clé fonctionnelle.",
          key: "Clé",
          component: "Composant",
          language: "Langue",
          editorAria: "Édition du texte",
          editorTitle: "Éditeur",
          lastUpdate: "Dernière mise à jour :",
          save: "Enregistrer",
          emptySelect:
            "Sélectionnez un bloc dans la liste de gauche pour l'éditer.",
        }
      : {
          title: "Frontend content",
          description:
            "Mini CMS to manage public Costockage website texts by component and language.",
          listAria: "Blocks list",
          tableTitle: "Content blocks",
          tableDescription:
            "Select a block to edit its text. Each block is linked to a frontend component and a functional key.",
          key: "Key",
          component: "Component",
          language: "Language",
          editorAria: "Text editor",
          editorTitle: "Editor",
          lastUpdate: "Last update:",
          save: "Save",
          emptySelect: "Select a block from the left list to edit it.",
        };
  const initialBlocks = getContentBlocks();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    initialBlocks[0]?.id ?? null
  );
  const [localContent, setLocalContent] = useState<Record<string, string>>(
    Object.fromEntries(initialBlocks.map((b) => [b.id, b.value]))
  );

  const selectedBlock = initialBlocks.find((b) => b.id === selectedBlockId);

  const handleSave = () => {
    if (!selectedBlock) return;
    const newValue = localContent[selectedBlock.id] ?? "";
    updateContentBlock(selectedBlock.id, newValue, "Admin");
  };

  return (
    <div>
      <h1 className="admin-page-title">{labels.title}</h1>
      <p className="admin-page-description">{labels.description}</p>

      <div
        className="admin-placeholder-card"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2fr)",
          gap: "1rem",
        }}
      >
        <section aria-label={labels.listAria}>
          <TableWithColumnFilters
            title={labels.tableTitle}
            description={labels.tableDescription}
            data={initialBlocks}
            columns={[
              {
                key: "key",
                label: labels.key,
                filterType: "text",
                render: (block) => (
                  <button
                    type="button"
                    onClick={() => setSelectedBlockId(block.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{block.key}</div>
                    <div style={{ color: "var(--text-secondary)", marginTop: "0.1rem", fontSize: "0.76rem" }}>
                      {block.description}
                    </div>
                  </button>
                ),
              },
              { key: "componentId", label: labels.component, filterType: "text" },
              {
                key: "language",
                label: labels.language,
                filterType: "select",
                selectOptions: [
                  { value: "fr", label: "FR" },
                  { value: "en", label: "EN" },
                ],
                render: (block) => (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.1rem 0.45rem",
                      borderRadius: "999px",
                      border: "1px solid rgba(148,163,184,0.6)",
                    }}
                  >
                    {block.language.toUpperCase()}
                  </span>
                ),
              },
            ]}
          />
        </section>

        <section aria-label={labels.editorAria}>
          <div className="admin-placeholder-title">{labels.editorTitle}</div>
          {selectedBlock ? (
            <>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                <strong>Clé :</strong> {selectedBlock.key} ·{" "}
                <strong>Composant :</strong> {selectedBlock.componentId}
              </p>
              <textarea
                value={localContent[selectedBlock.id]}
                onChange={(e) =>
                  setLocalContent((prev) => ({
                    ...prev,
                    [selectedBlock.id]: e.target.value,
                  }))
                }
                rows={8}
                style={{
                  width: "100%",
                  borderRadius: "0.75rem",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--input-bg)",
                  color: "var(--text-primary)",
                  padding: "0.75rem 0.9rem",
                  resize: "vertical",
                  fontSize: "0.9rem",
                  marginBottom: "0.75rem",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                }}
              >
                <div>
                  {labels.lastUpdate}{" "}
                  {selectedBlock.lastUpdatedAt
                    ? new Date(
                        selectedBlock.lastUpdatedAt
                      ).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")
                    : "—"}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.35rem 0.9rem",
                    borderRadius: "999px",
                    border: "1px solid rgba(129,140,248,0.8)",
                    background:
                      "linear-gradient(120deg, rgba(30,64,175,0.9), rgba(79,70,229,0.9))",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {labels.save}
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {labels.emptySelect}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}


