(() => {
  'use strict';
  // Navigation hint only: the dashboard still enforces its own authentication.
  try {
    const requested = new URLSearchParams(location.search).get('workspace');
    if (requested === 'admin') sessionStorage.setItem('dzoft-return-workspace', 'admin');
    if (sessionStorage.getItem('dzoft-return-workspace') === 'admin') {
      const link = document.querySelector('.studio-login');
      if (link) {
        const english = document.documentElement.lang === 'en';
        link.href = new URL(english ? '../admin/' : 'admin/', new URL(document.querySelector('.studio-brand').getAttribute('href'), location.href).href).href;
        link.textContent = english ? 'Back to dashboard' : 'Retour au tableau de bord';
      }
    }
  } catch (_) { /* Navigation remains usable if browser storage is unavailable. */ }
  const menu = document.getElementById('studio-menu');
  const nav = document.getElementById('studio-navigation');
  if (menu && nav) {
    const close = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
    document.addEventListener('focusin', event => { if (!event.target.closest('.studio-header')) close(); });
    window.matchMedia('(max-width: 760px)').addEventListener('change', close);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) { close(); menu.focus(); }
    });
    document.addEventListener('click', event => { if (!event.target.closest('.studio-header')) close(); });
  }
  // Keep historical homepage anchors working after moving content to pages.
  if (/\/$|\/index\.html$/.test(location.pathname)) {
    const en = /\/en\//.test(location.pathname);
    const destinations = {services:'services.html',methode:'methode.html',faq:'faq.html',devis:en?'quote.html':'devis.html',contact:en?'quote.html':'devis.html',realisations:'realisations.html'};
    const destination = destinations[location.hash.slice(1)];
    if (destination) location.replace(destination);
  }
})();
