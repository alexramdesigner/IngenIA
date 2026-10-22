import { projectionScale } from '/packages/shared/projection.mjs';
const stage = document.querySelector('#projection-stage');
const fullscreenButton = document.querySelector('#fullscreen');
function syncFullscreen() {
  const active = Boolean(document.fullscreenElement);
  const label = active ? 'Salir de pantalla completa' : 'Entrar en pantalla completa';
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('aria-label', label);
  fullscreenButton.title = label;
  fit();
}
function fit() {
  const scale = projectionScale(window.innerWidth, window.innerHeight);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', fit);
document.addEventListener('fullscreenchange', syncFullscreen);
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { document.querySelector('#notice').textContent = 'Usa la opción de pantalla completa de tu navegador.'; }
});
syncFullscreen();
