export interface Env {
  DB: D1Database;
  VAULT_BUCKET?: R2Bucket;
  CACHE_KV?: KVNamespace;
  ASSETS?: Fetcher;

  // Environment variables
  ENV?: string;
  FRONTEND_URL?: string;
  JWT_SECRET?: string;
  ADMIN_PASSWORD?: string;
  PHANTOM_SECRET_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;

  // Email Configuration
  EMAIL_PROVIDER?: 'dev' | 'webhook' | 'cloudflare';
  MAKE_WEBHOOK_URL?: string;
  CF_EMAIL_ROUTING?: string;
  CLOUDFLARE_EMAIL_TOKEN?: string;
  CLOUDFLARE_EMAIL_SENDER?: string;

  // External AI Keys
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

export interface JwtUserPayload {
  sub: string;
  email: string;
  status: 'ADMIN' | 'PARTICIPANT';
  exp: number;
  iat: number;
}

export interface AppVariables {
  user: {
    id?: number;
    email: string;
    role: string;
  };
}

export type Variables = AppVariables;
