/* Inhabit agent pages: each broker's current listings.
   The IDX Broker "Featured Agent" showcase widget loads the listings; this script
   turns them into the site's own listing cards. If a broker has no IDX widget, or
   no homes listed right now, it shows a friendly "browse homes" box instead. */
(function () {
  var SEARCH = 'https://inhabitthetriangle.idxbroker.com/idx/search/basic';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(root, sel) {
    var n = root.querySelector(sel);
    return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function num(s) {
    var m = String(s).match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function empty(box) {
    var first = box.getAttribute('data-first') || 'us';
    box.innerHTML =
      '<div class="lst-empty"><p class="lst-empty-t">' +
      (box.getAttribute('data-widget') ? 'No homes listed right now' : 'Find your next home') + '</p>' +
      '<p>Search every home for sale in the Triangle, then reach out to ' + esc(first) +
      ' about any that catch your eye.</p>' +
      '<div class="btn-row"><a class="btn" href="' + SEARCH + '">Search homes</a>' +
      '<a class="btn ghost" href="' + esc(box.getAttribute('data-contact') || 'contact.html') +
      '">' + (/^mailto:/.test(box.getAttribute('data-contact') || '') ? 'Email ' : 'Contact ') + esc(first) + '</a></div></div>';
    box.classList.add('lst-done');
    finish(box, false);
  }

  /* Past sales: a link to the broker's sold homes on the home search. When a broker
     has no current listings and no past sales, the whole listings section is hidden. */
  function finish(box, hasActive) {
    var sold = box.getAttribute('data-sold');
    var first = box.getAttribute('data-first') || 'our';
    var tile = box.closest('#listings') || box.parentNode;
    if (!hasActive && !sold) {
      if (tile) tile.style.display = 'none';
      Array.prototype.forEach.call(document.querySelectorAll('a[href="#listings"]'), function (a) { a.style.display = 'none'; });
      return;
    }
    if (hasActive) { var e = box.querySelector('.lst-empty'); if (e) e.remove(); }
    if (sold && !box.querySelector('.lst-sold')) {
      var d = document.createElement('div');
      d.className = 'lst-sold';
      d.innerHTML = '<div><h3>Past sales</h3><p>Homes ' + esc(first) + ' has helped sell or buy.</p></div>' +
        '<a class="btn ghost" href="' + esc(sold) + '">See ' + esc(first) + '&rsquo;s past sales &rarr;</a>';
      box.appendChild(d);
    }
  }

  function cards(box, gal) {
    var cells = gal.querySelectorAll('.IDX-showcaseCell');
    if (!cells.length) { empty(box); return; }
    var html = '<ul class="lst-grid">';
    Array.prototype.forEach.call(cells, function (c) {
      var a = c.querySelector('a.IDX-showcaseLink');
      var img = c.querySelector('img.IDX-showcasePhoto');
      var href = a ? a.getAttribute('href').replace(/[?&]widgetReferer=true/, '') : SEARCH;
      var addr = txt(c, '.IDX-showcaseAddress');
      var city = txt(c, '.IDX-showcaseCity');
      var st = txt(c, '.IDX-showcaseStateAbrv') || 'NC';
      var zip = txt(c, '.IDX-showcaseZipcode');
      var status = txt(c, '.IDX-showcaseStatus') || 'Active';
      var beds = num(txt(c, '.IDX-showcaseBeds'));
      var baths = num(txt(c, '.IDX-showcaseBaths'));
      var place = [city, (st + ' ' + zip).trim()].filter(Boolean).join(', ');
      var facts = '';
      if (beds) facts += '<span>' + plural(beds, 'bed', 'beds') + '</span>';
      if (baths) facts += '<span>' + plural(baths, 'bath', 'baths') + '</span>';
      var src = img ? img.getAttribute('src') : '';
      html += '<li class="lst"><div class="lst-photo">' +
        (src ? '<img src="' + esc(src) + '" alt="' + esc(addr + (place ? ', ' + place : '')) + '" loading="lazy">' : '') +
        '<span class="lst-status' + (/pending|contract|contingent/i.test(status) ? ' pending' : '') + '">' + esc(status) + '</span></div>' +
        '<div class="lst-body"><p class="lst-price">' + esc(txt(c, '.IDX-showcasePrice')) + '</p>' +
        '<p class="lst-addr"><a href="' + esc(href) + '">' + esc(addr) + '</a></p>' +
        (place ? '<p class="lst-city">' + esc(place) + '</p>' : '') +
        (facts ? '<p class="lst-facts">' + facts + '</p>' : '') + '</div></li>';
    });
    html += '</ul>';
    var out = document.createElement('div');
    out.className = 'lst-cards';
    out.innerHTML = html;
    gal.style.display = 'none';
    box.appendChild(out);
    box.classList.add('lst-done');
    finish(box, true);
  }

  function start(box) {
    var id = box.getAttribute('data-widget');
    if (!id) { empty(box); return; }
    var tries = 0;
    (function look() {
      var gal = document.getElementById('IDX-showcaseGallery-' + id);
      // The widget adds its row a moment after the gallery box appears.
      if (gal && (gal.querySelector('.IDX-showcaseCell') || tries > 6)) { cards(box, gal); return; }
      if (++tries > 40) { empty(box); return; } // about 10 seconds
      setTimeout(look, 250);
    })();
  }

  function css() {
    if (document.getElementById('lst-sold-css')) return;
    var s = document.createElement('style');
    s.id = 'lst-sold-css';
    s.textContent = '.lst-sold{margin-top:18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 24px;' +
      'background:var(--sand,#efe4cc);border-radius:14px;padding:22px 24px}' +
      '.lst-sold h3{font-family:var(--serif);font-size:1.3rem;color:var(--blue);margin:0 0 4px}' +
      '.lst-sold p{margin:0;max-width:52ch}';
    document.head.appendChild(s);
  }

  function init() {
    css();
    Array.prototype.forEach.call(document.querySelectorAll('.lst-box'), start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
