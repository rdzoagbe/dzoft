/* "Book a 20-minute call" buttons: they stay hidden until the booking page link is set below. */
(function () {
  var BOOKING_URL = '';
  if (!/^https:\/\//.test(BOOKING_URL)) return;
  [].forEach.call(document.querySelectorAll('[data-booking]'), function (a) {
    a.href = BOOKING_URL; a.target = '_blank'; a.rel = 'noopener'; a.hidden = false;
  });
})();
