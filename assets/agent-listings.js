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
      '">Contact ' + esc(first) + '</a></div></div>';
    box.classList.add('lst-done');
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

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('.lst-box'), start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
