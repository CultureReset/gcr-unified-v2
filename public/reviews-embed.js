/* ============================================================
   CyberCheck Reviews — paste-anywhere embed widget.
   Any website can show a business's VERIFIED reviews:

     <script src="https://gulfcoastradar.com/reviews-embed.js"
             data-slug="your-business"></script>

   Options (all optional):
     data-slug     business slug (required)
     data-layout   "list" (default) | "badge"  (compact star badge)
     data-theme    "light" | "dark" | "auto" (default)
     data-max      max reviews to show (default 6)
     data-accent   hex color override
     data-target   id of an element to render into (else renders inline)
     data-api      API base (default https://gcr-api-clean.vercel.app)

   Self-contained: no dependencies, scoped .ccr- styles, open CORS.
   ============================================================ */
(function () {
  'use strict';
  // currentScript works for a pasted <script> tag; fall back to scanning
  // for our own tag when the script was injected dynamically (e.g. sandbox)
  var me = document.currentScript;
  if (!me) {
    var ss = document.querySelectorAll('script[src*="reviews-embed.js"]');
    for (var i = ss.length - 1; i >= 0; i--) { if (!ss[i].__ccrDone) { me = ss[i]; break; } }
  }
  if (!me) return;
  me.__ccrDone = true;
  var slug = me.getAttribute('data-slug');
  if (!slug) { console.warn('[cc-reviews] data-slug is required'); return; }
  var layout = (me.getAttribute('data-layout') || 'list').toLowerCase();
  var theme = (me.getAttribute('data-theme') || 'auto').toLowerCase();
  var max = parseInt(me.getAttribute('data-max'), 10) || 6;
  var accent = me.getAttribute('data-accent') || '#0f9d84';
  var api = (me.getAttribute('data-api') || 'https://gcr-api-clean.vercel.app').replace(/\/$/, '');
  var base = (me.src.match(/^https?:\/\/[^/]+/) || ['https://gulfcoastradar.com'])[0];

  // one shared stylesheet, injected once
  if (!document.getElementById('ccr-style')) {
    var st = document.createElement('style');
    st.id = 'ccr-style';
    st.textContent = [
      '.ccr{--ccr-bg:#fff;--ccr-fg:#1d2329;--ccr-mut:#66758a;--ccr-line:#e6e0d8;--ccr-card:#faf9f7;',
      'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:var(--ccr-fg);max-width:640px}',
      '.ccr[data-t="dark"]{--ccr-bg:#12181f;--ccr-fg:#e8edf0;--ccr-mut:#8fa0ab;--ccr-line:#243039;--ccr-card:#0f151d}',
      '.ccr *{box-sizing:border-box}',
      '.ccr-hd{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--ccr-line);border-radius:14px;background:var(--ccr-bg)}',
      '.ccr-avg{font-size:30px;font-weight:800;line-height:1;letter-spacing:-.02em}',
      '.ccr-st{color:#f5a623;font-size:16px;letter-spacing:2px}',
      '.ccr-sub{font-size:12.5px;color:var(--ccr-mut);margin-top:2px}',
      '.ccr-vf{margin-left:auto;font-size:11px;font-weight:800;color:#fff;background:' + accent + ';padding:5px 10px;border-radius:999px;white-space:nowrap}',
      '.ccr-list{display:flex;flex-direction:column;gap:10px;margin-top:10px}',
      '.ccr-card{border:1px solid var(--ccr-line);border-radius:14px;padding:13px 15px;background:var(--ccr-card)}',
      '.ccr-crow{display:flex;align-items:center;gap:8px}',
      '.ccr-nm{font-weight:700;font-size:14px}',
      '.ccr-cst{color:#f5a623;font-size:13px;letter-spacing:1px}',
      '.ccr-badge{margin-left:auto;font-size:10px;font-weight:800;color:' + accent + '}',
      '.ccr-tx{font-size:13.5px;line-height:1.55;color:var(--ccr-fg);margin:7px 0 0}',
      '.ccr-when{font-size:11px;color:var(--ccr-mut);margin-top:6px}',
      '.ccr-ft{text-align:center;font-size:11px;color:var(--ccr-mut);padding:10px 0 2px}',
      '.ccr-ft a{color:var(--ccr-mut);font-weight:700;text-decoration:none}',
      '.ccr-badgewrap{display:inline-flex;align-items:center;gap:9px;border:1px solid var(--ccr-line);border-radius:999px;padding:8px 14px;background:var(--ccr-bg);text-decoration:none;color:var(--ccr-fg)}',
      '.ccr-badgewrap .ccr-avg{font-size:19px}',
      '.ccr-badgewrap .ccr-st{font-size:13px}'
    ].join('');
    document.head.appendChild(st);
  }

  var host = me.getAttribute('data-target') ? document.getElementById(me.getAttribute('data-target')) : null;
  var mount = document.createElement('div');
  mount.className = 'ccr';
  mount.setAttribute('data-t', theme === 'dark' ? 'dark' : theme === 'light' ? 'light'
    : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  if (host) host.appendChild(mount); else me.parentNode.insertBefore(mount, me);

  function stars(n) {
    n = Math.round(n);
    return '★★★★★'.slice(0, n) + '<span style="opacity:.28">' + '★★★★★'.slice(0, 5 - n) + '</span>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ago(iso) {
    if (!iso) return '';
    var d = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (d < 1) return 'today'; if (d < 2) return 'yesterday';
    if (d < 30) return Math.floor(d) + ' days ago';
    if (d < 365) return Math.floor(d / 30) + ' months ago';
    return Math.floor(d / 365) + ' years ago';
  }

  fetch(api + '/api/platform/reviews/' + encodeURIComponent(slug))
    .then(function (r) { if (!r.ok) throw new Error('not found'); return r.json(); })
    .then(function (d) {
      var wall = base + '/reviews/' + encodeURIComponent(slug);
      if (!d.count) { mount.innerHTML = '<div class="ccr-hd"><div><div class="ccr-nm">No reviews yet</div><div class="ccr-sub">Be the first to leave one.</div></div></div>'; return; }

      if (layout === 'badge') {
        mount.innerHTML = '<a class="ccr-badgewrap" href="' + wall + '" target="_blank" rel="noopener">' +
          '<span class="ccr-avg">' + d.average.toFixed(1) + '</span>' +
          '<span><span class="ccr-st">' + stars(d.average) + '</span>' +
          '<div class="ccr-sub">' + d.count + ' review' + (d.count > 1 ? 's' : '') + (d.verified_count ? ' · ' + d.verified_count + ' verified' : '') + '</div></span></a>';
        return;
      }

      var cards = (d.reviews || []).slice(0, max).map(function (r) {
        var verified = /verified/i.test(r.badge || '') && !/unverified/i.test(r.badge || '');
        return '<div class="ccr-card"><div class="ccr-crow">' +
          '<span class="ccr-nm">' + esc(r.name) + '</span>' +
          '<span class="ccr-cst">' + stars(r.stars) + '</span>' +
          (verified ? '<span class="ccr-badge">✓ Verified</span>' : '') +
          '</div>' + (r.text ? '<p class="ccr-tx">' + esc(r.text) + '</p>' : '') +
          '<div class="ccr-when">' + ago(r.when) + '</div></div>';
      }).join('');

      mount.innerHTML =
        '<div class="ccr-hd"><div class="ccr-avg">' + d.average.toFixed(1) + '</div>' +
        '<div><div class="ccr-st">' + stars(d.average) + '</div>' +
        '<div class="ccr-sub">Based on ' + d.count + ' review' + (d.count > 1 ? 's' : '') + '</div></div>' +
        (d.verified_count ? '<span class="ccr-vf">✓ ' + d.verified_count + ' verified</span>' : '') + '</div>' +
        '<div class="ccr-list">' + cards + '</div>' +
        '<div class="ccr-ft">Verified by <a href="' + wall + '" target="_blank" rel="noopener">CyberCheck Reviews</a></div>';
    })
    .catch(function () {
      mount.innerHTML = '<div class="ccr-hd"><div class="ccr-sub">Reviews unavailable right now.</div></div>';
    });
})();
