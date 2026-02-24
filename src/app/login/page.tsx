"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, verifyTOTP, getCurrentUser } from "@/lib/mock/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
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

    const user = login(email, password);
    if (!user) {
      setError("Email ou mot de passe incorrect");
      return;
    }
    if (user.totpEnabled) {
      setStep("totp");
    } else {
      router.push("/dashboard");
    }
  };

  const handleSubmitTOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const user = getCurrentUser();
    if (!user || !user.totpSecret) {
      setError("Erreur d'authentification");
      return;
    }
    if (verifyTOTP(user.totpSecret, totpCode)) {
      router.push("/dashboard");
    } else {
      setError("Code TOTP incorrect");
    }
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
          Admin Costockage
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-secondary, #9ca3af)",
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          Connexion sécurisée avec authentification à deux facteurs
        </p>

        {step === "credentials" ? (
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
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary, #9ca3af)",
                marginTop: "1rem",
                textAlign: "center",
              }}
            >
              Comptes de test : admin@costockage.fr / theo.admin@costockage.fr / paul.sales@costockage.fr / camille.support@costockage.fr
              <br />
              Mot de passe : demo123
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmitTOTP}>
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary, #9ca3af)",
                  marginBottom: "0.35rem",
                }}
              >
                Code d&apos;authentification (TOTP)
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                placeholder="123456"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-color, rgba(148,163,184,0.4))",
                  background: "var(--input-bg, rgba(15,23,42,0.9))",
                  color: "var(--text-primary, #e5e7eb)",
                  fontSize: "1.2rem",
                  textAlign: "center",
                  letterSpacing: "0.2em",
                  outline: "none",
                }}
              />
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary, #9ca3af)",
                  marginTop: "0.5rem",
                  textAlign: "center",
                }}
              >
                Utilisez votre application d&apos;authentification (Google Authenticator, etc.)
                <br />
                Code de test : 123456
              </p>
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
              Vérifier le code
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setTotpCode("");
                setError("");
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
