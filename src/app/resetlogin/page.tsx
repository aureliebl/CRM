"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetLoginPage() {
  const searchParams = useSearchParams();
  const initialToken = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token.trim()) {
      setError("Reset token is required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Unable to reset password.");
        return;
      }

      setSuccess("Password updated successfully. You can now sign in on the login page.");
      setPassword("");
      setConfirmPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: 520, margin: "2.5rem auto", padding: "0 1rem" }}>
      <section className="admin-placeholder-card">
        <h1 className="admin-page-title" style={{ marginTop: 0 }}>Reset password</h1>
        <p className="admin-page-description">Use the token from your email to set a new password.</p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.7rem", marginTop: "0.9rem" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Reset token</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              style={{
                padding: "0.45rem 0.65rem",
                borderRadius: "0.45rem",
                border: "1px solid var(--border-color)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{
                padding: "0.45rem 0.65rem",
                borderRadius: "0.45rem",
                border: "1px solid var(--border-color)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={{
                padding: "0.45rem 0.65rem",
                borderRadius: "0.45rem",
                border: "1px solid var(--border-color)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: "0.3rem",
              padding: "0.52rem 0.8rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border-color)",
              background: "var(--button-bg)",
              color: "var(--text-primary)",
              cursor: isSubmitting ? "default" : "pointer",
              opacity: isSubmitting ? 0.75 : 1,
            }}
          >
            {isSubmitting ? "Updating..." : "Update password"}
          </button>

          {error && <p style={{ color: "var(--error-text)", margin: 0 }}>{error}</p>}
          {success && <p style={{ color: "var(--text-secondary)", margin: 0 }}>{success}</p>}
        </form>
      </section>
    </main>
  );
}
