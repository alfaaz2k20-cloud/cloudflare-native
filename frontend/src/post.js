// post.js — Curatorial Essay Reader & Allowlist Content Sanitizer
document.addEventListener('DOMContentLoaded', () => {

  /**
   * Strict Node-Based Allowlist DOM Sanitizer
   * Safely filters untrusted HTML without vulnerability to mXSS,
   * script execution, SVG/MathML namespace confusion, or inline event handlers.
   */
  function sanitizeEssayContent(rawHtml) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';
    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(rawHtml, 'text/html');

    const ALLOWED_TAGS = new Set([
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
      'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 's', 'span',
      'hr', 'br', 'pre', 'code', 'figure', 'figcaption', 'cite',
      'a', 'img', 'sub', 'sup', 'mark'
    ]);

    const DISCARD_ENTIRELY = new Set([
      'script', 'style', 'iframe', 'object', 'embed', 'form',
      'input', 'button', 'select', 'textarea', 'svg', 'math',
      'template', 'meta', 'link', 'base', 'applet'
    ]);

    const ALLOWED_ATTRS = {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'loading', 'width', 'height'],
      '*': ['class', 'id', 'dir', 'lang']
    };

    function isSafeUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim().toLowerCase();
      // Block all pseudo-protocols
      if (
        trimmed.startsWith('javascript:') ||
        trimmed.startsWith('vbscript:') ||
        trimmed.startsWith('data:text/html') ||
        trimmed.startsWith('data:text/javascript')
      ) {
        return false;
      }
      return (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('mailto:')
      );
    }

    function sanitizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || '');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const tagName = node.tagName.toLowerCase();

      // Drop malicious or interactive tags and their children completely
      if (DISCARD_ENTIRELY.has(tagName)) {
        return null;
      }

      // If tag is not in whitelist, unwrap children safely
      if (!ALLOWED_TAGS.has(tagName)) {
        const fragment = document.createDocumentFragment();
        for (const child of Array.from(node.childNodes)) {
          const cleanedChild = sanitizeNode(child);
          if (cleanedChild) fragment.appendChild(cleanedChild);
        }
        return fragment;
      }

      // Create clean element in target document context
      const cleanEl = document.createElement(tagName);
      const allowedForTag = (ALLOWED_ATTRS[tagName] || []).concat(ALLOWED_ATTRS['*'] || []);

      for (const attr of Array.from(node.attributes)) {
        const attrName = attr.name.toLowerCase();

        // Disallow event handlers and dangerous attributes
        if (attrName.startsWith('on') || attrName === 'srcdoc' || attrName === 'formaction') {
          continue;
        }

        if (allowedForTag.includes(attrName)) {
          let attrValue = attr.value;
          if (attrName === 'href') {
            if (!isSafeUrl(attrValue)) continue;
            cleanEl.setAttribute('rel', 'noopener noreferrer');
            cleanEl.setAttribute('target', '_blank');
          } else if (attrName === 'src') {
            if (tagName === 'img' && attrValue.startsWith('data:image/')) {
              // Safe base64 image data URI
            } else if (!isSafeUrl(attrValue)) {
              continue;
            }
          }
          cleanEl.setAttribute(attrName, attrValue);
        }
      }

      for (const child of Array.from(node.childNodes)) {
        const cleanedChild = sanitizeNode(child);
        if (cleanedChild) cleanEl.appendChild(cleanedChild);
      }

      return cleanEl;
    }

    const outputFragment = document.createDocumentFragment();
    for (const child of Array.from(parsedDoc.body.childNodes)) {
      const cleaned = sanitizeNode(child);
      if (cleaned) outputFragment.appendChild(cleaned);
    }

    const container = document.createElement('div');
    container.appendChild(outputFragment);
    return container.innerHTML;
  }

  function estimateReadingTime(content) {
    if (!content) return '3 min read';
    const textOnly = content.replace(/<[^>]*>/g, ' ');
    const wordCount = textOnly.trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.ceil(wordCount / 180));
    return `${mins} min read`;
  }

  // Reading progress indicator
  function initReadingProgress() {
    const progressBar = document.getElementById('readingProgress');
    if (!progressBar) return;

    window.addEventListener('scroll', () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        progressBar.style.width = '0%';
        return;
      }
      const scrollPct = Math.min(100, Math.max(0, (window.scrollY / docHeight) * 100));
      progressBar.style.width = `${scrollPct}%`;
    }, { passive: true });
  }

  async function loadArticle() {
    const target = document.getElementById('articleTarget');
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!target) return;

    if (!articleId) {
      target.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <p style="color: var(--accent-red-text); font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2rem;">[Error] No essay identifier provided.</p>
          <a href="blogs.html" class="action-btn" style="display:inline-block;">Return to Curated Archives</a>
        </div>
      `;
      return;
    }

    try {
      let res = await window.globalApiFetch(`/api/blogs/${encodeURIComponent(articleId)}`);
      if (!res || !res.ok) {
        res = await window.globalApiFetch(`/blogs/${encodeURIComponent(articleId)}`);
      }
      if (!res || !res.ok) throw new Error(`HTTP ${res?.status || 404}`);

      const article = await res.json();
      const dateStr = window.formatDate ? window.formatDate(article.created_at, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : new Date(article.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const readTime = estimateReadingTime(article.content);
      const safeTitle = window.escapeHtml(article.title);
      const safeHtml = sanitizeEssayContent(article.content);

      // Dynamic Title & Open Graph tags
      document.title = `${article.title} | Curated Archives — Alfaaz`;
      const ogTitle = document.getElementById('ogTitle');
      const twTitle = document.getElementById('twTitle');
      if (ogTitle) ogTitle.setAttribute('content', article.title);
      if (twTitle) twTitle.setAttribute('content', article.title);

      target.innerHTML = `
        <div class="post-header">
          <div class="post-meta-row">
            <span>${dateStr}</span>
            <span>//</span>
            <span>${readTime}</span>
            <span>//</span>
            <span>Curator's Notes</span>
          </div>
          <h1 class="post-title">${safeTitle}</h1>
          <div class="post-actions-bar">
            <button id="copyEssayLinkBtn" class="share-pill-btn">
              <i data-lucide="share-2" style="width: 12px; height: 12px;"></i>
              <span id="copyLinkText">Share Essay</span>
            </button>
            <a href="blogs.html" class="share-pill-btn" style="text-decoration: none;">
              <i data-lucide="arrow-left" style="width: 12px; height: 12px;"></i>
              <span>All Archives</span>
            </a>
          </div>
        </div>

        <div class="post-content">${safeHtml}</div>

        <div class="curator-closing-box">
          <p class="curator-colophon">
            Alfaaz Collective // A bridge between art, literature, and existence.<br>
            Srinagar, Kashmir
          </p>
          <div>
            <a href="blogs.html" class="action-btn gold" style="display: inline-block;">Return to Curated Archives</a>
          </div>
        </div>
      `;

      // Copy link listener
      document.getElementById('copyEssayLinkBtn')?.addEventListener('click', async () => {
        const textSpan = document.getElementById('copyLinkText');
        try {
          await navigator.clipboard.writeText(window.location.href);
          if (textSpan) textSpan.textContent = '✓ Link Copied';
          setTimeout(() => {
            if (textSpan) textSpan.textContent = 'Share Essay';
          }, 2000);
        } catch (_) {
          if (textSpan) textSpan.textContent = 'Link copied to URL bar';
        }
      });

      initReadingProgress();
      if (window.lucide) window.lucide.createIcons();
      if (window.refreshGlobalEffects) window.refreshGlobalEffects();

    } catch (error) {
      console.error('[Article load error]:', error);
      target.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <h2 style="font-family: var(--font-heading); font-size: 2rem; color: var(--text-primary); margin-bottom: 1rem;">Archive Unreachable</h2>
          <p style="font-size: 13px; color: var(--text-secondary); max-width: 480px; margin: 0 auto 2.5rem; line-height: 1.7;">The requested document could not be retrieved from the collective archives. It may have been relocated or is currently restricted.</p>
          <a href="blogs.html" class="action-btn" style="display:inline-block;">Return to Curated Archives</a>
        </div>
      `;
    }
  }

  loadArticle();
});
