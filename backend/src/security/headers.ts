/**
 * Single source of truth for response headers.
 *
 * The same values are duplicated into `frontend/public/_headers`, which Cloudflare applies to
 * responses served directly by the static asset router without invoking the Worker. That file
 * cannot import from here, so `tests/static_asset_headers.test.ts` asserts the two agree.
 */

export const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';

export const STATIC_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
  ['Strict-Transport-Security', STRICT_TRANSPORT_SECURITY]
];

const SHARED_SCRIPT_SOURCES =
  'https://unpkg.com https://challenges.cloudflare.com https://apis.google.com https://www.gstatic.com https://accounts.google.com';

function buildCsp(scriptSrc: string): string {
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://*.googleusercontent.com https://www.gstatic.com https://ssl.gstatic.com",
    "media-src 'self' https://res.cloudinary.com",
    "connect-src 'self' https://challenges.cloudflare.com https://api.cloudinary.com https://res.cloudinary.com https://*.googleapis.com https://accounts.google.com",
    "frame-src 'self' https://challenges.cloudflare.com https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

export const STRICT_CSP = buildCsp(`script-src 'self' 'unsafe-inline' ${SHARED_SCRIPT_SOURCES}`);

// recruit.html and research.html load the Tailwind JIT CDN, which compiles CSS in the browser
// and therefore needs 'unsafe-eval'. No other page is granted that allowance.
export const JIT_CSP = buildCsp(
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com ${SHARED_SCRIPT_SOURCES}`
);

// Paths served by the static asset router that are granted the JIT allowance.
export const JIT_ASSET_PATHS: readonly string[] = ['/recruit', '/research'];

export function cspForPath(path: string): string {
  return JIT_ASSET_PATHS.some(p => path.startsWith(p)) ? JIT_CSP : STRICT_CSP;
}
