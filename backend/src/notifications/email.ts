import { Env } from '../types';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailResult {
  success: boolean;
  provider: 'dev' | 'webhook' | 'cloudflare';
  messageId?: string;
  error?: string;
  preview?: {
    to: string;
    subject: string;
    length: number;
    timestamp: string;
  };
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
  sendEmail(to: string, subject: string, text: string): Promise<boolean>;
}

// In-memory preview buffer for local dev inspection / test assertions
export const devEmailPreviews: Array<{ to: string; subject: string; text: string; timestamp: string }> = [];

export class DevEmailProvider implements EmailProvider {
  constructor(private isProduction: boolean = false) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    if (this.isProduction) {
      console.warn(`[EMAIL DEV FALLBACK BLOCKED IN PRODUCTION] To: ${maskEmail(message.to)}`);
      return {
        success: false,
        provider: 'dev',
        error: 'Email delivery service unconfigured in production environment.'
      };
    }

    const previewItem = {
      to: message.to,
      subject: message.subject,
      text: message.text,
      timestamp: new Date().toISOString()
    };
    devEmailPreviews.push(previewItem);
    if (devEmailPreviews.length > 50) devEmailPreviews.shift();

    console.log(`[EMAIL PREVIEW (DEV)] To: ${message.to} | Subject: "${message.subject}" | Length: ${message.text.length} chars`);
    return {
      success: true,
      provider: 'dev',
      messageId: `dev-${Date.now()}`,
      preview: {
        to: message.to,
        subject: message.subject,
        length: message.text.length,
        timestamp: previewItem.timestamp
      }
    };
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    const res = await this.send({ to, subject, text });
    return res.success;
  }
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [user, domain] = email.split('@');
  const visible = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
  return `${visible}@${domain}`;
}

export const DEFAULT_EMAIL_FROM = 'curator@alfaazcollective.org';

export function buildBrutalistEmailHtml(subject: string, text: string): string {
  const safeSubject = subject.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const formattedText = escaped
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#8c6d3b; text-decoration:underline;">$1</a>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 1rem; line-height:1.65; color:#2d312e;">')
    .replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${safeSubject}</title>
</head>
<body style="margin:0; padding:24px; background-color:#f4f1ea; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#2d312e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid rgba(45, 49, 46, 0.15);">
    <tr>
      <td style="padding:28px 32px 20px; border-bottom:2px solid #8c6d3b;">
        <span style="font-size:18px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#2d312e;">ALFAAZ COLLECTIVE</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 20px; font-size:20px; font-weight:600; color:#2d312e;">${safeSubject}</h2>
        <div style="font-size:14px; line-height:1.65; color:#2d312e;">
          <p style="margin:0 0 1rem; line-height:1.65; color:#2d312e;">
            ${formattedText}
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; background-color:#faf8f5; border-top:1px solid rgba(45, 49, 46, 0.1); font-size:12px; color:#6b7280; text-align:center;">
        Alfaaz Collective · Srinagar, Kashmir<br/>
        This is an automated notification from Alfaaz Collective. Please log in to your dashboard to manage your account.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export class WebhookEmailProvider implements EmailProvider {
  constructor(private webhookUrl: string, private fromEmail: string = DEFAULT_EMAIL_FROM) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.webhookUrl) {
      return { success: false, provider: 'webhook', error: 'Webhook URL not configured' };
    }

    try {
      const html = message.html || buildBrutalistEmailHtml(message.subject, message.text);
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.fromEmail,
          from_email: this.fromEmail,
          from_name: 'Alfaaz Collective',
          reply_to: this.fromEmail,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: html
        })
      });

      if (res.ok) {
        console.log(`[EMAIL WEBHOOK SENT] From: ${this.fromEmail} | To: ${maskEmail(message.to)} | Subject: "${message.subject}"`);
        return { success: true, provider: 'webhook' };
      } else {
        const errText = await res.text();
        console.warn(`[EMAIL WEBHOOK ERROR] ${res.status}: ${errText.slice(0, 200)}`);
        return { success: false, provider: 'webhook', error: `Webhook rejected: ${res.status}` };
      }
    } catch (err: any) {
      console.error(`[EMAIL WEBHOOK EXCEPTION]`, err);
      return { success: false, provider: 'webhook', error: err.message || 'Webhook network failure' };
    }
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    const res = await this.send({ to, subject, text });
    return res.success;
  }
}

export class CloudflareEmailSendingProvider implements EmailProvider {
  constructor(private token?: string, private senderEmail: string = DEFAULT_EMAIL_FROM) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.token) {
      return {
        success: false,
        provider: 'cloudflare',
        error: 'Cloudflare Email Sending credentials (token) missing.'
      };
    }

    const from = this.senderEmail || DEFAULT_EMAIL_FROM;
    const html = message.html || buildBrutalistEmailHtml(message.subject, message.text);

    // Cloudflare Transactional Email sending API endpoint
    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/accounts/current/email/sending/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: from,
          from_name: 'Alfaaz Collective',
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: html
        })
      });

      const data: any = await res.json();
      if (res.ok && data.success) {
        return { success: true, provider: 'cloudflare', messageId: data.result?.id };
      }
      return {
        success: false,
        provider: 'cloudflare',
        error: data.errors?.[0]?.message || 'Cloudflare Email Sending API error'
      };
    } catch (err: any) {
      return { success: false, provider: 'cloudflare', error: err.message };
    }
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    const res = await this.send({ to, subject, text });
    return res.success;
  }
}

export function getEmailProvider(env: Env): EmailProvider {
  const mode = env.EMAIL_PROVIDER;
  const fromEmail = env.EMAIL_FROM || env.CLOUDFLARE_EMAIL_SENDER || DEFAULT_EMAIL_FROM;
  if ((mode === 'webhook' || (!mode && env.MAKE_WEBHOOK_URL)) && env.MAKE_WEBHOOK_URL) {
    return new WebhookEmailProvider(env.MAKE_WEBHOOK_URL, fromEmail);
  }
  if (mode === 'cloudflare' && env.CLOUDFLARE_EMAIL_TOKEN) {
    return new CloudflareEmailSendingProvider(env.CLOUDFLARE_EMAIL_TOKEN, fromEmail);
  }
  return new DevEmailProvider(env.ENV === 'production');
}

export async function sendSystemEmail(
  env: Env,
  to: string,
  subject: string,
  body: string,
  raiseOnError: boolean = false,
  exposeError: boolean = false
): Promise<boolean> {
  const provider = getEmailProvider(env);
  const result = await provider.send({ to, subject, text: body });

  if (!result.success) {
    if (raiseOnError) {
      const msg = exposeError ? (result.error || 'Email delivery failed') : 'Email transmission failed.';
      throw new Error(msg);
    }
    return false;
  }
  return true;
}
