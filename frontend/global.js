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
const TURNSTILE_SITEKEY =
    import.meta.env.VITE_TURNSTILE_SITEKEY || '0x4AAAAAAFsRHzhKR6YGsXSy';

window.ALFAAZ_API_URL = API_URL;
window.ALFAAZ_CLOUDINARY = {
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadPreset: CLOUDINARY_UPLOAD_PRESET
};
window.ALFAAZ_TURNSTILE_SITEKEY = TURNSTILE_SITEKEY;

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
