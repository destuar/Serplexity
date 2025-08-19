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
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team Invitation - Serplexity</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 520px; margin: 0 auto; padding: 0; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb;">
      <!-- Header -->
      <div style="text-align: center; padding: 32px 24px 24px 24px; border-bottom: 1px solid #f1f5f9;">
        <table style="margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle; padding-right: 12px;">
              <img src="https://www.serplexity.com/Serplexity.png" alt="Serplexity" width="32" height="32" style="width: 32px; height: 32px; display: block;" />
            </td>
            <td style="vertical-align: middle;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: -0.025em;">Serplexity</h1>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 32px 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.2; text-align: center;">You're invited${owner}</h2>
        
        <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #475569; text-align: center;">You've been invited to join a Serplexity workspace and start optimizing your brand's visibility in AI search results.</p>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
        </div>
        
        <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.5; color: #94a3b8; text-align: center;">This invitation expires in 14 days</p>
      </div>
      
      <!-- Footer -->
      <div style="padding: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2025 Serplexity. All rights reserved.</p>
      </div>
    </div>
    </body>
    </html>
  `;
  
  const fromEmail = smtpSecret?.fromEmail || env.SMTP_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("No FROM email address configured");
  }
  
  await transporter.sendMail({
    from: `"The Serplexity Team" <${fromEmail}>`,
    to: params.toEmail,
    subject,
    text,
    html,
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'X-Mailer': 'Serplexity Platform',
      'X-MimeOLE': 'Produced By Serplexity',
      'Reply-To': fromEmail,
      'Return-Path': fromEmail,
      'List-Unsubscribe': '<mailto:unsubscribe@serplexity.com>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'Message-ID': `<${Date.now()}-${Math.random().toString(36)}@serplexity.com>`,
      'Date': new Date().toUTCString(),
      'MIME-Version': '1.0',
      // Content-Type removed - nodemailer sets this automatically for multipart/alternative when both text and html are provided
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
      'Precedence': 'bulk',
    },
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
  const dashboardUrl = "https://serplexity.com/overview";
  const text = `You've been added${owner} to a Serplexity workspace.\n\nOpen your workspace: ${dashboardUrl}`;
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team Invitation - Serplexity</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 520px; margin: 0 auto; padding: 0; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb;">
      <!-- Header -->
      <div style="text-align: center; padding: 32px 24px 24px 24px; border-bottom: 1px solid #f1f5f9;">
        <table style="margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle; padding-right: 12px;">
              <img src="https://www.serplexity.com/Serplexity.png" alt="Serplexity" width="32" height="32" style="width: 32px; height: 32px; display: block;" />
            </td>
            <td style="vertical-align: middle;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: -0.025em;">Serplexity</h1>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 32px 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.2; text-align: center;">Welcome to Serplexity${owner}</h2>
        
        <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #475569; text-align: center;">You now have access to your Serplexity workspace. Start tracking and optimizing your brand's visibility in AI search results.</p>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Open Workspace</a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="padding: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2025 Serplexity. All rights reserved.</p>
      </div>
    </div>
    </body>
    </html>
  `;
  
  const fromEmail = smtpSecret?.fromEmail || env.SMTP_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("No FROM email address configured");
  }
  
  await transporter.sendMail({
    from: `"The Serplexity Team" <${fromEmail}>`,
    to: params.toEmail,
    subject,
    text,
    html,
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'X-Mailer': 'Serplexity Platform',
      'X-MimeOLE': 'Produced By Serplexity',
      'Reply-To': fromEmail,
      'Return-Path': fromEmail,
      'List-Unsubscribe': '<mailto:unsubscribe@serplexity.com>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'Message-ID': `<${Date.now()}-${Math.random().toString(36)}@serplexity.com>`,
      'Date': new Date().toUTCString(),
      'MIME-Version': '1.0',
      // Content-Type removed - nodemailer sets this automatically for multipart/alternative when both text and html are provided
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
      'Precedence': 'bulk',
    },
  });
  
  logger.info("[mailerService] Workspace notification email sent successfully", {
    toEmail: params.toEmail,
    fromEmail,
    subject
  });
}

export async function sendFeedbackEmail(params: {
  userEmail: string;
  userName: string;
  userId: string;
  feedback: string;
  source: string;
}): Promise<void> {
  await ensureTransporter();
  if (!configured || !transporter) {
    const error = "SMTP not configured - cannot send feedback email";
    logger.error("[mailerService] Email delivery failed", { error, userEmail: params.userEmail });
    throw new Error(error);
  }

  const subject = `User Feedback - ${params.userName || params.userEmail}`;
  const timestamp = new Date().toISOString();
  
  const text = `New feedback received from ${params.userName} (${params.userEmail})

Source: ${params.source}
User ID: ${params.userId}
Submitted: ${timestamp}

Feedback:
${params.feedback}

---
This feedback was submitted through the Serplexity platform.`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>User Feedback - Serplexity</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 0; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb;">
      <!-- Header -->
      <div style="text-align: center; padding: 32px 24px 24px 24px; border-bottom: 1px solid #f1f5f9;">
        <table style="margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle; padding-right: 12px;">
              <img src="https://www.serplexity.com/Serplexity.png" alt="Serplexity" width="32" height="32" style="width: 32px; height: 32px; display: block;" />
            </td>
            <td style="vertical-align: middle;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: -0.025em;">Serplexity</h1>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 32px 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.2;">New User Feedback</h2>
        
        <!-- User Info -->
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">User Information</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: #6b7280; width: 80px;">Name:</td>
              <td style="padding: 4px 0; color: #374151; font-weight: 500;">${params.userName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Email:</td>
              <td style="padding: 4px 0; color: #374151; font-weight: 500;">${params.userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">User ID:</td>
              <td style="padding: 4px 0; color: #374151; font-family: monospace;">${params.userId}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Source:</td>
              <td style="padding: 4px 0; color: #374151;">${params.source}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Submitted:</td>
              <td style="padding: 4px 0; color: #374151;">${timestamp}</td>
            </tr>
          </table>
        </div>
        
        <!-- Feedback Content -->
        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">Feedback</h3>
          <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${params.feedback}</div>
        </div>
        
        <!-- Action Button -->
        <div style="text-align: center; margin: 24px 0;">
          <a href="mailto:${params.userEmail}?subject=Re: Your Serplexity Feedback" style="display: inline-block; padding: 12px 24px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Reply to User</a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="padding: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2025 Serplexity. All rights reserved.</p>
      </div>
    </div>
    </body>
    </html>
  `;
  
  const fromEmail = smtpSecret?.fromEmail || env.SMTP_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("No FROM email address configured");
  }
  
  await transporter.sendMail({
    from: `"Serplexity Platform" <${fromEmail}>`,
    to: "support@serplexity.com",
    subject,
    text,
    html,
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'X-Mailer': 'Serplexity Platform',
      'X-MimeOLE': 'Produced By Serplexity',
      'Reply-To': params.userEmail,
      'Return-Path': fromEmail,
      'Message-ID': `<feedback-${Date.now()}-${Math.random().toString(36)}@serplexity.com>`,
      'Date': new Date().toUTCString(),
      'MIME-Version': '1.0',
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
      'Precedence': 'bulk',
    },
  });
  
  logger.info("[mailerService] Feedback email sent successfully", {
    userEmail: params.userEmail,
    userName: params.userName,
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