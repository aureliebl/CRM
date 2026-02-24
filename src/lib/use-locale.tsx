"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "./mock/auth";
import fr from "@/locales/fr.json";
import en from "@/locales/en.json";

export function useLocale() {
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [t, setT] = useState(fr as any);

  useEffect(() => {
    const load = async () => {
      try {
        const user = getCurrentUser();
        if (!user) return;
        const res = await fetch(`/api/accounts/${user.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const l = data.locale === "en" ? "en" : "fr";
        setLocale(l);
        setT(l === "fr" ? fr : en);
      } catch (e) {
        // ignore
      }
    };

    const onLocaleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ locale?: "fr" | "en" }>;
      const next = customEvent.detail?.locale;
      if (!next) {
        load();
        return;
      }
      setLocale(next);
      setT(next === "fr" ? fr : en);
    };

    load();

    window.addEventListener("locale:update", onLocaleUpdate as EventListener);
    window.addEventListener("user:update", load);
    return () =>
      {
        window.removeEventListener(
          "locale:update",
          onLocaleUpdate as EventListener
        );
        window.removeEventListener("user:update", load);
      };
  }, []);

  const setLocaleAndPersist = async (next: "fr" | "en") => {
    setLocale(next);
    setT(next === "fr" ? fr : en);
    window.dispatchEvent(
      new CustomEvent("locale:update", { detail: { locale: next } })
    );
    try {
      const user = getCurrentUser();
      if (!user) return;
      await fetch(`/api/accounts/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    } catch (e) {
      // ignore
    }
  };

  return { locale, t, setLocale: setLocaleAndPersist } as const;
}
