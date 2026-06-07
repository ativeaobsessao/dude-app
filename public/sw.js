const CACHE_NAME = 'dude-v7';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
  '/logo-dude-oficial.svg'
];

let sessionData = { activity: '', project: '', endTime: 0 };
let warningFired = false;
let completeFired = false;
let checkTimeout = null;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.error('PWA early pre-caching failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old Cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isDynamicAPI = url.pathname.startsWith('/api') || 
                       url.hostname.includes('supabase') || 
                       url.hostname.includes('googleapis');

  if (isDynamicAPI) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (e.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

function scheduleCheck() {
  if (checkTimeout) clearTimeout(checkTimeout);
  
  const remaining = sessionData.endTime - Date.now();
  
  checkTimeout = setTimeout(() => {
    const now = Date.now();
    const r = sessionData.endTime - now;

    if (r <= 0) {
      if (!completeFired) {
        completeFired = true;
        self.registration.showNotification('✅ Sessão concluída!', {
          body: `${sessionData.activity} — ${sessionData.project} — Hora de registrar!`,
          icon: '/dude-icon-192.png',
          badge: '/dude-icon-192.png',
          vibrate: [500, 200, 500, 200, 500, 200, 800],
          tag: 'dude-complete',
          renotify: true,
          requireInteraction: true,
          silent: false
        });
        self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'TIMER_COMPLETE' }));
        });
      }
      return;
    }

    // Aviso de 5 minutos
    if (r <= 300000 && !warningFired) {
      warningFired = true;
      self.registration.showNotification('⏳ Faltam 5 minutos!', {
        body: `${sessionData.activity} — ${sessionData.project}`,
        icon: '/dude-icon-192.png',
        badge: '/dude-icon-192.png',
        vibrate: [400, 150, 400, 150, 400],
        tag: 'dude-warning',
        renotify: true,
        requireInteraction: false,
        silent: false
      });
    }

    // Agenda próxima verificação
    scheduleCheck();
  }, remaining <= 300000 ? 15000 : 30000);
}

self.addEventListener('message', (e) => {
  const { type, data } = e.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (type === 'START_TIMER') {
    if (checkTimeout) clearTimeout(checkTimeout);
    
    const endTime = Date.now() + data.totalMs;
    sessionData = {
      activity: data.activity || 'Sessão',
      project: data.project || 'Geral',
      endTime: endTime
    };
    
    // CORREÇÃO: nunca pula o aviso de 5 min automaticamente
    warningFired = false;
    completeFired = false;
    
    // Agenda verificação imediata
    scheduleCheck();
    
    // Mantém SW vivo no Android
    self.registration.sync?.register('keep-alive').catch(() => {});
  }

  if (type === 'PAUSE_TIMER') {
    if (checkTimeout) clearTimeout(checkTimeout);
  }

  if (type === 'RESUME_TIMER') {
    scheduleCheck();
  }

  if (type === 'CANCEL_TIMER') {
    if (checkTimeout) clearTimeout(checkTimeout);
    sessionData = { activity: '', project: '', endTime: 0 };
    warningFired = false;
    completeFired = false;
  }

  if (type === 'SYNC_TIMER') {
    if (data?.endTime && !completeFired) {
      sessionData.endTime = data.endTime;
      sessionData.activity = data.activity || sessionData.activity;
      sessionData.project = data.project || sessionData.project;
    }
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});

// Mantém SW vivo respondendo ao sync
self.addEventListener('sync', (e) => {
  if (e.tag === 'keep-alive') {
    e.waitUntil(Promise.resolve());
  }
});
