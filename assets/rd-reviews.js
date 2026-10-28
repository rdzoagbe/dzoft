/* Published client reviews (left from the client space, published from the admin).
   Fills <section id="avis-clients"> and keeps it hidden while there is none. */
(function () {
  var box = document.getElementById('avis-clients');
  var sb = window.RDsb;
  if (!box || !sb) return;
  var en = document.documentElement.lang === 'en';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var css = document.createElement('style');
  css.textContent = '.rv-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}' +
    '.rv{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:10px}' +
    '.rv .st{color:#f5a623;font-size:19px;letter-spacing:2px}' +
    '.rv blockquote{color:var(--ink);font-size:15.5px;white-space:pre-wrap}' +
    '.rv .by{margin-top:auto;font-size:14px;color:var(--mute)}.rv .by b{color:var(--ink)}' +
    '.rv .re{font-size:14px;color:var(--ink2);background:var(--soft);border-radius:10px;padding:10px 12px}' +
    '#avis-clients .fine{margin-top:18px;font-size:13.5px;color:var(--mute)}';
  document.head.appendChild(css);
  sb.rpc('public_reviews').then(function (list) {
    list = list || [];
    if (!list.length) return;
    var avg = list.reduce(function (t, r) { return t + r.rating; }, 0) / list.length;
    var sum = box.querySelector('.rv-sum');
    if (sum) sum.textContent = en ? 'Average rating: ' + avg.toFixed(1) + ' / 5, from ' + list.length + (list.length > 1 ? ' reviews.' : ' review.') :
      'Note moyenne : ' + avg.toFixed(1).replace('.', ',') + ' / 5, sur ' + list.length + ' avis.';
    box.querySelector('.rv-list').innerHTML = list.map(function (r) {
      var d = new Date(r.at).toLocaleDateString(en ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      return '<figure class="rv"><div class="st" role="img" aria-label="' + r.rating + (en ? ' out of 5' : ' sur 5') + '">' + '★★★★★'.slice(0, r.rating) + '☆☆☆☆☆'.slice(0, 5 - r.rating) + '</div>' +
        '<blockquote>' + esc(r.body) + '</blockquote>' +
        (r.reply ? '<p class="re"><b>' + (en ? 'Reply from Roland:' : 'Réponse de Roland :') + '</b> ' + esc(r.reply) + '</p>' : '') +
        '<figcaption class="by"><b>' + esc(r.name) + '</b>' + (r.activity ? ' · ' + esc(r.activity) : '') + (en ? ' · ' : ' · avis du ') + esc(d) + '</figcaption></figure>';
    }).join('');
    box.hidden = false;
  }, function () {});
})();
