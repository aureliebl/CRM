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
      className="admin-aircall-btn"
      style={{
        padding: "0.35rem 0.75rem",
        borderRadius: "999px",
        border: "none",
        background: "transparent",
        color: "white",
        cursor: "pointer",
        fontSize: "0.78rem",
        fontWeight: 590,
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        boxShadow: "0 8px 24px rgba(43,34,18,0.10)",
      }}
    >
      <MaterialSymbol
        name={APP_MATERIAL_SYMBOLS.actions.phone}
        size={16}
        weight={500}
        opticalSize={20}
        style={{ color: "white" }}
      />
      {locale === "fr" ? "Aircall" : "Aircall"}
    </button>
  );
}
