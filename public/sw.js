/**
 * Service Worker - VKU Field Survey PWA
 * ======================================
 * Cache Name: vku-field-survey-v2
 * Strategy: Network-First (Online) / Cache-First (Offline)
 * Ensures code updates are served IMMEDIATELY when online.
 */

const CACHE_NAME = 'vku-field-survey-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  console.log('[SW] ⬇️ Installing Service Worker v2...');
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Activate Event: Clear ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] ⚡ Activating Service Worker v2...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] 🗑️ Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bỏ qua dev server HMR / WebSocket requests
  if (
    url.pathname.includes('@vite') ||
    url.pathname.includes('@fs') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('hot-update')
  ) {
    return;
  }

  event.respondWith(handleNetworkFirst(event.request));
});

/**
 * Strategy: Network-First with Cache Fallback
 * Khi Online: Tải mã nguồn mới nhất từ Network và cập nhật Cache.
 * Khi Offline: Trả về tài nguyên đã Cache.
 */
async function handleNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
      });
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, serving from cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate') {
      const fallbackHtml = await caches.match('/index.html');
      if (fallbackHtml) return fallbackHtml;
    }

    return new Response('Offline - Asset unavailable', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}
