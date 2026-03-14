"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { AsyncButton } from "@/components/admin/AsyncButton";
import { useLocale } from "@/lib/use-locale";

/* ─── Types ─── */

interface VaultListItem {
  id: string;
  serviceName: string;
  serviceUrl: string | null;
  loginMasked: string;
  groupIds: string[];
  hasTotp: boolean;
  adminOnly: boolean;
  passwordOwnerOnly: boolean;
  createdAt: string;
}

interface VaultEntry {
  id: string;
  serviceName: string;
  serviceUrl: string | null;
  login: string;
  password: string;
  notes: string | null;
  groupIds: string[];
  hasTotp: boolean;
  adminOnly: boolean;
  passwordOwnerOnly: boolean;
  canViewPassword: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VaultTotpItem {
  id: string;
  vaultEntryId: string;
  label: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
  createdAt: string;
}

interface BackupCode {
  id: string;
  code: string;
  used: boolean;
  usedAt: string | null;
}

interface UserGroup {
  id: string;
  name: string;
}

interface SessionActor {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isSuperAdmin?: boolean;
}

type ModalView = "detail" | "create" | "edit" | "add-totp" | "backup-codes" | "export-confirm";

/* ─── i18n labels ─── */

const labels = {
  fr: {
    title: "Coffre-fort",
    description: "Gestionnaire de mots de passe sécurisé",
    search: "Rechercher un service, login ou groupe…",
    allGroups: "Tous les groupes",
    addEntry: "Ajouter",
    noEntries: "Aucun credential enregistré",
    noResults: "Aucun résultat",
    service: "Service",
    url: "URL",
    login: "Identifiant",
    password: "Mot de passe",
    notes: "Notes",
    groups: "Groupes autorisés",
    adminOnly: "Admin only",
    ownerOnlyPassword: "Mot de passe visible uniquement par le créateur",
    totp: "TOTP",
    copied: "Copié !",
    copy: "Copier",
    show: "Afficher",
    hide: "Masquer",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    create: "Créer",
    generatePwd: "Générer",
    addTotp: "Ajouter un TOTP",
    totpSecret: "Secret TOTP (Base32)",
    totpLabel: "Label",
    scanQr: "Scanner un QR code",
    manualEntry: "Saisie manuelle",
    verify: "Vérifier",
    verifyCode: "Entrez le code affiché pour vérifier",
    backupCodes: "Codes de secours",
    backupCodesWarning: "Ces codes ne seront affichés qu'une seule fois. Sauvegardez-les !",
    downloadBackup: "Télécharger",
    used: "Utilisé",
    available: "Disponible",
    exportAll: "Exporter tout",
    exportConfirm: "Vous allez exporter tous les secrets en clair. Continuer ?",
    exportJson: "Export JSON",
    exportCsv: "Export CSV",
    deleteConfirm: "Supprimer définitivement ce credential et tous ses TOTP ?",
    requiredField: "Champ requis",
    selectGroups: "Sélectionnez au moins un groupe",
    autoShareInfo: "Partage automatique: votre groupe + admins/super-admins",
    saveFailed: "Échec de l'enregistrement",
    passwordHiddenByPolicy: "Mot de passe masqué (visible uniquement par le créateur).",
    totpOptionalAtSave: "Secret TOTP (optionnel à la création)",
    totpConfigured: "TOTP configuré",
    createdAt: "Créé le",
    updatedAt: "Modifié le",
    seconds: "s",
    sectionShared: "Mots de passe partagés",
    sectionPersonal: "Mes mots de passe personnels",
  },
  en: {
    title: "Vault",
    description: "Secure password manager",
    search: "Search service, login, or group…",
    allGroups: "All groups",
    addEntry: "Add",
    noEntries: "No credentials stored",
    noResults: "No results",
    service: "Service",
    url: "URL",
    login: "Login",
    password: "Password",
    notes: "Notes",
    groups: "Authorized groups",
    adminOnly: "Admin only",
    ownerOnlyPassword: "Password visible only to creator",
    totp: "TOTP",
    copied: "Copied!",
    copy: "Copy",
    show: "Show",
    hide: "Hide",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    create: "Create",
    generatePwd: "Generate",
    addTotp: "Add TOTP",
    totpSecret: "TOTP secret (Base32)",
    totpLabel: "Label",
    scanQr: "Scan QR code",
    manualEntry: "Manual entry",
    verify: "Verify",
    verifyCode: "Enter the displayed code to verify",
    backupCodes: "Backup codes",
    backupCodesWarning: "These codes will only be shown once. Save them!",
    downloadBackup: "Download",
    used: "Used",
    available: "Available",
    exportAll: "Export all",
    exportConfirm: "You are about to export all secrets in plain text. Continue?",
    exportJson: "Export JSON",
    exportCsv: "Export CSV",
    deleteConfirm: "Permanently delete this credential and all its TOTP?",
    requiredField: "Required",
    selectGroups: "Select at least one group",
    autoShareInfo: "Auto-shared: your group + admins/super-admins",
    saveFailed: "Save failed",
    passwordHiddenByPolicy: "Password hidden (visible only to creator).",
    totpOptionalAtSave: "TOTP secret (optional on save)",
    totpConfigured: "TOTP configured",
    createdAt: "Created",
    updatedAt: "Modified",
    seconds: "s",
    sectionShared: "Shared passwords",
    sectionPersonal: "My personal passwords",
  },
};

/* ─── TOTP generator (pure client-side) ─── */

function base32Decode(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/[= ]/g, "").toUpperCase();
  let bits = "";
  for (const c of clean) {
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, message.buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

async function generateTotpCode(secret: string, period = 30, digits = 6): Promise<string> {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / period);
  const counterBuf = new Uint8Array(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  const hmac = await hmacSha1(key, counterBuf);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, "0");
}

function getTotpRemaining(period = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}

/* ─── Countdown circle SVG ─── */

function TotpCountdown({ remaining, period }: { remaining: number; period: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / period;
  const offset = circumference * (1 - progress);
  const color = remaining <= 5 ? "var(--color-error, #dc2626)" : "var(--accent-primary, #6366f1)";

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--border-color, #333)" strokeWidth="3" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
        style={{ transition: "stroke-dashoffset 0.3s linear" }}
      />
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central" fill="var(--text-primary)" fontSize="11" fontWeight="600">
        {remaining}
      </text>
    </svg>
  );
}

/* ─── Main page ─── */

export default function VaultPage() {
  const { locale } = useLocale();
  const t = labels[locale] || labels.fr;

  const [actor, setActor] = useState<SessionActor | null>(null);
  const [entries, setEntries] = useState<VaultListItem[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("");

  // Modal state
  const [modalView, setModalView] = useState<ModalView | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null);
  const [selectedTotps, setSelectedTotps] = useState<VaultTotpItem[]>([]);
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [totpRemaining, setTotpRemaining] = useState(30);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form state
  const [formServiceName, setFormServiceName] = useState("");
  const [formServiceUrl, setFormServiceUrl] = useState("");
  const [formLogin, setFormLogin] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formGroupIds, setFormGroupIds] = useState<string[]>([]);
  const [formAdminOnly, setFormAdminOnly] = useState(false);
  const [formPasswordOwnerOnly, setFormPasswordOwnerOnly] = useState(false);
  const [formTotpSecret, setFormTotpSecret] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // TOTP add state
  const [totpMode, setTotpMode] = useState<"manual" | "scan">("manual");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpLabel, setTotpLabel] = useState("");
  const [totpVerifyStep, setTotpVerifyStep] = useState(false);
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpExpectedCode, setTotpExpectedCode] = useState("");
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  // Backup codes view state
  const [viewBackupCodes, setViewBackupCodes] = useState<BackupCode[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_backupTotpId, setViewBackupTotpId] = useState("");

  // QR scanner
  const qrScannerRef = useRef<{
    stop: () => Promise<unknown>;
    clear?: () => Promise<unknown> | void;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerActiveRef = useRef(false);

  const isAdmin = actor?.role === "admin";
  const isSuperAdmin = actor?.isSuperAdmin === true;
  const canManageGroupSelection = isAdmin || isSuperAdmin;

  /* ─── Data loading ─── */

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.authenticated && data.user) setActor(data.user);
    } catch { /* ignore */ }
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/vault");
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/security/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (actor) {
      loadEntries();
      loadGroups();
    }
  }, [actor, loadEntries, loadGroups]);

  /* ─── TOTP live codes ─── */

  useEffect(() => {
    if (selectedTotps.length === 0) return;
    let active = true;

    const tick = async () => {
      if (!active) return;
      const codes: Record<string, string> = {};
      for (const totp of selectedTotps) {
        try {
          codes[totp.id] = await generateTotpCode(totp.secret, totp.period, totp.digits);
        } catch {
          codes[totp.id] = "------";
        }
      }
      if (active) {
        setTotpCodes(codes);
        setTotpRemaining(getTotpRemaining(selectedTotps[0]?.period ?? 30));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedTotps]);

  /* ─── Clipboard ─── */

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch { /* ignore */ }
  }, []);

  /* ─── Open detail modal ─── */

  const openDetail = useCallback(async (entryId: string) => {
    try {
      const [entryRes, totpRes] = await Promise.all([
        fetch(`/api/vault/${entryId}`),
        fetch(`/api/vault/${entryId}/totp`),
      ]);
      if (entryRes.ok) {
        const entry = await entryRes.json();
        setSelectedEntry(entry);
        setModalView("detail");
      }
      if (totpRes.ok) {
        const totps = await totpRes.json();
        setSelectedTotps(totps);
      } else {
        setSelectedTotps([]);
      }
    } catch { /* ignore */ }
  }, []);

  /* ─── Close modal ─── */

  const stopQrScan = useCallback(async () => {
    scannerActiveRef.current = false;

    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;

    if (scanner) {
      try {
        await scanner.stop();
      } catch { /* ignore */ }
      try {
        if (scanner.clear) await scanner.clear();
      } catch { /* ignore */ }
    }

    const qrReaderEl = document.getElementById("qr-reader");
    if (qrReaderEl) qrReaderEl.innerHTML = "";

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    void stopQrScan();
    setModalView(null);
    setSelectedEntry(null);
    setSelectedTotps([]);
    setTotpCodes({});
    setNewBackupCodes(null);
    setTotpVerifyStep(false);
    setTotpSecret("");
    setTotpLabel("");
    setTotpVerifyCode("");
    setViewBackupCodes([]);
  }, [stopQrScan]);

  useEffect(() => {
    if (modalView !== "add-totp" || totpMode !== "scan") {
      void stopQrScan();
    }
  }, [modalView, totpMode, stopQrScan]);

  useEffect(() => {
    return () => {
      void stopQrScan();
    };
  }, [stopQrScan]);

  /* ─── Create / Edit ─── */

  const openCreate = useCallback(() => {
    setFormServiceName("");
    setFormServiceUrl("");
    setFormLogin("");
    setFormPassword("");
    setFormNotes("");
    setFormGroupIds([]);
    setFormAdminOnly(false);
    setFormPasswordOwnerOnly(false);
    setFormTotpSecret("");
    setSaveError(null);
    setModalView("create");
  }, []);

  const openEdit = useCallback(() => {
    if (!selectedEntry) return;
    setFormServiceName(selectedEntry.serviceName);
    setFormServiceUrl(selectedEntry.serviceUrl || "");
    setFormLogin(selectedEntry.login);
    setFormPassword(selectedEntry.password);
    setFormNotes(selectedEntry.notes || "");
    setFormGroupIds(selectedEntry.groupIds);
    setFormAdminOnly(selectedEntry.adminOnly === true);
    setFormPasswordOwnerOnly(selectedEntry.passwordOwnerOnly === true);
    setFormTotpSecret("");
    setSaveError(null);
    setModalView("edit");
  }, [selectedEntry]);

  const handleSave = useCallback(async () => {
    if (!formServiceName || !formLogin || !formPassword) return;
    setFormSaving(true);
    setSaveError(null);

    try {
      const body = {
        serviceName: formServiceName,
        serviceUrl: formServiceUrl || null,
        login: formLogin,
        password: formPassword,
        notes: formNotes || null,
        groupIds: formGroupIds,
        adminOnly: formAdminOnly,
        passwordOwnerOnly: formPasswordOwnerOnly,
      };

      if (modalView === "create") {
        const res = await fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          if (formTotpSecret.trim().length >= 16) {
            await fetch(`/api/vault/${created.id}/totp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                label: "TOTP principal",
                secret: formTotpSecret.trim().replace(/\s/g, "").toUpperCase(),
              }),
            });
          }
          await loadEntries();
          closeModal();
        } else {
          const data = await res.json().catch(() => ({}));
          setSaveError(data?.error || t.saveFailed);
        }
      } else if (modalView === "edit" && selectedEntry) {
        const res = await fetch(`/api/vault/${selectedEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          if (formTotpSecret.trim().length >= 16) {
            await fetch(`/api/vault/${selectedEntry.id}/totp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                label: "TOTP principal",
                secret: formTotpSecret.trim().replace(/\s/g, "").toUpperCase(),
              }),
            });
          }
          setSelectedEntry(updated);
          setModalView("detail");
          await loadEntries();
        } else {
          const data = await res.json().catch(() => ({}));
          setSaveError(data?.error || t.saveFailed);
        }
      }
    } catch {
      setSaveError(t.saveFailed);
    }
    setFormSaving(false);
  }, [modalView, selectedEntry, formServiceName, formServiceUrl, formLogin, formPassword, formNotes, formGroupIds, formAdminOnly, formPasswordOwnerOnly, formTotpSecret, loadEntries, closeModal, t.saveFailed]);

  const handleDelete = useCallback(async () => {
    if (!selectedEntry) return;
    if (!confirm(t.deleteConfirm)) return;
    try {
      await fetch(`/api/vault/${selectedEntry.id}`, { method: "DELETE" });
      await loadEntries();
      closeModal();
    } catch { /* ignore */ }
  }, [selectedEntry, loadEntries, closeModal, t.deleteConfirm]);

  const generatePassword = useCallback(() => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    let result = "";
    for (let i = 0; i < 20; i++) result += chars[array[i] % chars.length];
    setFormPassword(result);
  }, []);

  /* ─── TOTP add flow ─── */

  const startAddTotp = useCallback(() => {
    setTotpMode("manual");
    setTotpSecret("");
    setTotpLabel("");
    setTotpVerifyStep(false);
    setTotpVerifyCode("");
    setTotpExpectedCode("");
    setNewBackupCodes(null);
    setModalView("add-totp");
  }, []);

  const handleTotpVerify = useCallback(async () => {
    if (!totpSecret || totpSecret.length < 16) return;
    try {
      const code = await generateTotpCode(totpSecret.replace(/\s/g, "").toUpperCase());
      setTotpExpectedCode(code);
      setTotpVerifyStep(true);
    } catch { /* ignore */ }
  }, [totpSecret]);

  const handleTotpConfirm = useCallback(async () => {
    if (totpVerifyCode !== totpExpectedCode) return;
    if (!selectedEntry) return;

    try {
      const res = await fetch(`/api/vault/${selectedEntry.id}/totp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: totpLabel || "TOTP principal",
          secret: totpSecret.replace(/\s/g, "").toUpperCase(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewBackupCodes(data.backupCodes);
        // Reload totps
        const totpRes = await fetch(`/api/vault/${selectedEntry.id}/totp`);
        if (totpRes.ok) setSelectedTotps(await totpRes.json());
        await loadEntries();
      }
    } catch { /* ignore */ }
  }, [totpVerifyCode, totpExpectedCode, selectedEntry, totpLabel, totpSecret, loadEntries]);

  /* ─── Backup codes view ─── */

  const openBackupCodes = useCallback(async (totpId: string) => {
    if (!selectedEntry) return;
    setViewBackupTotpId(totpId);
    try {
      const res = await fetch(`/api/vault/${selectedEntry.id}/totp/${totpId}/backup-codes`);
      if (res.ok) {
        setViewBackupCodes(await res.json());
        setModalView("backup-codes");
      }
    } catch { /* ignore */ }
  }, [selectedEntry]);

  /* ─── QR Scanner (basic using html5-qrcode) ─── */

  const startQrScan = useCallback(async () => {
    await stopQrScan();
    setTotpMode("scan");
    scannerActiveRef.current = true;

    try {
      // Dynamic import of html5-qrcode
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      qrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (!scannerActiveRef.current) return;
          // Parse otpauth:// URI
          try {
            const url = new URL(decodedText);
            if (url.protocol === "otpauth:") {
              const secret = url.searchParams.get("secret") || "";
              const label = decodeURIComponent(url.pathname.replace(/^\/\/totp\//, ""));
              setTotpSecret(secret);
              setTotpLabel(label || "");
            }
          } catch {
            // Maybe it's just a base32 secret
            setTotpSecret(decodedText);
          }
          void stopQrScan();
          setTotpMode("manual");
        },
        () => {} // ignore scan errors
      );
    } catch {
      void stopQrScan();
      setTotpMode("manual");
    }
  }, [stopQrScan]);

  /* ─── Export ─── */

  const handleExport = useCallback(async (format: "json" | "csv") => {
    try {
      const res = await fetch(`/api/vault/export?format=${format}`);
      if (!res.ok) return;

      if (format === "csv") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vault-export-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vault-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      closeModal();
    } catch { /* ignore */ }
  }, [closeModal]);

  /* ─── Filter logic ─── */

  const groupNameMap: Record<string, string> = {};
  for (const g of groups) groupNameMap[g.id] = g.name;

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.serviceName.toLowerCase().includes(q) ||
      e.loginMasked.toLowerCase().includes(q) ||
      e.groupIds.some((gid) => (groupNameMap[gid] || "").toLowerCase().includes(q));
    const matchGroup = !filterGroup || e.groupIds.includes(filterGroup);
    return matchSearch && matchGroup;
  });

  const filteredShared = filtered.filter((e) => !e.passwordOwnerOnly);
  const filteredPersonal = filtered.filter((e) => e.passwordOwnerOnly);

  /* ─── Render helpers ─── */

  const [showPwd, setShowPwd] = useState(false);

  if (!actor) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        <MaterialSymbol name="hourglass_empty" size={32} />
      </div>
    );
  }

  /* ─── Card/List rendering ─── */

  const renderEntryCard = (entry: VaultListItem) => (
    <div
      key={entry.id}
      onClick={() => openDetail(entry.id)}
      className="ui-hover-premium"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        background: "var(--card-bg, #1e1e2e)",
        border: "1px solid var(--border-color, #333)",
        borderRadius: 10,
        cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 10,
          background: "var(--surface-secondary, #2a2a3d)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MaterialSymbol name="lock" size={20} style={{ color: "var(--accent-primary, #6366f1)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.serviceName}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {entry.loginMasked}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {entry.groupIds.map((gid) => (
          <span
            key={gid}
            style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 12,
              background: "var(--badge-blue-bg, #dbeafe)",
              color: "var(--badge-blue-text, #1e40af)",
              fontWeight: 600,
            }}
          >
            {groupNameMap[gid] || gid}
          </span>
        ))}
        {entry.hasTotp && (
          <span
            style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 12,
              background: "var(--badge-green-bg, #dcfce7)",
              color: "var(--badge-green-text, #166534)",
              fontWeight: 600,
            }}
          >
            TOTP
          </span>
        )}
        {entry.adminOnly && (
          <span
            style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 12,
              background: "var(--badge-orange-bg, #ffedd5)",
              color: "var(--badge-orange-text, #9a3412)",
              fontWeight: 600,
            }}
          >
            {t.adminOnly}
          </span>
        )}
      </div>
    </div>
  );

  /* ─── Detail modal ─── */

  const renderDetailModal = () => {
    if (!selectedEntry) return null;
    return (
      <div>
        {/* Service header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MaterialSymbol name="lock" size={24} style={{ color: "var(--accent-primary)" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--text-primary)" }}>{selectedEntry.serviceName}</h2>
            {selectedEntry.serviceUrl && (
              <a href={selectedEntry.serviceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent-primary)", textDecoration: "none" }}>
                {selectedEntry.serviceUrl} <MaterialSymbol name="open_in_new" size={12} />
              </a>
            )}
          </div>
        </div>

        {/* Credentials */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {/* Login */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8 }}>
            <MaterialSymbol name="person" size={18} style={{ color: "var(--text-muted)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{t.login}</div>
              <div style={{ fontFamily: "monospace", fontSize: 14, color: "var(--text-primary)" }}>{selectedEntry.login}</div>
            </div>
            <button onClick={() => copyToClipboard(selectedEntry.login, "login")} style={copyBtnStyle}>
              <MaterialSymbol name={copiedField === "login" ? "check" : "content_copy"} size={16} />
            </button>
          </div>

          {/* Password */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8 }}>
            <MaterialSymbol name="key" size={18} style={{ color: "var(--text-muted)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{t.password}</div>
              <div style={{ fontFamily: "monospace", fontSize: 14, color: "var(--text-primary)" }}>
                {selectedEntry.canViewPassword ? (showPwd ? selectedEntry.password : "••••••••••••") : t.passwordHiddenByPolicy}
              </div>
            </div>
            {selectedEntry.canViewPassword && (
              <>
                <button onClick={() => setShowPwd((v) => !v)} style={copyBtnStyle}>
                  <MaterialSymbol name={showPwd ? "visibility_off" : "visibility"} size={16} />
                </button>
                <button onClick={() => copyToClipboard(selectedEntry.password, "pwd")} style={copyBtnStyle}>
                  <MaterialSymbol name={copiedField === "pwd" ? "check" : "content_copy"} size={16} />
                </button>
              </>
            )}
          </div>

          {/* Notes */}
          {selectedEntry.notes && (
            <div style={{ padding: "10px 14px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t.notes}</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{selectedEntry.notes}</div>
            </div>
          )}
        </div>

        {/* Groups */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{t.groups}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {selectedEntry.groupIds.map((gid) => (
              <span key={gid} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "var(--badge-blue-bg, #dbeafe)", color: "var(--badge-blue-text, #1e40af)", fontWeight: 600 }}>
                {groupNameMap[gid] || gid}
              </span>
            ))}
            {selectedEntry.adminOnly && (
              <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "var(--badge-orange-bg, #ffedd5)", color: "var(--badge-orange-text, #9a3412)", fontWeight: 600 }}>
                {t.adminOnly}
              </span>
            )}
            {selectedEntry.passwordOwnerOnly && (
              <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "var(--surface-secondary, #2a2a3d)", color: "var(--text-secondary)", fontWeight: 600 }}>
                {t.ownerOnlyPassword}
              </span>
            )}
          </div>
        </div>

        {/* TOTP section */}
        {selectedTotps.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{t.totp}</div>
            {selectedTotps.map((totp) => (
              <div key={totp.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-secondary, #2a2a3d)", borderRadius: 8, marginBottom: 8 }}>
                <TotpCountdown remaining={totpRemaining} period={totp.period} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{totp.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, letterSpacing: 4, color: "var(--text-primary)" }}>
                    {totpCodes[totp.id] || "------"}
                  </div>
                </div>
                <button onClick={() => copyToClipboard(totpCodes[totp.id] || "", `totp_${totp.id}`)} style={copyBtnStyle}>
                  <MaterialSymbol name={copiedField === `totp_${totp.id}` ? "check" : "content_copy"} size={16} />
                </button>
                {isAdmin && (
                  <button onClick={() => openBackupCodes(totp.id)} style={{ ...copyBtnStyle, fontSize: 11 }}>
                    <MaterialSymbol name="vpn_key" size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: 14 }}>
          {isAdmin && (
            <button onClick={startAddTotp} className="admin-btn" style={{ fontSize: 13, gap: 4 }}>
              <MaterialSymbol name="add" size={16} /> {t.addTotp}
            </button>
          )}
          {isAdmin && (
            <button onClick={openEdit} className="admin-btn" style={{ fontSize: 13, gap: 4 }}>
              <MaterialSymbol name="edit" size={16} /> {t.edit}
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={handleDelete} className="admin-btn" style={{ fontSize: 13, gap: 4, color: "var(--color-error, #dc2626)" }}>
              <MaterialSymbol name="delete" size={16} /> {t.delete}
            </button>
          )}
        </div>

        {/* Metadata */}
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
          {t.createdAt}: {new Date(selectedEntry.createdAt).toLocaleDateString(locale)} · {t.updatedAt}: {new Date(selectedEntry.updatedAt).toLocaleDateString(locale)}
        </div>
      </div>
    );
  };

  /* ─── Create / Edit form ─── */

  const renderForm = () => (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text-primary)" }}>
        {modalView === "create" ? t.create : t.edit}
      </h2>

      {/* Service name */}
      <label style={labelStyle}>{t.service} *</label>
      <input value={formServiceName} onChange={(e) => setFormServiceName(e.target.value)} style={inputStyle} placeholder="Intercom, AWS Console…" />

      {/* URL */}
      <label style={labelStyle}>{t.url}</label>
      <input value={formServiceUrl} onChange={(e) => setFormServiceUrl(e.target.value)} style={inputStyle} placeholder="https://..." />

      {/* Login */}
      <label style={labelStyle}>{t.login} *</label>
      <input value={formLogin} onChange={(e) => setFormLogin(e.target.value)} style={inputStyle} />

      {/* Password */}
      <label style={labelStyle}>{t.password} *</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={formPassword} onChange={(e) => setFormPassword(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} type="text" />
        <button onClick={generatePassword} className="admin-btn" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
          <MaterialSymbol name="casino" size={14} /> {t.generatePwd}
        </button>
      </div>

      {/* Notes */}
      <label style={labelStyle}>{t.notes}</label>
      <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />

      {/* Groups */}
      <label style={labelStyle}>{t.groups} *</label>
      {canManageGroupSelection ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <button
            onClick={() =>
              setFormAdminOnly((value) => {
                const next = !value;
                if (next) setFormGroupIds([]);
                return next;
              })
            }
            style={{
              padding: "4px 12px", borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: formAdminOnly ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
              background: formAdminOnly ? "var(--accent-primary)" : "transparent",
              color: formAdminOnly ? "#fff" : "var(--text-secondary)",
              transition: "all 0.15s",
            }}
          >
            {t.adminOnly}
          </button>
          {groups.map((g) => {
            const active = formGroupIds.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => {
                  if (formAdminOnly) setFormAdminOnly(false);
                  setFormGroupIds((prev) =>
                    active ? prev.filter((x) => x !== g.id) : [...prev, g.id]
                  );
                }}
                style={{
                  padding: "4px 12px", borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: active ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  background: active ? "var(--accent-primary)" : "transparent",
                  color: active ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.15s",
                  opacity: formAdminOnly ? 0.5 : 1,
                }}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ marginBottom: 20, fontSize: 12, color: "var(--text-muted)" }}>
          {t.autoShareInfo}
        </div>
      )}

      <label style={labelStyle}>{t.ownerOnlyPassword}</label>
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => setFormPasswordOwnerOnly((v) => !v)}
          style={{
            padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: formPasswordOwnerOnly ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
            background: formPasswordOwnerOnly ? "var(--accent-primary)" : "transparent",
            color: formPasswordOwnerOnly ? "#fff" : "var(--text-secondary)",
            transition: "all 0.15s",
          }}
        >
          {formPasswordOwnerOnly ? "ON" : "OFF"}
        </button>
      </div>

      <label style={labelStyle}>{t.totpOptionalAtSave}</label>
      <input
        value={formTotpSecret}
        onChange={(e) => setFormTotpSecret(e.target.value)}
        style={{ ...inputStyle, fontFamily: "monospace" }}
        placeholder="JBSWY3DPEHPK3PXP..."
      />

      {saveError && (
        <div style={{ marginBottom: 10, color: "var(--color-error, #dc2626)", fontSize: 12 }}>
          {saveError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={closeModal} className="admin-btn" style={{ fontSize: 13 }}>{t.cancel}</button>
        <AsyncButton
          onClick={handleSave}
          variant="primary"
          isLoading={formSaving}
          disabled={formSaving || !formServiceName || !formLogin || !formPassword}
          style={{ fontSize: 13 }}
        >
          {t.save}
        </AsyncButton>
      </div>
    </div>
  );

  /* ─── Add TOTP modal ─── */

  const renderAddTotp = () => {
    // If we have backup codes to show after successful add
    if (newBackupCodes) {
      return (
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--text-primary)" }}>{t.backupCodes}</h2>
          <p style={{ fontSize: 13, color: "var(--color-warning, #f59e0b)", marginBottom: 16 }}>{t.backupCodesWarning}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
            {newBackupCodes.map((code, i) => (
              <div key={i} style={{ fontFamily: "monospace", fontSize: 14, padding: "6px 10px", background: "var(--surface-secondary)", borderRadius: 6, textAlign: "center", color: "var(--text-primary)" }}>
                {code}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => copyToClipboard(newBackupCodes.join("\n"), "backup")}
              className="admin-btn"
              style={{ fontSize: 13 }}
            >
              <MaterialSymbol name="content_copy" size={14} /> {t.copy}
            </button>
            <button
              onClick={() => {
                setNewBackupCodes(null);
                setModalView("detail");
              }}
              className="admin-btn-primary"
              style={{ fontSize: 13 }}
            >
              OK
            </button>
          </div>
        </div>
      );
    }

    // Verify step
    if (totpVerifyStep) {
      return (
        <div>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text-primary)" }}>{t.verify}</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>{t.verifyCode}</p>
          <input
            value={totpVerifyCode}
            onChange={(e) => setTotpVerifyCode(e.target.value)}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: 24, textAlign: "center", letterSpacing: 6 }}
            maxLength={6}
            placeholder="000000"
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setTotpVerifyStep(false)} className="admin-btn" style={{ fontSize: 13 }}>{t.cancel}</button>
            <button
              onClick={handleTotpConfirm}
              className="admin-btn-primary"
              disabled={totpVerifyCode.length < 6}
              style={{ fontSize: 13 }}
            >
              {t.verify}
            </button>
          </div>
        </div>
      );
    }

    // Secret entry
    return (
      <div>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text-primary)" }}>{t.addTotp}</h2>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setTotpMode("manual")}
            className="admin-btn"
            style={{ fontSize: 12, borderColor: totpMode === "manual" ? "var(--accent-primary)" : undefined }}
          >
            {t.manualEntry}
          </button>
          <button onClick={startQrScan} className="admin-btn" style={{ fontSize: 12, borderColor: totpMode === "scan" ? "var(--accent-primary)" : undefined }}>
            <MaterialSymbol name="qr_code_scanner" size={14} /> {t.scanQr}
          </button>
        </div>

        {totpMode === "scan" && (
          <div id="qr-reader" style={{ width: "100%", marginBottom: 16 }}>
            <video ref={videoRef} style={{ width: "100%", borderRadius: 8 }} />
          </div>
        )}

        <label style={labelStyle}>{t.totpLabel}</label>
        <input value={totpLabel} onChange={(e) => setTotpLabel(e.target.value)} style={inputStyle} placeholder="TOTP principal" />

        <label style={labelStyle}>{t.totpSecret} *</label>
        <input
          value={totpSecret}
          onChange={(e) => setTotpSecret(e.target.value)}
          style={{ ...inputStyle, fontFamily: "monospace" }}
          placeholder="JBSWY3DPEHPK3PXP..."
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setModalView("detail")} className="admin-btn" style={{ fontSize: 13 }}>{t.cancel}</button>
          <button
            onClick={handleTotpVerify}
            className="admin-btn-primary"
            disabled={!totpSecret || totpSecret.length < 16}
            style={{ fontSize: 13 }}
          >
            {t.verify}
          </button>
        </div>
      </div>
    );
  };

  /* ─── Backup codes view ─── */

  const renderBackupCodes = () => (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text-primary)" }}>{t.backupCodes}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
        {viewBackupCodes.map((bc) => (
          <div
            key={bc.id}
            style={{
              fontFamily: "monospace", fontSize: 14, padding: "8px 10px",
              background: bc.used ? "var(--surface-secondary)" : "var(--card-bg)",
              border: `1px solid ${bc.used ? "transparent" : "var(--border-color)"}`,
              borderRadius: 6, textAlign: "center",
              color: bc.used ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: bc.used ? "line-through" : "none",
            }}
          >
            {bc.code}
            <div style={{ fontSize: 10, marginTop: 2, color: bc.used ? "var(--color-error)" : "var(--color-success, #16a34a)" }}>
              {bc.used ? t.used : t.available}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setModalView("detail")} className="admin-btn-primary" style={{ fontSize: 13 }}>OK</button>
      </div>
    </div>
  );

  /* ─── Export confirm ─── */

  const renderExportConfirm = () => (
    <div>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, color: "var(--text-primary)" }}>{t.exportAll}</h2>
      <p style={{ fontSize: 13, color: "var(--color-warning, #f59e0b)", marginBottom: 20 }}>{t.exportConfirm}</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={closeModal} className="admin-btn" style={{ fontSize: 13 }}>{t.cancel}</button>
        <button onClick={() => handleExport("json")} className="admin-btn-primary" style={{ fontSize: 13 }}>{t.exportJson}</button>
        <button onClick={() => handleExport("csv")} className="admin-btn" style={{ fontSize: 13 }}>{t.exportCsv}</button>
      </div>
    </div>
  );

  /* ─── Main render ─── */

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 className="admin-page-title" style={{ margin: 0 }}>{t.title}</h1>
          <p className="admin-page-description" style={{ margin: "4px 0 0" }}>{t.description}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <AsyncButton onClick={openCreate} variant="primary" style={{ fontSize: 13, gap: 4 }}>
            <MaterialSymbol name="add" size={16} /> {t.addEntry}
          </AsyncButton>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: "1 1 auto", minWidth: 280, position: "relative" }}>
          <MaterialSymbol name="search" size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        {(isAdmin || isSuperAdmin) && (
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, width: 210, minWidth: 180, flex: "0 0 auto" }}
          >
            <option value="">{t.allGroups}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          <MaterialSymbol name="hourglass_empty" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          {entries.length === 0 ? t.noEntries : t.noResults}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Shared passwords section */}
          {filteredShared.length > 0 && (
            <div>
              {filteredPersonal.length > 0 && (
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                  <MaterialSymbol name="group" size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  {t.sectionShared}
                </h3>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredShared.map(renderEntryCard)}
              </div>
            </div>
          )}

          {/* Personal passwords section (owner-only) */}
          {filteredPersonal.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                <MaterialSymbol name="lock_person" size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {t.sectionPersonal}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredPersonal.map(renderEntryCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal overlay */}
      {modalView && typeof document !== "undefined" && createPortal((
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, backgroundColor: "var(--overlay-bg, rgba(0,0,0,0.6))",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000,
            padding: "20px 14px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--modal-bg, #1a1a2e)",
              borderRadius: 16, padding: 28,
              width: "min(680px, calc(100vw - 28px))", maxHeight: "calc(100vh - 40px)", overflowY: "auto",
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            {/* Close button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                <MaterialSymbol name="close" size={20} />
              </button>
            </div>

            {modalView === "detail" && renderDetailModal()}
            {(modalView === "create" || modalView === "edit") && renderForm()}
            {modalView === "add-totp" && renderAddTotp()}
            {modalView === "backup-codes" && renderBackupCodes()}
            {modalView === "export-confirm" && renderExportConfirm()}
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

/* ─── Shared styles ─── */

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-color, #333)",
  background: "var(--input-bg, #1e1e2e)",
  color: "var(--text-primary)",
  fontSize: 14,
  marginBottom: 14,
  outline: "none",
  boxSizing: "border-box" as const,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-muted)",
  marginBottom: 4,
  fontWeight: 600,
};

const copyBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-secondary)",
  padding: 6,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  transition: "color 0.15s",
};
