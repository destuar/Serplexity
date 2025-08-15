import nodemailer, { Transporter } from "nodemailer";
import env from "../config/env";
import logger from "../utils/logger";
import { SecretsProviderFactory, SmtpSecret } from "./secretsProvider";

let transporter: Transporter | null = null;
let configured = false;
let smtpSecret: SmtpSecret | null = null;

async function ensureTransporter(): Promise<void> {
  if (configured) return;
  
  try {
    // Try to get SMTP credentials from secrets provider first
    if (env.SMTP_SECRET_NAME && env.COMPUTED_SECRETS_PROVIDER !== "environment") {
      logger.info("[mailerService] Attempting to load SMTP credentials from secrets provider");
      const secretsProvider = await SecretsProviderFactory.createFromEnvironment();
      const smtpSecretResult = await secretsProvider.getSmtpSecret(env.SMTP_SECRET_NAME);
      smtpSecret = smtpSecretResult.secret;
      
      const transportConfig = {
        host: smtpSecret.host,
        port: smtpSecret.port,
        secure: smtpSecret.secure || smtpSecret.port === 465,
        auth: {
          user: smtpSecret.user,
          pass: smtpSecret.password,
        },
        tls: { rejectUnauthorized: false },
      };
      
      logger.info("[mailerService] Creating SMTP transporter with config", {
        host: transportConfig.host,
        port: transportConfig.port,
        secure: transportConfig.secure,
        user: transportConfig.auth.user,
        provider: smtpSecretResult.metadata.provider
      });
      
      transporter = nodemailer.createTransport(transportConfig);
      
      logger.info("[mailerService] SMTP transporter configured from secrets provider");
      configured = true;
      return;
    }
    
    // Fallback to environment variables
    if (
      env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASSWORD &&
      env.SMTP_FROM_EMAIL
    ) {
      logger.info("[mailerService] Configuring SMTP from environment variables");
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
      logger.warn("[mailerService] SMTP not configured - neither secrets nor environment variables available");
    }
  } catch (err) {
    configured = false;
    transporter = null;
    smtpSecret = null;
    logger.error("[mailerService] Failed to initialize transporter", { error: err });
    throw new Error(`SMTP configuration failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function sendTeamInviteEmail(params: {
  toEmail: string;
  ownerName?: string | null;
  inviteLink: string;
}): Promise<void> {
  await ensureTransporter();
  if (!configured || !transporter) {
    const error = "SMTP not configured - cannot send invite email";
    logger.error("[mailerService] Email delivery failed", { error, toEmail: params.toEmail });
    throw new Error(error);
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
  
  const fromEmail = smtpSecret?.fromEmail || env.SMTP_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("No FROM email address configured");
  }
  
  await transporter.sendMail({
    from: fromEmail,
    to: params.toEmail,
    subject,
    text,
    html,
  });
  
  logger.info("[mailerService] Team invite email sent successfully", {
    toEmail: params.toEmail,
    fromEmail,
    subject
  });
}

export async function sendAddedToWorkspaceEmail(params: {
  toEmail: string;
  ownerName?: string | null;
}): Promise<void> {
  await ensureTransporter();
  if (!configured || !transporter) {
    const error = "SMTP not configured - cannot send workspace notification email";
    logger.error("[mailerService] Email delivery failed", { error, toEmail: params.toEmail });
    throw new Error(error);
  }
  const subject = "You've been added to a Serplexity workspace";
  const owner = params.ownerName ? ` by ${params.ownerName}` : "";
  const dashboardUrl = `${env.FRONTEND_URL || "http://localhost:3000"}/dashboard`;
  const text = `You've been added${owner} to a Serplexity workspace.\n\nOpen your workspace: ${dashboardUrl}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
      <h2>You've been added${owner}</h2>
      <p>You now have access to a Serplexity workspace.</p>
      <p>
        <a href="${dashboardUrl}" style="display:inline-block;padding:10px 16px;background:#000;color:#fff;border-radius:8px;text-decoration:none">Open workspace</a>
      </p>
      <p>Or copy this link: <br/><code>${dashboardUrl}</code></p>
    </div>
  `;
  
  const fromEmail = smtpSecret?.fromEmail || env.SMTP_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("No FROM email address configured");
  }
  
  await transporter.sendMail({
    from: fromEmail,
    to: params.toEmail,
    subject,
    text,
    html,
  });
  
  logger.info("[mailerService] Workspace notification email sent successfully", {
    toEmail: params.toEmail,
    fromEmail,
    subject
  });
}

export function resetSmtpConfiguration(): void {
  transporter = null;
  configured = false;
  smtpSecret = null;
}

export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Force fresh configuration for testing
    resetSmtpConfiguration();
    await ensureTransporter();
    if (!configured || !transporter) {
      return { success: false, error: "SMTP not configured" };
    }
    
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
}