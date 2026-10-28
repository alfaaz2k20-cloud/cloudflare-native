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
  async send(message: EmailMessage): Promise<EmailResult> {
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

export class WebhookEmailProvider implements EmailProvider {
  constructor(private webhookUrl: string) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.webhookUrl) {
      return { success: false, provider: 'webhook', error: 'Webhook URL not configured' };
    }

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: message.to,
          subject: message.subject,
          text: message.text
        })
      });

      if (res.ok) {
        console.log(`[EMAIL WEBHOOK SENT] To: ${message.to} | Subject: "${message.subject}"`);
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
  constructor(private token?: string, private senderEmail?: string) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.token || !this.senderEmail) {
      return {
        success: false,
        provider: 'cloudflare',
        error: 'Cloudflare Email Sending credentials (token or verified sender) missing.'
      };
    }

    // Cloudflare Transactional Email sending API endpoint
    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/accounts/current/email/sending/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: this.senderEmail,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html
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
  const mode = env.EMAIL_PROVIDER || 'dev';
  if (mode === 'webhook' && env.MAKE_WEBHOOK_URL) {
    return new WebhookEmailProvider(env.MAKE_WEBHOOK_URL);
  }
  if (mode === 'cloudflare' && env.CLOUDFLARE_EMAIL_TOKEN) {
    return new CloudflareEmailSendingProvider(env.CLOUDFLARE_EMAIL_TOKEN, env.CLOUDFLARE_EMAIL_SENDER);
  }
  return new DevEmailProvider();
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
