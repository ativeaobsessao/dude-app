export const sendToServiceWorker = async (type: string, data?: object) => {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  if (registration.active) {
    registration.active.postMessage({ type, data });
  }
};

export const listenToServiceWorker = (callback: (data: any) => void) => {
  if (!('serviceWorker' in navigator)) return () => {};
  const handler = (e: MessageEvent) => callback(e.data);
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
};
