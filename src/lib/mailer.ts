import nodemailer from "nodemailer";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

type SendInvitationParams = {
  to: string;
  inviterName: string;
  groupName: string;
  invitationUrl: string;
};

export type InvitationEmailResult = {
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
  const appName = process.env.APP_NAME || "CostOP";
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

export async function sendInvitationEmail({
  to,
  inviterName,
  groupName,
  invitationUrl,
}: SendInvitationParams): Promise<InvitationEmailResult> {
  const transport = buildTransport();
  const appName = process.env.APP_NAME || "CostOP";
  const from = process.env.SMTP_FROM || `no-reply@costockage.local`;

  const subject = `Vous êtes invité(e) à rejoindre ${appName}`;
  const text = [
    `Bonjour,`,
    "",
    `${inviterName} vous invite à rejoindre ${appName}.`,
    `Vous avez été assigné(e) au groupe : ${groupName}.`,
    "",
    "Cliquez sur le lien ci-dessous pour créer votre compte :",
    invitationUrl,
    "",
    "Ce lien expire dans 7 jours.",
    "",
    `— L'équipe ${appName}`,
  ].join("\n");

  const safeAppName = escapeHtml(appName);
  const safeInviterName = inviterName ? escapeHtml(inviterName) : "";
  const safeGroupName = groupName ? escapeHtml(groupName) : "";
  const safeInvitationUrl = escapeHtml(encodeURI(invitationUrl));

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">Vous êtes invité(e) à rejoindre ${safeAppName}</h2>
      <p>${safeInviterName} vous invite à rejoindre <strong>${safeAppName}</strong>.</p>
      <p>Vous avez été assigné(e) au groupe : <strong>${safeGroupName}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${safeInvitationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Créer mon compte
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">Ce lien expire dans 7 jours.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">— L'équipe ${safeAppName}</p>
    </div>
  `;

  if (!transport) {
    console.info("[invitation][dev]", { to, invitationUrl });
    return { delivered: false, mode: "log" };
  }

  try {
    await transport.sendMail({ from, to, subject, text, html });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    console.error("[invitation][smtp] send failed", { to, message });
    return { delivered: false, mode: "log", error: message };
  }

  return { delivered: true, mode: "smtp" };
}

/* ─── Ticket comment notification ─── */

type SendTicketCommentParams = {
  to: string;
  ticketTitle: string;
  commentBody: string;
  authorName: string;
};

export type TicketCommentEmailResult = {
  delivered: boolean;
  mode: "smtp" | "log";
  error?: string;
};

export async function sendTicketCommentEmail({
  to,
  ticketTitle,
  commentBody,
  authorName,
}: SendTicketCommentParams): Promise<TicketCommentEmailResult> {
  const transport = buildTransport();
  const appName = process.env.APP_NAME || "CostOP";
  const from = process.env.SMTP_FROM || `no-reply@costockage.local`;

  const safeAppName = escapeHtml(appName);
  const safeTicketTitle = escapeHtml(ticketTitle);
  const safeAuthorName = escapeHtml(authorName);
  const safeCommentBody = escapeHtml(commentBody);

  const subject = `[${appName}] Nouveau commentaire sur « ${ticketTitle} »`;

  const text = [
    `Nouveau commentaire sur le ticket « ${ticketTitle} »`,
    "",
    `${authorName} a écrit :`,
    commentBody,
    "",
    `— ${appName}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a; font-size: 16px;">Nouveau commentaire sur le ticket « ${safeTicketTitle} »</h2>
      <p><strong>${safeAuthorName}</strong> a écrit :</p>
      <div style="padding: 12px 16px; background: #f4f4f5; border-radius: 8px; border-left: 4px solid #6366f1; margin: 16px 0; white-space: pre-wrap; color: #1a1a1a;">
        ${safeCommentBody}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">— ${safeAppName}</p>
    </div>
  `;

  if (!transport) {
    console.info("[ticket-comment][dev]", { to, ticketTitle, authorName });
    return { delivered: false, mode: "log" };
  }

  try {
    await transport.sendMail({ from, to, subject, text, html });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    console.error("[ticket-comment][smtp] send failed", { to, message });
    return { delivered: false, mode: "log", error: message };
  }

  return { delivered: true, mode: "smtp" };
}
