// Web Crypto API implementations for Password Hashing (PBKDF2) and JWT (HMAC-SHA256)
// Zero external native dependencies — 100% Cloudflare Workers runtime compatible.

import { Env } from '../types';

export function getJwtSecret(env?: Env): string {
  const nodeEnv = typeof (globalThis as any).process !== 'undefined' ? (globalThis as any).process.env?.NODE_ENV : undefined;
  const isProd = (env?.ENVIRONMENT === 'production') ||
                 (env?.ENV === 'production') ||
                 (env?.NODE_ENV === 'production') ||
                 (nodeEnv === 'production');

  if (isProd && (!env?.JWT_SECRET || env.JWT_SECRET.trim() === '')) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be explicitly configured in production environment.');
  }

  return env?.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64UrlEncode(data: string | Uint8Array): string {
  let base64: string;
  if (typeof data === 'string') {
    const bytes = new TextEncoder().encode(data);
    base64 = btoa(String.fromCharCode(...bytes));
  } else {
    base64 = btoa(String.fromCharCode(...data));
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const saltHex = bufferToHex(salt.buffer);
  const hashHex = bufferToHex(derived);
  return `pbkdf2:sha256:100000:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  let saltHex = '';
  let originalHashHex = '';

  if (storedHash.startsWith('pbkdf2:sha256:100000:')) {
    const parts = storedHash.split(':');
    saltHex = parts[3];
    originalHashHex = parts[4];
  } else {
    const parts = storedHash.split(':');
    saltHex = parts[0];
    originalHashHex = parts[1];
  }

  if (!saltHex || !originalHashHex) return false;

  const salt = hexToBuffer(saltHex);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const computedHashHex = bufferToHex(derived);

  // Constant-time comparison
  if (computedHashHex.length !== originalHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHashHex.length; i++) {
    diff |= computedHashHex.charCodeAt(i) ^ originalHashHex.charCodeAt(i);
  }
  return diff === 0;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createToken(
  firstArg: string | { email: string; status: string },
  secondArg?: string,
  thirdArg?: string,
  expiresInSeconds: number = 7 * 86400
): Promise<string> {
  let email = '';
  let status = 'PARTICIPANT';
  let secret = '';

  if (typeof firstArg === 'object' && firstArg !== null) {
    email = firstArg.email;
    status = firstArg.status;
    secret = secondArg || '';
  } else {
    email = firstArg;
    status = secondArg || 'PARTICIPANT';
    secret = thirdArg || '';
  }

  if (!secret) {
    throw new Error('JWT secret must be a non-empty string');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: email,
    email,
    status,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${data}.${encodedSignature}`;
}

export async function verifyToken(token: string, secret: string): Promise<any> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  try {
    // Explicitly verify header algorithm and type to prevent algorithm confusion attacks
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header.alg !== 'HS256' || (header.typ && header.typ.toUpperCase() !== 'JWT')) {
      return null;
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature with robust padding handling
    let base64Sig = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    while (base64Sig.length % 4) {
      base64Sig += '=';
    }
    const binary = atob(base64Sig);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(data)
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
