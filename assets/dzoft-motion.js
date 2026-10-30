(function () {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var selectors = [
    '.dzoft-public main > section:not(.hero):not(.cta):not(.contact) .head',
    '.dzoft-public .svc', '.dzoft-public .work', '.dzoft-public .case',
    '.dzoft-public .demo-c', '.dzoft-public .steps li', '.dzoft-public .faq details',
    '.dzoft-public .care', '.dzoft-public .fine'
  ];
  var targets = document.querySelectorAll(selectors.join(','));
  if (!targets.length) return;

  document.documentElement.classList.add('dzoft-motion-ready');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('dzoft-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });

  targets.forEach(function (target, index) {
    target.classList.add('dzoft-reveal');
    if (index % 3 === 1) target.classList.add('dzoft-delay-1');
    if (index % 3 === 2) target.classList.add('dzoft-delay-2');
    observer.observe(target);
  });
}());
