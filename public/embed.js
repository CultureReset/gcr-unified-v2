/* CyberCheck Book-Now embed — paste on ANY website:
   <script src="https://gulfcoastradar.com/embed.js"
           data-slug="your-business" data-app="booking"
           data-label="Book Now" data-color="#22c3a6"></script>
   Renders a button where the tag sits; opens the business's
   hosted checkout (FareHarbor-style) in a new tab. */
(function () {
  'use strict';
  var me = document.currentScript;
  if (!me) return;
  var slug = me.getAttribute('data-slug');
  var app = me.getAttribute('data-app') || 'booking';
  if (!slug) return;
  var label = me.getAttribute('data-label') || 'Book Now';
  var color = me.getAttribute('data-color') || '#22c3a6';
  var base = (me.src.match(/^https?:\/\/[^/]+/) || ['https://gulfcoastradar.com'])[0];
  var url = base + '/book/' + encodeURIComponent(slug) + '/' + encodeURIComponent(app);
  var ref = me.getAttribute('data-ref');
  if (ref) url += '?ref=' + encodeURIComponent(ref);

  var a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = label;
  a.style.cssText = 'display:inline-block;padding:13px 26px;border-radius:12px;background:' + color +
    ';color:#fff;font-weight:800;font-size:15px;font-family:Inter,-apple-system,sans-serif;' +
    'text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.18);cursor:pointer';
  a.onmouseenter = function () { a.style.filter = 'brightness(1.08)'; };
  a.onmouseleave = function () { a.style.filter = ''; };
  me.parentNode.insertBefore(a, me);
})();
