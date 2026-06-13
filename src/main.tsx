import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { applySecureLocalStorage } from './lib/security.ts';
import App from './App.tsx';
import './index.css';

// Ativa a Criptografia de Estado no LocalStorage em nível de ambiente (Camada 3)
applySecureLocalStorage();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // Força atualização imediata do SW
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (err) {
      console.log('SW não suportado');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
