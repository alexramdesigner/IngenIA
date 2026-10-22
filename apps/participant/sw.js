// Service worker de IngenIA. El estado del taller (API y transmisión en vivo) nunca se guarda en caché:
// siempre viene del servidor. Solo se precargan los archivos de la interfaz para abrir rápido y
// mostrar una página sin conexión si se cae la red del auditorio.
const VERSION = 'ingenia-v1';
const SHELL = [
  '/', '/offline.html', '/manifest.webmanifest',
  '/packages/ui/style.css', '/packages/ui/participant.css', '/packages/ui/ambient.css',
  '/packages/ui/app.mjs', '/packages/ui/icons.mjs', '/packages/ui/participant-nav.mjs', '/packages/ui/workshop.mjs', '/packages/ui/qr.mjs',
  '/packages/shared/phases.mjs', '/packages/shared/projects.mjs', '/packages/shared/deliverable-text.mjs',
  '/packages/ui/assets/IMAGOTIPO_HORIZONTAL_BLANCO.png', '/packages/ui/assets/fondo-verde-tecnologico.png', '/packages/ui/assets/icons/icon-192.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;
  // Studio y proyector no se ofrecen sin conexión.
  if (['/studio', '/presenter', '/projector'].includes(url.pathname)) return;
  // Red primero: siempre la versión más reciente; la caché es solo el respaldo sin conexión.
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(VERSION).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(async () => (await caches.match(event.request, { ignoreSearch: true })) ?? (event.request.mode === 'navigate' ? caches.match('/offline.html') : Response.error())));
});
