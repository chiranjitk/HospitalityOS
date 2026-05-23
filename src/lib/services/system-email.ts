/**
 * system-email.ts
 *
 * System-level email sender for platform admin notifications.
 * Used for critical system events like new tenant registrations,
 * license alerts, and security events.
 *
 * Uses either:
 *   1. SYSTEM_SMTP_* env vars (for quick setup)
 *   2. Falls back to tenant-level SMTP config if SYSTEM_SMTP_* not set
 *
 * In development, logs to console instead of sending emails.
 */

import nodemailer from 'nodemailer';

interface SystemEmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
  to: string; // Platform admin email(s)
}

/**
 * Get the system email configuration.
 * Priority:
 *   1. SYSTEM_SMTP_* env vars (platform-level)
 *   2. Falls back to tenant-level SMTP config for tenantId 'platform'
 */
function getSystemEmailConfig(): SystemEmailConfig | null {
  const host = process.env.SYSTEM_SMTP_HOST;
  const user = process.env.SYSTEM_SMTP_USER;
  const pass = process.env.SYSTEM_SMTP_PASS || process.env.SYSTEM_SMTP_PASSWORD;
  const from = process.env.SYSTEM_SMTP_FROM || process.env.EMAIL_FROM || 'noreply@staysuite.local';
  const to = process.env.PLATFORM_ADMIN_EMAIL || '';

  // Need at least SYSTEM_SMTP_HOST and PLATFORM_ADMIN_EMAIL to send system emails
  if (host && to) {
    return {
      host,
      port: parseInt(process.env.SYSTEM_SMTP_PORT || '587', 10),
      user: user || '',
      password: pass || '',
      from,
      secure: process.env.SYSTEM_SMTP_SECURE === 'true',
      to,
    };
  }

  return null;
}

/**
 * Send a system notification email to the platform admin.
 * Non-blocking — failures are logged but never throw.
 */
