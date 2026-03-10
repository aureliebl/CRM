"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const accessRes = await fetch("/api/security/access", { cache: "no-store" });
      if (accessRes.ok) {
        const access = (await accessRes.json()) as {
          enabled: boolean;
          allowed: boolean;
          clientIp: string;
        };
        if (access.enabled && !access.allowed) {
          setError(`Accès refusé depuis l'IP ${access.clientIp}`);
          return;
        }
      }
    } catch {
      // ignore transient check failure for now
    }

    const loginRes = await fetch("/api/auth/password-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!loginRes.ok) {
      const body = (await loginRes.json().catch(() => null)) as { error?: string } | null;
      if (loginRes.status === 401) {
        setError("Email ou mot de passe incorrect");
        return;
      }
      setError(body?.error || "Impossible de se connecter pour le moment");
      return;
    }

    const payload = (await loginRes.json()) as {
      user?: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        fullName: string;
        role: "admin" | "operator";
        profileImage?: string;
      };
    };

    if (!payload.user) {
      setError("Erreur de session, veuillez réessayer");
      return;
    }
    router.push("/dashboard");
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetMessage("");

    const res = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Impossible d'envoyer la demande de réinitialisation");
      return;
    }

    setResetMessage("Si cet email existe, un lien de réinitialisation vient d'être envoyé.");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary, #050816)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--modal-bg, rgba(15,23,42,0.98))",
          borderRadius: "1rem",
          padding: "2rem",
          border: "1px solid var(--border-color, rgba(148,163,184,0.4))",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            marginBottom: "0.5rem",
            color: "var(--text-primary, #e5e7eb)",
            textAlign: "center",
          }}
        >
          Admin CostOP
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-secondary, #9ca3af)",
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          Connexion sécurisée
        </p>

        {!resetMode ? (
          <form onSubmit={handleSubmitCredentials}>
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary, #9ca3af)",
                  marginBottom: "0.35rem",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-color, rgba(148,163,184,0.4))",
                  background: "var(--input-bg, rgba(15,23,42,0.9))",
                  color: "var(--text-primary, #e5e7eb)",
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
                  color: "var(--text-secondary, #9ca3af)",
                  marginBottom: "0.35rem",
                }}
              >
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-color, rgba(148,163,184,0.4))",
                  background: "var(--input-bg, rgba(15,23,42,0.9))",
                  color: "var(--text-primary, #e5e7eb)",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>
            {error && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  background: "rgba(239,68,68,0.1)",
                  color: "#ef4444",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "999px",
                border: "none",
                background:
                  "linear-gradient(120deg, rgba(30,64,175,0.9), rgba(79,70,229,0.9))",
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => {
                setResetMode(true);
                setResetEmail(email);
                setError("");
                setResetMessage("");
              }}
              style={{
                width: "100%",
                padding: "0.5rem",
                marginTop: "0.5rem",
                borderRadius: "999px",
                border: "1px solid var(--border-color, rgba(148,163,184,0.4))",
                background: "transparent",
                color: "var(--text-secondary, #9ca3af)",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Mot de passe oublié ?
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestReset}>
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary, #9ca3af)",
                  marginBottom: "0.35rem",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                placeholder="you@company.com"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-color, rgba(148,163,184,0.4))",
                  background: "var(--input-bg, rgba(15,23,42,0.9))",
                  color: "var(--text-primary, #e5e7eb)",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>

            {resetMessage && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  background: "rgba(16,185,129,0.12)",
                  color: "#10b981",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                {resetMessage}
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  background: "rgba(239,68,68,0.1)",
                  color: "#ef4444",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "999px",
                border: "none",
                background:
                  "linear-gradient(120deg, rgba(30,64,175,0.9), rgba(79,70,229,0.9))",
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              Envoyer le lien de réinitialisation
            </button>
            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setError("");
                setResetMessage("");
              }}
              style={{
                width: "100%",
                padding: "0.5rem",
                marginTop: "0.5rem",
                borderRadius: "999px",
                border: "1px solid var(--border-color, rgba(148,163,184,0.4))",
                background: "transparent",
                color: "var(--text-secondary, #9ca3af)",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Retour
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
