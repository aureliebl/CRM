import nodemailer from "nodemailer";

type SendResetParams = {
  to: string;
  fullName?: string | null;
  resetUrl: string;
};

export type ResetEmailResult = {
  delivered: boolean;
  mode: "smtp" | "log";
  error?: string;
};

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendPasswordResetEmail({ to, fullName, resetUrl }: SendResetParams): Promise<ResetEmailResult> {
  const transport = buildTransport();
  const appName = process.env.APP_NAME || "Costockage";
  const from = process.env.SMTP_FROM || `no-reply@costockage.local`;
  const recipientName = (fullName ?? "").trim() || to;

  const subject = `[${appName}] Password reset`;
  const text = [
    `Hello ${recipientName},`,
    "",
    "A password reset has been requested for your account.",
    "Use this link to set a new password:",
    resetUrl,
    "",
    "If you did not request this change, you can ignore this email.",
  ].join("\n");

  const html = `
    <p>Hello ${recipientName},</p>
    <p>A password reset has been requested for your account.</p>
    <p><a href="${resetUrl}">Set a new password</a></p>
    <p>If you did not request this change, you can ignore this email.</p>
  `;

  if (!transport) {
    console.info("[password-reset][dev]", { to, resetUrl });
    return { delivered: false, mode: "log" };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    console.error("[password-reset][smtp] send failed", {
      to,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      message,
    });
    return { delivered: false, mode: "log", error: message };
  }

  return { delivered: true, mode: "smtp" };
}