export async function sendSystemEmail(options: {
  subject: string;
  html: string;
  text?: string;
  tenantId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const config = getSystemEmailConfig();

  if (!config) {
    // In development, just log
    console.log(`[SystemEmail] SMTP not configured (SYSTEM_SMTP_HOST + PLATFORM_ADMIN_EMAIL). Skipping email send.`);
    console.log(`[SystemEmail] Subject: ${options.subject}`);
    console.log(`[SystemEmail] Would send to: PLATFORM_ADMIN_EMAIL env var`);
    return { success: false, error: 'System SMTP not configured' };
  }

  // Check development mode
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    const recipients = config.to.split(',').map(e => e.trim()).filter(Boolean);

    const info = await transporter.sendMail({
      from: config.from,
      to: recipients,
      subject: options.subject,
      text: options.text || stripHtml(options.html),
      html: options.html,
    });

    console.log(`[SystemEmail] ✅ Sent to ${recipients.join(', ')} — MessageId: ${info.messageId}`);

    return { success: true, messageId: info.messageId };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[SystemEmail] ❌ Failed to send: ${err.message}`);

    if (isDev) {
      console.log(`[SystemEmail] Subject: ${options.subject}`);
      console.log(`[SystemEmail] HTML preview: ${options.html.substring(0, 200)}...`);
    }

    return { success: false, error: err.message };
  }
}

/**
 * Generate HTML email for a new tenant registration alert.
 */
export function generateRegistrationAlertHtml(params: {
  tenantName: string;
  tenantEmail: string;
  planName: string;
  planDisplayName: string;
  maxProperties: number;
  maxRooms: number;
  maxUsers: number;
  licenseKey: string;
  adminName: string;
  adminEmail: string;
  phone?: string | null;
  serverFingerprint: string;
  generatedFor?: string | null;
  ipAddress: string;
  registeredAt: string;
}): string {
  const {
    tenantName,
    tenantEmail,
    planName,
    planDisplayName,
    maxProperties,
    maxRooms,
    maxUsers,
    licenseKey,
    adminName,
    adminEmail,
    phone,
    serverFingerprint,
    generatedFor,
    ipAddress,
    registeredAt,
  } = params;

  const maskedFp = serverFingerprint.length > 12
    ? `${serverFingerprint.slice(0, 8)}...${serverFingerprint.slice(-4)}`
    : 'N/A';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Tenant Registration — ${tenantName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f4f8; color: #1e293b; line-height: 1.6; }
    .container { max-width: 680px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #0f766e, #065f46); color: white; padding: 24px 28px; }
    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
    .header .subtitle { font-size: 13px; opacity: 0.85; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 2px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .body { padding: 28px; }
    .section { margin-bottom: 20px; }
    .section:last-child { margin-bottom: 0; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { background: #f8fafc; border-radius: 8px; padding: 12px 14px; }
    .info-label { font-size: 11px; color: #64748b; font-weight: 500; margin-bottom: 2px; }
    .info-value { font-size: 14px; font-weight: 600; color: #1e293b; word-break: break-all; }
    .info-value.small { font-size: 12px; font-family: 'SF Mono', 'Fira Code', monospace; }
    .alert-box { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; }
    .alert-title { font-size: 13px; font-weight: 600; color: #92400e; margin-bottom: 4px; }
    .alert-text { font-size: 12px; color: #78350f; }
    .plan-badge { display: inline-flex; align-items: center; gap: 4px; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .fp-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; margin-top: 12px; }
    .fp-label { font-size: 11px; color: #15803d; font-weight: 600; margin-bottom: 4px; }
    .fp-value { font-size: 11px; font-family: 'SF Mono', 'Fira Code', monospace; color: #166534; word-break: break-all; line-height: 1.4; }
    .footer { background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { font-size: 11px; color: #94a3b8; }
    .footer a { color: #0f766e; text-decoration: none; font-weight: 500; }
    .divider { border-top: 1px solid #f1f5f9; margin: 16px 0; }
    @media only screen and (max-width: 600px) {
      .info-grid { grid-template-columns: 1fr; }
      .header { padding: 20px; }
      .header h1 { font-size: 17px; }
      .body { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="badge">New Registration</div>
        <h1>New Tenant Registered</h1>
        <p class="subtitle">${registeredAt}</p>
      </div>
      <div class="body">
        <!-- Tenant Info -->
        <div class="section">
          <div class="section-title">Tenant Details</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Organization</div>
              <div class="info-value">${tenantName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Email</div>
              <div class="info-value">${tenantEmail}</div>
            </div>
          </div>
        </div>

        <!-- Plan Info -->
        <div class="section">
          <div class="section-title">Assigned Plan</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Plan</div>
              <div class="info-value"><span class="plan-badge">${planDisplayName}</span> (${planName})</div>
            </div>
            <div class="info-item">
              <div class="info-label">Limits</div>
              <div class="info-value">${maxProperties} properties × ${maxRooms} rooms × ${maxUsers} users</div>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Admin Info -->
        <div class="section">
          <div class="section-title">Registered By (Admin User)</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Name</div>
              <div class="info-value">${adminName} <span style="color: #64748b;">(${adminEmail})</span></div>
            </div>
            <div class="info-item">
              <div class="info-label">Phone</div>
              <div class="info-value">${phone || 'Not provided'}</div>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- License Key & Fingerprint -->
        <div class="section">
          <div class="section-title">License & Hardware Binding</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">License Key</div>
              <div class="info-value small">${licenseKey}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Client IP</div>
              <div class="info-value small">${ipAddress}</div>
            </div>
          </div>
          ${generatedFor ? `<div class="info-item" style="grid-column: span 2"><div class="info-label">Generated For</div><div class="info-value">${generatedFor}</div></div>` : ''}
          <div class="fp-box">
            <div class="fp-label">Hardware Fingerprint (SHA-256)</div>
            <div class="fp-value">${maskedFp}</div>
          </div>
        </div>

        <div class="alert-box">
          <div class="alert-title">⚠️ Action Required</div>
          <div class="alert-text">
            This is an automated notification. The tenant's license is now active with the plan limits shown above.
            You can manage this license from the Platform Admin → License Keys dashboard.
            No further action is needed unless you need to upgrade/downgrade the plan.
          </div>
        </div>
      </div>
      <div class="footer">
        <p>StaySuite-HospitalityOS — Platform Administration</p>
        <p style="margin-top: 6px;">This is an automated notification. Do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
