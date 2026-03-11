"use client";

import Link from "next/link";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";

const ASSISTANTS = [
  {
    id: "general",
    name: "Assistant Général",
    description: "Assistant polyvalent pour répondre à toutes vos questions.",
    icon: "smart_toy",
    chatflowid: "47146e72-8790-4600-846f-03ba7e0301ae",
  },
  {
    id: "commercial",
    name: "Assistant Commercial",
    description: "Aide à la rédaction de devis et suivi client.",
    icon: "storefront",
    chatflowid: "47146e72-8790-4600-846f-03ba7e0301ae",
  },
  {
    id: "technique",
    name: "Assistant Technique",
    description: "Support technique et résolution de problèmes.",
    icon: "build",
    chatflowid: "47146e72-8790-4600-846f-03ba7e0301ae",
  },
  {
    id: "rh",
    name: "Assistant RH",
    description: "Gestion des ressources humaines et questions internes.",
    icon: "groups",
    chatflowid: "47146e72-8790-4600-846f-03ba7e0301ae",
  },
];

export default function FlowisePage() {
  return (
    <div style={{ padding: "0 1.5rem 1rem" }}>
      <h2
        style={{
          fontSize: "1.35rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: "0 0 0.25rem",
        }}
      >
        Assistants
      </h2>
      <p
        style={{
          fontSize: "0.92rem",
          color: "var(--text-secondary)",
          margin: "0 0 1.5rem",
        }}
      >
        Sélectionnez un assistant pour démarrer une conversation et enregistrer
        des données.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {ASSISTANTS.map((a) => (
          <Link
            key={a.id}
            href={`/flowise/${a.id}`}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: "1.25rem",
                background: "var(--surface-secondary)",
                cursor: "pointer",
                transition: "box-shadow 0.18s, border-color 0.18s",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-primary)";
                e.currentTarget.style.boxShadow =
                  "0 4px 16px rgba(0,0,0,0.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "var(--accent-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialSymbol
                  name={a.icon}
                  size={24}
                  style={{ color: "#fff" }}
                />
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: "var(--text-primary)",
                }}
              >
                {a.name}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                }}
              >
                {a.description}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
