export function setupParticipantNav(nav) {
  const enabled = () => document.body.dataset.screen === 'activity';
  document.addEventListener('participant:screen', event => {
    const selected = ['workshop','survey'].includes(event.detail) ? 'activities' : event.detail;
    for (const button of nav.querySelectorAll('[data-destination]')) {
      if (button.dataset.destination === selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  });
  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-destination]');
    if (!button || !enabled()) return;
    document.dispatchEvent(new CustomEvent('participant:navigate', { detail: button.dataset.destination }));
  });
}
