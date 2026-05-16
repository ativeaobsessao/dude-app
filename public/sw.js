const CACHE_NAME = 'dude-v5';
let sessionData = { activity: '', project: '', endTime: 0 };
let warningFired = false;
let completeFired = false;
let checkInterval = null;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

function startChecking() {
  if (checkInterval) clearInterval(checkInterval);
  
  checkInterval = setInterval(() => {
    const now = Date.now();
    const remaining = sessionData.endTime - now;

    if (remaining <= 300000 && remaining > 295000 && !warningFired) {
      warningFired = true;
      self.registration.showNotification('⏳ Faltam 5 minutos!', {
        body: `${sessionData.activity} — ${sessionData.project}`,
        icon: '/dude-icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'dude-warning',
        renotify: true,
        requireInteraction: false,
        silent: false
      });
    }

    if (remaining <= 0 && !completeFired) {
      completeFired = true;
      clearInterval(checkInterval);
      self.registration.showNotification('✅ Sessão concluída!', {
        body: `${sessionData.activity} — ${sessionData.project} — Hora de registrar!`,
        icon: '/dude-icon-192.png',
        vibrate: [300, 100, 300, 100, 500],
        tag: 'dude-complete',
        renotify: true,
        requireInteraction: true,
        silent: false
      });
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'TIMER_COMPLETE' }));
      });
    }
  }, 10000); // Checa a cada 10 segundos — mais resistente ao Android
}

self.addEventListener('message', (e) => {
  const { type, data } = e.data || {};

  if (type === 'SKIP_WAITING') self.skipWaiting();

  if (type === 'START_TIMER') {
    // Usa timestamp absoluto — não reseta se o app reabrir
    const endTime = Date.now() + data.totalMs;
    sessionData = {
      activity: data.activity,
      project: data.project,
      endTime: endTime
    };
    warningFired = data.totalMs <= 300000; // Se sessão < 5min, pula aviso
    completeFired = false;
    
    // Salva no storage para recuperar se SW reiniciar
    self.registration.sync?.register('timer-sync').catch(() => {});
    startChecking();
  }

  if (type === 'PAUSE_TIMER') {
    clearInterval(checkInterval);
    // Salva o endTime atual para retomar depois
    sessionData.endTime = Date.now() + (sessionData.endTime - Date.now());
  }

  if (type === 'RESUME_TIMER') {
    startChecking();
  }

  if (type === 'CANCEL_TIMER') {
    clearInterval(checkInterval);
    sessionData = { activity: '', project: '', endTime: 0 };
    warningFired = false;
    completeFired = false;
  }

  if (type === 'SYNC_TIMER') {
    // React sincroniza o endTime real periodicamente
    if (data.endTime && !completeFired) {
      sessionData.endTime = data.endTime;
      sessionData.activity = data.activity;
      sessionData.project = data.project;
    }
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) clients[0].focus();
      else self.clients.openWindow('/');
    })
  );
});
