// Registro del service worker y botón «Instalar app» cuando el navegador lo ofrece.
if ('serviceWorker' in navigator) {
  // El registro falla en silencio fuera de HTTPS o localhost; la app sigue funcionando sin él.
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}
let deferred = null;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); deferred = event;
  document.dispatchEvent(new CustomEvent('pwa:installable'));
});
window.addEventListener('appinstalled', () => { deferred = null; document.dispatchEvent(new CustomEvent('pwa:installed')); });
export const canInstall = () => Boolean(deferred);
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export async function install() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === 'accepted';
}
