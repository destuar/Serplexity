import nodemailer, { Transporter } from "nodemailer";
import env from "../config/env";

let transporter: Transporter | null = null;
let configured = false;

function ensureTransporter(): void {
  if (configured) return;
  try {
    if (
      env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASSWORD &&
      env.SMTP_FROM_EMAIL
    ) {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
      });
      configured = true;
    } else {
      configured = false;
      transporter = null;
    }
  } catch (err) {
    configured = false;
    transporter = null;
    // eslint-disable-next-line no-console
    console.error("[mailerService] Failed to initialize transporter", err);
  }
}

export async function sendTeamInviteEmail(params: {
  toEmail: string;
  ownerName?: string | null;
  inviteLink: string;
}): Promise<void> {
  ensureTransporter();
  if (!configured || !transporter) {
    // eslint-disable-next-line no-console
    console.log("[mailerService] SMTP not configured; skipping invite email");
    return;
  }
  const subject = "You have been invited to join a Serplexity workspace";
  const owner = params.ownerName ? ` by ${params.ownerName}` : "";
  const text = `You've been invited${owner} to join a Serplexity workspace.\n\nClick the link to accept: ${params.inviteLink}\n\nThis link expires in 14 days.`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
      <h2>You're invited${owner}</h2>
      <p>You've been invited to join a Serplexity workspace.</p>
      <p>
        <a href="${params.inviteLink}" style="display:inline-block;padding:10px 16px;background:#000;color:#fff;border-radius:8px;text-decoration:none">Accept invite</a>
      </p>
      <p>Or copy this link: <br/><code>${params.inviteLink}</code></p>
      <p style="color:#6b7280">This link expires in 14 days.</p>
    </div>
  `;
  await transporter.sendMail({
    from: env.SMTP_FROM_EMAIL,
    to: params.toEmail,
    subject,
    text,
    html,
  });
}
