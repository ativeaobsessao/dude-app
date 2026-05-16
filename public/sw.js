const CACHE_NAME = 'dude-v4';
let timerInterval = null;
let remainingMs = 0;
let sessionData = { activity: '', project: '' };
let warningFired = false;
let completeFired = false;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('message', (e) => {
  const { type, data } = e.data || {};
  
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'START_TIMER') {
    remainingMs = data.totalMs;
    sessionData = { activity: data.activity, project: data.project };
    warningFired = false;
    completeFired = false;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      remainingMs -= 1000;

      // 5-minute warning (300,000ms)
      if (remainingMs <= 300000 && remainingMs > 299000 && !warningFired) {
        warningFired = true;
        self.registration.showNotification('⏳ Faltam 5 minutos!', {
          body: `${sessionData.activity} — ${sessionData.project}`,
          vibrate: [200, 100, 200],
          tag: 'dude-warning',
          renotify: true,
          requireInteraction: false
        });
      }

      // Completion notification
      if (remainingMs <= 0 && !completeFired) {
        completeFired = true;
        clearInterval(timerInterval);
        self.registration.showNotification('✅ Sessão concluída!', {
          body: `${sessionData.activity} — ${sessionData.project} — Hora de registrar!`,
          vibrate: [300, 100, 300, 100, 500],
          tag: 'dude-complete',
          renotify: true,
          requireInteraction: true
        });

        // Notify React clients
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'TIMER_COMPLETE' }));
        });
      }
    }, 1000);
  }

  if (type === 'PAUSE_TIMER') {
    clearInterval(timerInterval);
  }

  if (type === 'RESUME_TIMER') {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      remainingMs -= 1000;

      if (remainingMs <= 300000 && remainingMs > 299000 && !warningFired) {
        warningFired = true;
        self.registration.showNotification('⏳ Faltam 5 minutos!', {
          body: `${sessionData.activity} — ${sessionData.project}`,
          tag: 'dude-warning',
          renotify: true
        });
      }

      if (remainingMs <= 0 && !completeFired) {
        completeFired = true;
        clearInterval(timerInterval);
        self.registration.showNotification('✅ Sessão concluída!', {
          body: `${sessionData.activity} — ${sessionData.project} — Hora de registrar!`,
          tag: 'dude-complete',
          renotify: true,
          requireInteraction: true
        });

        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'TIMER_COMPLETE' }));
        });
      }
    }, 1000);
  }

  if (type === 'CANCEL_TIMER') {
    clearInterval(timerInterval);
    remainingMs = 0;
    warningFired = false;
    completeFired = false;
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});
