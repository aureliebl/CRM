"use client";

import { useTheme } from "@/lib/theme-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/use-locale";
import { AsyncButton } from "@/components/admin/AsyncButton";

type LocalUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "operator";
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
  totpEnabled?: number;
  updatedAt?: string | null;
};

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const router = useRouter();
  const { t, locale } = useLocale();
  const labels =
    locale === "fr"
      ? {
          firstName: "Prénom",
          lastName: "Nom",
          saveAccount: "Enregistrer les informations",
          accountSaved: "Informations du compte enregistrées",
          passwordTitle: "Mot de passe",
          currentPassword: "Mot de passe actuel",
          newPassword: "Nouveau mot de passe",
          confirmPassword: "Confirmer le nouveau mot de passe",
          savePassword: "Changer le mot de passe",
          passwordSaved: "Mot de passe modifié",
          passwordSaveError: "Erreur lors de la modification du mot de passe",
          passwordMismatch: "Les mots de passe ne correspondent pas",
          passwordMinLength: "Le mot de passe doit contenir au moins 8 caractères",
          imageSaveError: "Erreur lors de l'enregistrement de l'image",
          imageTooLarge:
            "Image trop volumineuse. Choisis une image plus légère (max 2 Mo) ou recadre-la.",
          imageReadError: "Impossible de lire l'image sélectionnée",
          accountSaveError: "Erreur lors de l'enregistrement du compte",
          connectedAs: "Connecté en tant que",
        }
      : {
          firstName: "First name",
          lastName: "Last name",
          saveAccount: "Save account details",
          accountSaved: "Account information saved",
          passwordTitle: "Password",
          currentPassword: "Current password",
          newPassword: "New password",
          confirmPassword: "Confirm new password",
          savePassword: "Change password",
          passwordSaved: "Password changed",
          passwordSaveError: "Failed to change password",
          passwordMismatch: "Passwords do not match",
          passwordMinLength: "Password must be at least 8 characters",
          imageSaveError: "Failed to save profile image",
          imageTooLarge:
            "Image too large. Please choose a lighter file (max 2 MB) or crop it first.",
          imageReadError: "Unable to read selected image",
          accountSaveError: "Failed to save account information",
          connectedAs: "Connected as",
        };
  const initialFirstName = user?.firstName ?? user?.fullName?.split(/\s+/)[0] ?? "";
  const initialLastName =
    user?.lastName ??
    (() => {
      const parts = (user?.fullName ?? "").trim().split(/\s+/);
      parts.shift();
      return parts.join(" ");
    })();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(user?.email ?? "");

  const [preview, setPreview] = useState<string | null>(
    user?.profileImage ?? null
  );
  const [savingImage, setSavingImage] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [imageSaved, setImageSaved] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUser = async () => {
    try {
      const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
      if (!sessionRes.ok) {
        setUser(null);
        return;
      }

      const sessionPayload = (await sessionRes.json()) as {
        authenticated?: boolean;
        user?: {
          id: string;
          email: string;
          fullName: string;
          role: "admin" | "operator";
        };
      };

      if (!sessionPayload.authenticated || !sessionPayload.user) {
        setUser(null);
        return;
      }

      const sessionUser = sessionPayload.user;
      const accountRes = await fetch(`/api/accounts/${encodeURIComponent(sessionUser.id)}`, {
        cache: "no-store",
      });

      if (!accountRes.ok) {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email,
          fullName: sessionUser.fullName,
          role: sessionUser.role,
          totpEnabled: 0,
        });
        return;
      }

      const account = (await accountRes.json()) as LocalUser;
      setUser(account);
    } finally {
      setAuthResolved(true);
    }
  };

  const persistAccount = async (patch: Partial<LocalUser>) => {
    if (!user) return null;

    const res = await fetch(`/api/accounts/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, expectedUpdatedAt: user.updatedAt ?? undefined }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const apiError =
        typeof body?.error === "string" && body.error.trim().length > 0
          ? body.error.trim()
          : "SAVE_FAILED";
      throw new Error(`${apiError}|HTTP_${res.status}`);
    }

    const row = (await res.json()) as LocalUser;
    const synced: LocalUser = {
      id: row.id ?? user.id,
      email: row.email ?? user.email,
      firstName: row.firstName ?? user.firstName,
      lastName: row.lastName ?? user.lastName,
      fullName:
        `${row.firstName ?? user.firstName ?? ""} ${row.lastName ?? user.lastName ?? ""}`.trim() ||
        row.fullName ||
        user.fullName,
      role: row.role ?? user.role,
      profileImage: row.profileImage ?? undefined,
      totpEnabled: row.totpEnabled ?? user.totpEnabled ?? 0,
      updatedAt: row.updatedAt ?? user.updatedAt,
    };

    setUser(synced);
    window.dispatchEvent(new Event("user:update"));
    return synced;
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("FILE_READ_ERROR"));
      reader.readAsDataURL(file);
    });

  const compressImageToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const source = String(reader.result ?? "");
        if (!source) {
          reject(new Error("FILE_READ_ERROR"));
          return;
        }

        const img = new Image();
        img.onload = () => {
          const maxSide = 512;
          const ratio = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
          const width = Math.max(1, Math.round((img.width || 1) * ratio));
          const height = Math.max(1, Math.round((img.height || 1) * ratio));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("CANVAS_CONTEXT_ERROR"));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error("IMAGE_PARSE_ERROR"));
        img.src = source;
      };
      reader.onerror = () => reject(new Error("FILE_READ_ERROR"));
      reader.readAsDataURL(file);
    });

  const handleFile = async (file?: File) => {
    if (!file) return;
    setErrorMessage(null);

    try {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage(labels.imageTooLarge);
        return;
      }

      let nextPreview = await readFileAsDataUrl(file);
      if (file.size > 500 * 1024) {
        nextPreview = await compressImageToDataUrl(file);
      }

      if (nextPreview.length > 1_200_000) {
        setErrorMessage(labels.imageTooLarge);
        return;
      }

      setPreview(nextPreview);
    } catch (error) {
      console.error(error);
      setErrorMessage(labels.imageReadError);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSavingImage(true);
    setErrorMessage(null);
    try {
      const updatedUser = await persistAccount({ profileImage: preview });
      if (!updatedUser) {
        throw new Error("USER_UPDATE_FAILED");
      }
      setPreview(updatedUser.profileImage ?? null);
      setSavingImage(false);
      setImageSaved(true);
      setTimeout(() => setImageSaved(false), 900);
      setToast(t.save_image ?? "Image de profil enregistrée");
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error(err);
      setSavingImage(false);
      const message =
        err instanceof Error && /413|PAYLOAD|TOO_LARGE/i.test(err.message)
          ? labels.imageTooLarge
          : labels.imageSaveError;
      setErrorMessage(message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network issues on logout
    }
    router.push("/login");
  };

  const handleSaveAccount = async () => {
    if (!user) return;
    setSavingAccount(true);
    setErrorMessage(null);
    try {
      const updatedUser = await persistAccount({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName} ${lastName}`.trim(),
        email: email.trim(),
      });
      if (!updatedUser) {
        throw new Error("USER_UPDATE_FAILED");
      }
      setSavingAccount(false);
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 900);
      setToast(labels.accountSaved);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error(err);
      setSavingAccount(false);
      setErrorMessage(labels.accountSaveError);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      setErrorMessage(labels.passwordMismatch);
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(labels.passwordMinLength);
      return;
    }

    setSavingPassword(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "PASSWORD_CHANGE_FAILED");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 900);
      setToast(labels.passwordSaved);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error && err.message ? err.message : labels.passwordSaveError
      );
    } finally {
      setSavingPassword(false);
    }
  };

  useEffect(() => {
    void loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    const nextFirstName = user.firstName ?? user.fullName.split(/\s+/)[0] ?? "";
    const parts = user.fullName.split(/\s+/);
    parts.shift();
    const nextLastName = user.lastName ?? parts.join(" ");
    setFirstName(nextFirstName);
    setLastName(nextLastName);
    setEmail(user.email ?? "");
  }, [user]);

  useEffect(() => {
    const handler = () => {
      void loadUser();
    };
    window.addEventListener("user:update", handler);
    return () => window.removeEventListener("user:update", handler);
  }, []);

  if (!authResolved) {
    return <section className="admin-placeholder-card">Loading...</section>;
  }

  if (!user) {
    return <section className="admin-placeholder-card">Not authenticated.</section>;
  }

  return (
    <div>
      <h1 className="admin-page-title">{t.settings_title}</h1>
      <p className="admin-page-description">{t.settings_description}</p>
      {toast && (
        <div style={{ marginBottom: "0.75rem", fontSize: "0.85rem", color: "var(--success-text)" }}>
          {toast}
        </div>
      )}
      {errorMessage && (
        <div style={{ marginBottom: "0.75rem", fontSize: "0.85rem", color: "var(--error-text)" }}>
          {errorMessage}
        </div>
      )}

      <section className="admin-placeholder-card">
        <div className="admin-placeholder-title">{t.profile_image}</div>
        {user && (
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
            }}
          >
            <div style={{ width: 80, height: 80, borderRadius: 999, overflow: "hidden", background: "var(--bg-hover)", flexShrink: 0 }}>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Prévisualisation" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "2rem", fontWeight: "bold" }}>
                  {user.fullName.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <AsyncButton
                  type="button"
                  onClick={handleSave}
                  disabled={!preview}
                  isLoading={savingImage}
                  isSuccess={imageSaved}
                  loadingLabel={t.saving}
                  successLabel={t.save_image}
                  minWidth={170}
                >
                  {t.save_image}
                </AsyncButton>
                <button
                  type="button"
                  onClick={() => setPreview(user?.profileImage ?? null)}
                  style={{
                    padding: "0.45rem 0.8rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="admin-placeholder-card" style={{ marginTop: "1rem" }}>
        <div className="admin-placeholder-title">{t.appearance_title}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1rem",
          }}
        >
          <div>
            <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>
              {t.theme_toggle_description}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary, #9ca3af)",
              }}
            >
              {t.theme_toggle_description}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "999px",
              border: "1px solid var(--border-color, rgba(148,163,184,0.4))",
              background:
                theme === "dark"
                  ? "linear-gradient(120deg, rgba(30,64,175,0.9), rgba(79,70,229,0.9))"
                  : "var(--button-bg, rgba(15,23,42,0.98))",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            {theme === "dark" ? `🌙 ${t.theme_dark}` : `☀️ ${t.theme_light}`}
          </button>
        </div>
      </section>

      <section className="admin-placeholder-card" style={{ marginTop: "1rem" }}>
        <div className="admin-placeholder-title">{t.account_title}</div>
        {user && (
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                {labels.firstName}
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    padding: "0.45rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                {labels.lastName}
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    padding: "0.45rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    padding: "0.45rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                  }}
                />
              </label>
            </div>
            <div>
              <AsyncButton
                type="button"
                onClick={handleSaveAccount}
                isLoading={savingAccount}
                isSuccess={accountSaved}
                loadingLabel={t.saving}
                successLabel={labels.saveAccount}
                minWidth={230}
              >
                {labels.saveAccount}
              </AsyncButton>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary, #9ca3af)",
                  marginBottom: "0.25rem",
                }}
              >
                {t.user_connected}
              </div>
              <div style={{ fontWeight: 500 }}>{user.fullName}</div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary, #9ca3af)",
                }}
              >
                {user.email} · {user.role}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary, #9ca3af)",
                  marginBottom: "0.25rem",
                }}
              >
                {t.two_factor}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: user.totpEnabled ? "#10b981" : "#9ca3af",
                }}
              >
                {user.totpEnabled ? t.two_factor_enabled : t.two_factor_disabled}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                marginTop: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "999px",
                border: "1px solid rgba(239,68,68,0.4)",
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              {t.logout}
            </button>
          </div>
        )}
      </section>

      <section className="admin-placeholder-card" style={{ marginTop: "1rem" }}>
        <div className="admin-placeholder-title">{labels.passwordTitle}</div>
        <div
          style={{
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            {labels.currentPassword}
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                padding: "0.45rem",
                borderRadius: "0.4rem",
                fontSize: "0.85rem",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            {labels.newPassword}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                padding: "0.45rem",
                borderRadius: "0.4rem",
                fontSize: "0.85rem",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            {labels.confirmPassword}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                padding: "0.45rem",
                borderRadius: "0.4rem",
                fontSize: "0.85rem",
              }}
            />
          </label>
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <AsyncButton
            type="button"
            onClick={handleChangePassword}
            isLoading={savingPassword}
            isSuccess={passwordSaved}
            loadingLabel={t.saving}
            successLabel={labels.savePassword}
            minWidth={220}
          >
            {labels.savePassword}
          </AsyncButton>
        </div>
      </section>
    </div>
  );
}
