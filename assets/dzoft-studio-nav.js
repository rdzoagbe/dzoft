(() => {
  'use strict';
  const menu = document.getElementById('studio-menu');
  const nav = document.getElementById('studio-navigation');
  if (menu && nav) {
    const close = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
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
