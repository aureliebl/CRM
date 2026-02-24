"use client";

import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { APP_MATERIAL_SYMBOLS } from "@/lib/material-symbols";
import { useLocale } from "@/lib/use-locale";

export function AircallButton() {
  const { locale } = useLocale();
  const handleClick = () => {
    // Dispatcher un événement pour ouvrir le widget Aircall
    window.dispatchEvent(new CustomEvent("aircall:toggle"));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={locale === "fr" ? "Aircall" : "Aircall"}
      style={{
        padding: "0.4rem 0.75rem",
        borderRadius: "999px",
        border: "1px solid var(--border-hover)",
        background: "var(--button-bg)",
        color: "var(--text-primary)",
        cursor: "pointer",
        fontSize: "0.8rem",
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
      }}
    >
      <MaterialSymbol
        name={APP_MATERIAL_SYMBOLS.actions.phone}
        size={16}
        weight={500}
        opticalSize={20}
      />
      {locale === "fr" ? "Aircall" : "Aircall"}
    </button>
  );
}
