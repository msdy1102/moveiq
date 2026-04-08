// public/sw.js — MoveIQ Service Worker
// 캐시 전략: Network First (API) + Cache First (정적 자산)
// ─────────────────────────────────────────────────────────────

const CACHE_NAME = 'moveiq-v1';
const STATIC_CACHE = 'moveiq-static-v1';

// 오프라인 폴백 페이지
const OFFLINE_URL = '/offline.html';

// 정적 자산 프리캐시 목록 (Next.js 빌드 후 실제 경로로 갱신됨)
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
];

// API 경로 — 항상 네트워크 우선
const API_ROUTES = ['/api/', '/analysis/', '/noise-map/'];

// ── Install ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // 개별 실패 무시 (offline.html 없을 수 있음)
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 외부 도메인 (Naver Maps, Supabase 등) → 그대로 통과
  if (url.origin !== location.origin) return;

  // POST, DELETE 등 변형 메서드 → 그대로 통과
  if (request.method !== 'GET') return;

  // API 경로 → Network First (오프라인 시 캐시 폴백)
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 정적 자산 (_next/static) → Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 나머지 페이지 → Network First
  event.respondWith(networkFirst(request));
});

// Network First 전략
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // 성공 응답은 캐시에 저장
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // 네트워크 실패 → 캐시 확인
    const cached = await caches.match(request);
    if (cached) return cached;
    // 캐시도 없으면 오프라인 페이지
    if (request.mode === 'navigate') {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    return new Response('오프라인 상태입니다.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// Cache First 전략
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('리소스를 불러올 수 없습니다.', { status: 503 });
  }
}

// ── Push 알림 수신 ───────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: '무브IQ', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title || '🔊 무브IQ 소음 알림', {
      body:    payload.body    || '관심 지역에 새 소음 데이터가 등록되었습니다.',
      icon:    payload.icon   || '/icons/icon-192.png',
      badge:   '/icons/icon-72.png',
      tag:     'moveiq-noise',
      renotify: true,
      data:    { url: payload.url || '/noise-map' },
    })
  );
});

// ── 알림 클릭 ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/noise-map';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
