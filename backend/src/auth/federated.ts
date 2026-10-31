// Web Crypto implementation of Firebase ID Token verification
// Compatible with Cloudflare Workers runtime (zero external native dependencies)

export interface FirebaseIdTokenPayload {
  iss: string;
  aud: string;
  auth_time: number;
  user_id: string;
  sub: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
  picture?: string;
  firebase?: {
    identities?: Record<string, any>;
    sign_in_provider?: string;
  };
  [key: string]: any;
}

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
 * Fetch and cache Google Auth public keys (GIS or Firebase) in JWK format.
 */
async function getGooglePublicKey(kid: string, isGis: boolean = false): Promise<CryptoKey | null> {
  const now = Date.now();
  const cacheKey = `${isGis ? 'gis:' : 'fb:'}${kid}`;
  const cached = jwkCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.key;
  }

  try {
    const url = isGis
      ? 'https://www.googleapis.com/oauth2/v3/certs'
      : 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
    const res = await fetch(url);
    if (!res.ok) return null;

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
          jwkCache.set(`${isGis ? 'gis:' : 'fb:'}${keyData.kid}`, { key: importedKey, expiresAt });
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
 * Cryptographically verifies a Firebase ID Token using Web Crypto RS256.
 * Validates issuer, audience, expiration, algorithm, subject, and signature.
 */
export async function verifyFirebaseToken(
  idToken: string,
  expectedProjectId: string = 'alfaaz-collective',
  envName?: string
): Promise<FirebaseIdTokenPayload | null> {
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
  let payload: FirebaseIdTokenPayload;
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

  // Issuer check: supports both Google Identity Services (GIS) and Firebase Auth
  const isGis = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
  if (isGis) {
    if (!payload.email_verified && payload.email_verified !== 'true' as any) {
      return null;
    }
    // Tag provider for consistent downstream mapping
    if (!payload.firebase) {
      payload.firebase = { sign_in_provider: 'google.com' };
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
  const testKey = (globalThis as any).__TEST_FIREBASE_PUBLIC_KEY__;
  let verifyKey: CryptoKey | null = null;

  if (envName === 'test' && testKey) {
    verifyKey = testKey;
  } else {
    if (!header.kid) return null;
    verifyKey = await getGooglePublicKey(header.kid, isGis);
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
