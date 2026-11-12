import { Hono } from 'hono';
import { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate_limit';

const vaultRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const TRUSTED_STORAGE_DOMAINS = [
  'res.cloudinary.com',
  'alfaazcollective.org',
  'www.alfaazcollective.org',
  'tch.alfaazcollective.org'
];

function isValidUrl(val: string, env?: Env): boolean {
  if (!val) return false;
  const s = val.trim();
  if (s.startsWith('/vault/file/')) return true;
  try {
    const parsed = new URL(s);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (TRUSTED_STORAGE_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
      return true;
    }
    // In test and development environments, permit mock domains and loopback
    if (env?.ENV !== 'production') {
      if (
        hostname === 'example.com' ||
        hostname.endsWith('.example.com') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1'
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function validateFileSignature(buffer: ArrayBuffer): { valid: boolean; mimeType: string } {
  if (buffer.byteLength < 4) return { valid: false, mimeType: '' };
  const bytes = new Uint8Array(buffer);

  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) {
    return { valid: true, mimeType: 'application/pdf' };
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { valid: true, mimeType: 'image/png' };
  }
  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { valid: true, mimeType: 'image/webp' };
  }
  // Plain text (validate no null bytes in first 512 bytes)
  const sample = bytes.slice(0, Math.min(bytes.length, 512));
  const hasNullByte = sample.some(b => b === 0);
  if (!hasNullByte) {
    return { valid: true, mimeType: 'text/plain' };
  }

  return { valid: false, mimeType: '' };
}

// POST /vault/submit - Create creative vault submission
vaultRouter.post('/submit', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('content-type') || '';

  let submission_type = '';
  let title = '';
  let file_url = '';
  let note: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    submission_type = (formData.get('submission_type') as string) || '';
    title = (formData.get('title') as string) || '';
    note = (formData.get('note') as string) || null;

    const file = formData.get('file');
    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      const fileObj = file as File;

      // Server-side size cap (20MB)
      if (fileObj.size > 20 * 1024 * 1024) {
        return c.json({ error: 'Vault file exceeds the 20MB limit' }, 400);
      }

      const buffer = await fileObj.arrayBuffer();
      const sigCheck = validateFileSignature(buffer);
      if (!sigCheck.valid) {
        return c.json({ error: 'Unsupported file format. Please upload a genuine PDF, image (JPEG, PNG, WebP), or plain text file.' }, 400);
      }

      if (c.env.VAULT_BUCKET) {
        const emailHashBuf = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${user.email.toLowerCase()}:${c.env.JWT_SECRET || 'alfaaz-vault-salt'}`)
        );
        const userHash = Array.from(new Uint8Array(emailHashBuf))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 16);

        const sanitized = fileObj.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `vault/${userHash}-${crypto.randomUUID()}-${sanitized}`;

        await c.env.VAULT_BUCKET.put(key, buffer, {
          httpMetadata: { contentType: sigCheck.mimeType }
        });
        file_url = `/vault/file/${encodeURIComponent(key)}`;
      } else {
        return c.json({ error: 'Direct file upload requires R2 VAULT_BUCKET to be configured.', detail: 'STORAGE_UNCONFIGURED' }, 503);
      }
    } else {
      file_url = (formData.get('file_url') as string) || '';
    }
  } else {
    const body = await c.req.json().catch(() => ({}));
    submission_type = body.submission_type || '';
    title = body.title || '';
    file_url = body.file_url || '';
    note = body.note || null;
  }

  submission_type = submission_type.trim();
  title = title.trim();
  file_url = file_url.trim();

  if (!submission_type || submission_type.length > 50) {
    return c.json({ error: 'submission_type is required (max 50 chars)' }, 400);
  }
  if (!title || title.length > 200) {
    return c.json({ error: 'title is required (max 200 chars)' }, 400);
  }
  if (!file_url || !isValidUrl(file_url, c.env)) {
    return c.json({ error: 'Valid file_url or file upload is required' }, 400);
  }
  if (note && note.length > 1500) {
    return c.json({ error: 'note must be 1500 characters or fewer' }, 400);
  }

  await c.env.DB.prepare(`
    INSERT INTO submissions (submission_type, title, file_url, note, author_email)
    VALUES (?, ?, ?, ?, ?)
  `).bind(submission_type, title, file_url, note, user.email).run();

  return c.json({ status: 'SUCCESS' });
});

// GET /vault/file/:key - Serve uploaded file from Cloudflare R2 with Strict Ownership Verification
vaultRouter.get('/file/:key{.*}', requireAuth, async (c) => {
  const user = c.get('user');
  const rawKey = c.req.param('key') || '';
  const key = decodeURIComponent(rawKey);
  if (!c.env.VAULT_BUCKET) {
    return c.text('R2 storage bucket not configured in this environment.', 503);
  }

  if (user.status !== 'ADMIN') {
    const emailHashBuf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${user.email.toLowerCase()}:${c.env.JWT_SECRET || 'alfaaz-vault-salt'}`)
    );
    const userHash = Array.from(new Uint8Array(emailHashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);

    const isUserOwnedKey = key.startsWith(`portfolios/${userHash}-`) ||
      key.startsWith(`payment-proofs/${userHash}-`) ||
      key.startsWith(`recent-works/${userHash}-`) ||
      key.startsWith(`vault/${userHash}-`);

    if (!isUserOwnedKey) {
      const [ownedSubmissions, ownedExhibitions] = await Promise.all([
        c.env.DB.prepare(
          'SELECT file_url FROM submissions WHERE LOWER(author_email) = LOWER(?)'
        ).bind(user.email).all<{ file_url: string }>(),
        c.env.DB.prepare(
          'SELECT portfolio_url, payment_proof_url, recent_works_url FROM exhibition_applications WHERE LOWER(user_email) = LOWER(?)'
        ).bind(user.email).all<{ portfolio_url?: string; payment_proof_url?: string; recent_works_url?: string }>()
      ]);

      const encodedPath = `/vault/file/${encodeURIComponent(key)}`;
      const decodedPath = `/vault/file/${key}`;
      const allUrls = [
        ...(ownedSubmissions.results || []).map(r => r.file_url),
        ...(ownedExhibitions.results || []).map(r => r.portfolio_url),
        ...(ownedExhibitions.results || []).map(r => r.payment_proof_url),
        ...(ownedExhibitions.results || []).map(r => r.recent_works_url)
      ].filter(Boolean);

      const isOwner = allUrls.some(stored => {
        const s = stored || '';
        return s === encodedPath || s === decodedPath || decodeURIComponent(s) === decodedPath;
      });

      if (!isOwner) {
        return c.text('File not found in storage vault.', 404);
      }
    }
  }

  const object = await c.env.VAULT_BUCKET.get(key);
  if (!object) {
    return c.text('File not found in storage vault.', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, no-transform');
  headers.set('X-Content-Type-Options', 'nosniff');

  const contentType = (object.httpMetadata?.contentType || '').toLowerCase();
  if (contentType === 'text/html' || contentType === 'image/svg+xml' || contentType === 'application/octet-stream') {
    headers.set('Content-Disposition', 'attachment');
  }

  return new Response(object.body, { headers });
});

export default vaultRouter;
