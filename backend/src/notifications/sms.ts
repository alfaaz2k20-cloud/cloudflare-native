import { Env } from '../types';

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  preview?: {
    to: string;
    body: string;
    timestamp: string;
  };
}

// In-memory preview buffer for local dev inspection / test assertions
export const devSmsPreviews: Array<{ to: string; body: string; timestamp: string }> = [];

/**
 * Dispatch an SMS to an E.164 phone number via Twilio REST API.
 * In development and test environments (or when Twilio credentials are omitted),
 * outputs a preview to the dev logs and returns success.
 */
export async function sendSms(env: Env, to: string, message: string): Promise<SmsResult> {
  const isDevOrTest = env.ENV !== 'production';
  const hasTwilioCreds = Boolean(
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER
  );

  if (isDevOrTest || !hasTwilioCreds) {
    if (!isDevOrTest && !hasTwilioCreds) {
      console.error('[SMS ERROR] Production SMS service unconfigured: Missing Twilio credentials.');
      return { success: false, error: 'SMS service unconfigured.' };
    }

    const preview = {
      to,
      body: message,
      timestamp: new Date().toISOString()
    };
    devSmsPreviews.push(preview);
    if (devSmsPreviews.length > 50) devSmsPreviews.shift();

    console.log(`[SMS PREVIEW (DEV)] To: ${to} | Body: "${message}"`);
    return {
      success: true,
      messageId: `dev-sms-${Date.now()}`,
      preview
    };
  }

  // Production Twilio API call via fetch
  try {
    const accountSid = env.TWILIO_ACCOUNT_SID!;
    const authToken = env.TWILIO_AUTH_TOKEN!;
    const from = env.TWILIO_FROM_NUMBER!;

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', from);
    params.append('Body', message);

    const basicAuth = btoa(`${accountSid}:${authToken}`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[SMS ERROR] Twilio HTTP ${res.status}:`, errText);
      return { success: false, error: 'SMS delivery service unavailable.' };
    }

    const data: any = await res.json();
    return { success: true, messageId: data.sid };
  } catch (err: any) {
    console.error('[SMS ERROR] Twilio dispatch failed:', err?.message || err);
    return { success: false, error: 'SMS delivery service unavailable.' };
  }
}
