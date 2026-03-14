"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function InvitationAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const verify = async () => {
      try {
        const res = await fetch(`/api/invitations/verify/${token}`, { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "This invitation link is invalid or has expired.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setEmail(data.email);
        setLoading(false);
      } catch {
        setError("Failed to verify invitation.");
        setLoading(false);
      }
    };
    verify();
  }, [token]);

  const passwordStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  };

  const strengthLabel = () => {
    const s = passwordStrength();
    if (s <= 1) return { text: "Faible", color: "#ef4444" };
    if (s <= 2) return { text: "Moyen", color: "#eab308" };
    if (s <= 3) return { text: "Bon", color: "#22c55e" };
    return { text: "Excellent", color: "#22c55e" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError("Le nom est requis.");
      return;
    }

    if (password.length < 8) {
      setSubmitError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setSubmitError("Le mot de passe doit contenir au moins une majuscule.");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setSubmitError("Le mot de passe doit contenir au moins un chiffre.");
      return;
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      setSubmitError("Le mot de passe doit contenir au moins un caractère spécial.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/invitations/accept/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || "Une erreur est survenue.");
        setSubmitting(false);
        return;
      }

      // Success — redirect to app
      router.push("/dashboard");
    } catch {
      setSubmitError("Une erreur est survenue.");
      setSubmitting(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-primary, #0a0a0f)",
    padding: "2rem",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--modal-bg, #1a1a2e)",
    borderRadius: "1rem",
    border: "1px solid var(--border-color, #2a2a3e)",
    padding: "2rem",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid var(--border-color, #2a2a3e)",
    background: "var(--input-bg, #12121f)",
    color: "var(--text-primary, #fff)",
    fontSize: "0.875rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    color: "var(--text-secondary, #888)",
    marginBottom: 4,
    fontWeight: 500,
  };

  const btnStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid rgba(129, 140, 248, 0.8)",
    background: "linear-gradient(120deg, rgba(30, 64, 175, 0.9), rgba(79, 70, 229, 0.9))",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ textAlign: "center", color: "var(--text-secondary, #888)" }}>
            Vérification du lien d&apos;invitation…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ color: "var(--text-primary, #fff)", fontSize: "1.2rem", marginBottom: "1rem" }}>
            Invitation invalide
          </h2>
          <p style={{ color: "var(--text-secondary, #888)", marginBottom: "1.5rem" }}>
            {error}
          </p>
          <a
            href="/login"
            style={{
              ...btnStyle,
              display: "block",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Retour à la connexion
          </a>
        </div>
      </div>
    );
  }

  const strength = strengthLabel();

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2
          style={{
            color: "var(--text-primary, #fff)",
            fontSize: "1.3rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
          }}
        >
          Créer votre compte
        </h2>
        <p style={{ color: "var(--text-secondary, #888)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
          Complétez les informations ci-dessous pour finaliser votre inscription.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Email</label>
            <input
              style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
              value={email}
              disabled
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Nom complet *</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              required
            />
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <label style={labelStyle}>Mot de passe *</label>
            <input
              type="password"
              style={inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 caractères, 1 majuscule, 1 chiffre, 1 spécial"
              required
            />
          </div>

          {password.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  marginBottom: 4,
                }}
              >
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      background:
                        i <= passwordStrength()
                          ? strength.color
                          : "var(--border-color, #2a2a3e)",
                      transition: "background 0.2s",
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: "0.7rem", color: strength.color }}>
                {strength.text}
              </span>
            </div>
          )}

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Confirmer le mot de passe *</label>
            <input
              type="password"
              style={inputStyle}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Retapez votre mot de passe"
              required
            />
          </div>

          {submitError && (
            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              {submitError}
            </div>
          )}

          <button
            type="submit"
            style={{
              ...btnStyle,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
            disabled={submitting}
          >
            {submitting ? "Création en cours…" : "Créer mon compte"}
          </button>
        </form>
      </div>
    </div>
  );
}
