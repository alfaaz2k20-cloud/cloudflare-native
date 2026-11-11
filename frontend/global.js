/* ========================================
   ALFAAZ COLLECTIVE — GLOBAL SCRIPTS
======================================== */

// 1. Master Configuration
const API_URL =
    import.meta.env.VITE_API_BASE_URL !== undefined
        ? import.meta.env.VITE_API_BASE_URL
        : (import.meta.env.VITE_API_URL || '');
const CLOUDINARY_CLOUD_NAME =
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dmqwjpmjk';
const CLOUDINARY_UPLOAD_PRESET =
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'alfaaz_vault';
const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
);
const TURNSTILE_SITEKEY =
    import.meta.env.VITE_TURNSTILE_SITEKEY ||
    (isLocalhost ? '1x00000000000000000000AA' : '0x4AAAAAAFsRHzhKR6YGsXSy');

window.ALFAAZ_API_URL = API_URL;
window.ALFAAZ_CLOUDINARY = {
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadPreset: CLOUDINARY_UPLOAD_PRESET
};
window.ALFAAZ_TURNSTILE_SITEKEY = TURNSTILE_SITEKEY;
window.ALFAAZ_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

window.escapeHtml = function(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

window.safeHttpUrl = function(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    try {
        const parsed = new URL(trimmed, window.location.origin);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch (e) {
        return null;
    }
    return null;
};

// 2. Global Fetch Wrapper (Cloudflare Edge Native — Zero Cold-Start)
window.globalApiFetch = async function(endpoint, options = {}) {
    const token = localStorage.getItem('alfaaz_token');
    const headers = {};
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...(options.headers || {}) }
        });

        if (response.status === 401) {
            const authPages = ['login.html', 'register.html', 'reset.html', 'recruit.html'];
            const isAuthPage = authPages.some(page => window.location.pathname.endsWith(page));
            if (!isAuthPage) {
                localStorage.removeItem('alfaaz_token');
                localStorage.removeItem('alfaaz_user');
                window.location.href = '/login.html';
                return response;
            }
        }
        return response;
    } catch (error) {
        console.error("API fetch error:", error);
        throw error;
    }
};

// 4. Master UI Binding
window.refreshGlobalEffects = function() {
    if (window.lucide) { window.lucide.createIcons(); }
};

const CURATOR_HISTORY_KEY = 'alfaaz_curator_history';
const CURATOR_HISTORY_LIMIT = 12;

function readCuratorHistory() {
    try {
        const raw = sessionStorage.getItem(CURATOR_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
            .map((item) => ({ role: item.role, content: item.content.slice(0, 1000) }))
            .slice(-CURATOR_HISTORY_LIMIT);
    } catch (error) {
        return [];
    }
}

function writeCuratorHistory(history) {
    try {
        sessionStorage.setItem(CURATOR_HISTORY_KEY, JSON.stringify(history.slice(-CURATOR_HISTORY_LIMIT)));
    } catch (error) {}
}

window.alfaazCuratorMemory = {
    history: readCuratorHistory,
    add(role, content) {
        if (!['user', 'assistant'].includes(role) || !content) return;
        const history = readCuratorHistory();
        history.push({ role, content: String(content).slice(0, 1000) });
        writeCuratorHistory(history);
    },
    clear() {
        try {
            sessionStorage.removeItem(CURATOR_HISTORY_KEY);
        } catch (error) {}
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.refreshGlobalEffects();

    const navbar = document.getElementById('navbar');
    if (navbar) {
        let lastY = window.scrollY;
        window.addEventListener('scroll', () => {
            const currentY = window.scrollY;
            if (currentY > 80) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');

            if (currentY > lastY && currentY > 120) navbar.classList.add('hidden');
            else navbar.classList.remove('hidden');

            lastY = currentY;
        }, { passive: true });
    }
});

// 5. Staggered Cascading Translations
(function() {
  function startLanguageCycle() {
    const bilingualElements = document.querySelectorAll('.ur-hover');
    if (bilingualElements.length === 0) return;

    // Respect user's motion preferences: do not run automated flipping if reduced motion is requested
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    setInterval(() => {
      bilingualElements.forEach((el, index) => {
        setTimeout(() => {
          el.classList.toggle('lang-swapped');
        }, index * 80);
      });
    }, 7500);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', startLanguageCycle); }
  else { startLanguageCycle(); }
})();

// 6. PWA service worker registration
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => {
        console.warn('[ALFAAZ] Service worker registration failed:', error);
      });
  });
}

// 7. Offline Resilience & Edge Status Handling
(function() {
  const BANNER_ID = 'alfaaz-offline-banner';

  function createOfflineBanner() {
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.setAttribute('role', 'alert');
      banner.setAttribute('aria-live', 'assertive');
      banner.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'right: 0',
        'z-index: 10000',
        'background: #2d312e',
        'color: #f4f1ea',
        'padding: 0.55rem 1rem',
        'text-align: center',
        'font-family: var(--font-body, "Alegreya Sans", sans-serif)',
        'font-size: 0.78rem',
        'font-weight: 600',
        'letter-spacing: 0.14em',
        'text-transform: uppercase',
        'border-bottom: 1px solid #8c6d3b',
        'transition: opacity 0.3s ease, transform 0.3s ease',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'gap: 0.6rem'
      ].join(';');
      document.body.prepend(banner);
    }
    banner.style.background = '#2d312e';
    banner.style.opacity = '1';
    banner.style.transform = 'translateY(0)';
    banner.innerHTML = '<span style="color:#bd6f5d; font-size:1rem; line-height:1;">●</span> <span>Offline Archive Active // رابطہ منقطع ہے — Live Submissions Paused</span>';
  }

  function removeOfflineBanner(restored = true) {
    const banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    if (restored) {
      banner.style.background = '#3e5c46';
      banner.innerHTML = '<span style="color:#9fd6a8; font-size:1rem; line-height:1;">✓</span> <span>Connection Restored // رابطہ بحال ہوا — Live Operations Ready</span>';
      setTimeout(() => {
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-100%)';
        setTimeout(() => banner.remove(), 350);
      }, 2500);
    } else {
      banner.remove();
    }
  }

  function setSubmitButtonsState(disabled) {
    const submitElements = document.querySelectorAll('form button[type="submit"], form input[type="submit"], button[data-submit]');
    submitElements.forEach((btn) => {
      if (disabled) {
        if (!btn.disabled) {
          btn.setAttribute('data-offline-disabled', 'true');
          btn.disabled = true;
          if (btn.title) btn.setAttribute('data-prev-title', btn.title);
          btn.title = 'Offline: Network connection required to submit';
        }
      } else {
        if (btn.getAttribute('data-offline-disabled') === 'true') {
          btn.removeAttribute('data-offline-disabled');
          btn.disabled = false;
          if (btn.hasAttribute('data-prev-title')) {
            btn.title = btn.getAttribute('data-prev-title');
            btn.removeAttribute('data-prev-title');
          } else {
            btn.removeAttribute('title');
          }
        }
      }
    });
  }

  function onOffline() {
    createOfflineBanner();
    setSubmitButtonsState(true);
  }

  function onOnline() {
    removeOfflineBanner(true);
    setSubmitButtonsState(false);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onOffline);
      } else {
        onOffline();
      }
    }
  }
})();

