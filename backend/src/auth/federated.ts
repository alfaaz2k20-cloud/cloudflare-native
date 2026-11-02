// Web Crypto implementation of Sovereign Federated & Google Identity Services (GIS) Token Verification
// Zero Firebase SDK or external dependency runtime (100% Cloudflare Workers Web Crypto native)

export interface FederatedTokenPayload {
  iss: string;
  aud: string;
  auth_time?: number;
  user_id?: string;
  sub: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
  picture?: string;
  sign_in_provider?: string;
  firebase?: {
    identities?: Record<string, any>;
    sign_in_provider?: string;
  };
  [key: string]: any;
}

export type FirebaseIdTokenPayload = FederatedTokenPayload;

interface CachedKey {
  key: CryptoKey;
  expiresAt: number;
}

const jwkCache = new Map<string, CachedKey>();

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeJson<T = any>(str: string): T {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Fetch and cache Google Auth public keys (GIS / Google OAuth) in JWK format.
 */
async function getGooglePublicKey(kid: string): Promise<CryptoKey | null> {
  const now = Date.now();
  const cacheKey = `google:${kid}`;
  const cached = jwkCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.key;
  }

  try {
    const url = 'https://www.googleapis.com/oauth2/v3/certs';
    let res = await fetch(url);
    if (!res.ok) {
      // Fallback endpoint for service accounts / certificates
      res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
      if (!res.ok) return null;
    }

    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const ttlMs = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;
    const expiresAt = now + ttlMs;

    const data: { keys: any[] } = await res.json();
    for (const keyData of data.keys) {
      if (keyData.kty === 'RSA' && (keyData.alg === 'RS256' || !keyData.alg) && keyData.kid) {
        try {
          const importedKey = await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
          );
          jwkCache.set(`google:${keyData.kid}`, { key: importedKey, expiresAt });
        } catch {
          // Skip unparseable key
        }
      }
    }

    return jwkCache.get(cacheKey)?.key || null;
  } catch (err) {
    console.warn('[AUTH] Failed to fetch Google public keys:', err);
    return null;
  }
}

/**
 * Cryptographically verifies a federated token (GIS / OAuth / OIDC) using Web Crypto RS256.
 * Validates issuer, audience, expiration, algorithm, subject, and signature.
 */
export async function verifyFederatedToken(
  idToken: string,
  expectedProjectId: string = 'alfaaz-collective',
  envName?: string
): Promise<FederatedTokenPayload | null> {
  if (!idToken || typeof idToken !== 'string') return null;

  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Parse and validate header
  let header: { alg?: string; typ?: string; kid?: string };
  try {
    header = base64UrlDecodeJson(headerB64);
  } catch {
    return null;
  }

  // Reject alg 'none' or anything other than RS256
  if (header.alg !== 'RS256' || !header.alg) {
    return null;
  }

  // 2. Parse and validate payload
  let payload: FederatedTokenPayload;
  try {
    payload = base64UrlDecodeJson(payloadB64);
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  // Expiration check
  if (!payload.exp || payload.exp <= now) {
    return null;
  }

  // Issuer check: supports Google Identity Services (GIS) / direct Google OAuth
  const isGis = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
  if (isGis) {
    // CRITICAL SECURITY FIX: Prevent Audience Confusion & Token Replay Attacks
    // Validates that Google ID tokens were explicitly issued for our client ID
    if (expectedProjectId && payload.aud !== expectedProjectId) {
      return null;
    }
    if (!payload.email_verified && payload.email_verified !== 'true' as any) {
      return null;
    }
    // Tag provider for consistent downstream mapping
    if (!payload.sign_in_provider) {
      payload.sign_in_provider = 'google.com';
    }
    payload.email_verified = true;
  } else {
    const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
    if (payload.iss !== expectedIssuer) {
      return null;
    }
    if (payload.aud !== expectedProjectId) {
      return null;
    }
  }

  // Subject check: must be non-empty string
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    return null;
  }

  // Clock skew checks
  if (payload.iat && payload.iat > now + 300) {
    return null;
  }
  if (payload.auth_time && payload.auth_time > now + 300) {
    return null;
  }

  // 3. Cryptographic Signature Verification
  const testKey = (globalThis as any).__TEST_FEDERATED_PUBLIC_KEY__ || (globalThis as any).__TEST_FIREBASE_PUBLIC_KEY__;
  let verifyKey: CryptoKey | null = null;

  if (envName === 'test' && testKey) {
    verifyKey = testKey;
  } else {
    if (!header.kid) return null;
    verifyKey = await getGooglePublicKey(header.kid);
    if (!verifyKey) return null;
  }

  if (verifyKey) {
    try {
      const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
      const signatureBytes = base64UrlToUint8Array(signatureB64);
      const isValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        verifyKey,
        signatureBytes,
        signedData
      );
      if (!isValid) return null;
    } catch {
      return null;
    }
  }

  return payload;
}

export const verifyFirebaseToken = verifyFederatedToken;
