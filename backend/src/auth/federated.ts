// Web Crypto verification of Google Identity Services (GIS) / direct Google OAuth ID tokens.
// Zero Firebase SDK or external dependency runtime (100% Cloudflare Workers Web Crypto native).

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
  name?: string;
  picture?: string;
  sign_in_provider?: string;
  [key: string]: any;
}

interface CachedKey {
  key: CryptoKey;
  expiresAt: number;
}

const jwkCache = new Map<string, CachedKey>();

const GIS_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

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
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
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
 * Cryptographically verifies a Google Identity Services ID token using Web Crypto RS256.
 * Validates issuer, audience, expiration, algorithm, subject, email verification, and signature.
 *
 * Google is the only accepted issuer. Every other issuer — including the decommissioned Firebase
 * `securetoken.google.com` — is rejected outright instead of routed to a second validation path.
 */
export async function verifyFederatedToken(
  idToken: string,
  expectedClientId: string | undefined,
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

  // Issuer check: Google Identity Services / direct Google OAuth only.
  if (!GIS_ISSUERS.includes(payload.iss)) {
    return null;
  }

  // Strict fail-closed audience validation: the token must have been issued for our own OAuth
  // client ID. A deployment with no client ID configured cannot prove provenance, so it accepts
  // nothing rather than falling back to a guessable default.
  if (!expectedClientId || payload.aud !== expectedClientId) {
    return null;
  }

  // Verified-email gate (AGENTS.md §3): never link or issue a session for an identity whose
  // address Google has not confirmed. Without it an attacker mints a federated identity over a
  // victim's email and hijacks the existing account.
  if (!payload.email_verified && payload.email_verified !== 'true' as any) {
    return null;
  }

  // The issuer is Google, so the provider is Google. Assigned unconditionally rather than
  // inherited from a claim, so no token-supplied value can steer the stored auth_provider.
  payload.sign_in_provider = 'google.com';
  payload.email_verified = true;

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
  const testKey = (globalThis as any).__TEST_FEDERATED_PUBLIC_KEY__;
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
