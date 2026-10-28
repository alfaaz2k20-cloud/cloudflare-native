const CACHE_VERSION = 'alfaaz-pwa-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/blogs.html',
  '/dashboard.html',
  '/exhibition.html',
  '/login.html',
  '/post.html',
  '/register.html',
  '/reset.html',
  '/submit.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/images/favicon.ico',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png',
  '/images/icons/maskable-512.png',
  '/images/slider-1.jpg',
  '/images/slider-2.jpg',
  '/images/slider-3.jpg',
  '/images/slider-4.jpg',
  '/images/slider-5.jpg',
  '/images/slider-6.jpg',
  '/images/slider-7.jpg',
  '/images/slider-8.jpg'
];

const STATIC_DESTINATIONS = new Set(['font', 'image', 'manifest', 'script', 'style', 'worker']);
const NETWORK_FIRST_DESTINATIONS = new Set(['script', 'style', 'worker']);
const THIRD_PARTY_STATIC_HOSTS = new Set(['unpkg.com']);

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(url) {
  if (url.hostname.includes('onrender.com')) return true;
  return isSameOrigin(url) && (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/events/') ||
    url.pathname.startsWith('/exhibitions/') ||
    url.pathname.startsWith('/clubs/') ||
    url.pathname.startsWith('/curator/') ||
    url.pathname.startsWith('/recruit/') ||
    url.pathname.startsWith('/research/') ||
    url.pathname.startsWith('/admin/') ||
    url.pathname.startsWith('/vault/') ||
    url.pathname.startsWith('/phantom/')
  );
}

function shouldCacheStaticRequest(request, url) {
  if (!STATIC_DESTINATIONS.has(request.destination)) return false;
  if (isSameOrigin(url)) return true;
  return THIRD_PARTY_STATIC_HOSTS.has(url.hostname) && ['script', 'style', 'font'].includes(request.destination);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (
      await caches.match(request) ||
      await caches.match('/index.html') ||
      await caches.match('/offline.html')
    );
  }
}

async function networkFirstStatic(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return await cache.match(request) || new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  return await network || new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isApiRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Candidate and admin code must update on the first visit after a deploy.
  if (isSameOrigin(url) && NETWORK_FIRST_DESTINATIONS.has(request.destination)) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  if (shouldCacheStaticRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
