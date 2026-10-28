import { Hono } from 'hono';
import { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

const vaultRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function isValidUrl(val: string): boolean {
  if (!val) return false;
  const s = val.trim();
  if (s.startsWith('/vault/file/') || s.startsWith('data:')) return true;
  try {
    const parsed = new URL(s);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// POST /vault/submit - Create creative vault submission
vaultRouter.post('/submit', requireAuth, async (c) => {
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
      if (c.env.VAULT_BUCKET) {
        const fileObj = file as File;
        const key = `vault/${Date.now()}-${fileObj.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const buffer = await fileObj.arrayBuffer();
        await c.env.VAULT_BUCKET.put(key, buffer, {
          httpMetadata: { contentType: fileObj.type || 'application/octet-stream' }
        });
        file_url = `/vault/file/${encodeURIComponent(key)}`;
      } else {
        // Fallback: If no R2 bucket bound in dev, encode or use a mock URL
        file_url = `https://mock-storage.alfaaz.local/${(file as File).name}`;
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
  if (!file_url || !isValidUrl(file_url)) {
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

// GET /vault/file/:key - Serve uploaded file from Cloudflare R2
vaultRouter.get('/file/:key{.*}', async (c) => {
  const key = decodeURIComponent(c.req.param('key'));
  if (!c.env.VAULT_BUCKET) {
    return c.text('R2 storage bucket not configured in this environment.', 503);
  }

  const object = await c.env.VAULT_BUCKET.get(key);
  if (!object) {
    return c.text('File not found in storage vault.', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');

  return new Response(object.body, { headers });
});

export default vaultRouter;
