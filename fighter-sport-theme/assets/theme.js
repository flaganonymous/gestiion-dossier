/* ==========================================================================
   FIGHTER ARENA — theme.js (vanilla, sans dépendance)
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var routes = window.theme.routes;
  var strings = window.theme.strings;

  /* ---------------- Toast ---------------- */
  var toastTimer;
  function toast(msg) {
    var el = $('[data-toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2600);
  }

  /* ---------------- Body lock helpers ---------------- */
  function lock(on) { document.documentElement.style.overflow = on ? 'hidden' : ''; }

  /* ---------------- Header : scroll state, hide on scroll down ---------------- */
  var header = $('[data-header]');
  if (header) {
    var lastY = 0;
    var onScroll = function () {
      var y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      header.classList.toggle('is-hidden', y > lastY && y > 400);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Highlight active brand in brand bar */
  $$('[data-brand-link]').forEach(function (a) {
    if (String(window.activeUniverse || 0) === a.getAttribute('data-brand-link')) a.classList.add('is-active');
  });

  /* ---------------- Mobile menu ---------------- */
  var menu = $('[data-menu-drawer]');
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-menu-open]') && menu) { menu.classList.add('is-open'); lock(true); }
    if (e.target.closest('[data-menu-close]') && menu) { menu.classList.remove('is-open'); lock(false); }
  });

  /* ---------------- Modals ---------------- */
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-modal-open]');
    if (opener) {
      var m = $('[data-modal="' + opener.getAttribute('data-modal-open') + '"]');
      if (m) { m.classList.add('is-open'); lock(true); }
    }
    if (e.target.closest('[data-modal-close]') || e.target.classList.contains('modal')) {
      $$('.modal.is-open').forEach(function (m) { m.classList.remove('is-open'); });
      lock(false);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    $$('.modal.is-open, .drawer.is-open, .menu-drawer.is-open, .search-overlay.is-open, .filters.is-open').forEach(function (el) { el.classList.remove('is-open'); });
    lock(false);
  });

  /* ---------------- Cart (AJAX + Section Rendering API) ---------------- */
  var drawer = $('[data-cart-drawer]');

  function openCart() {
    if (window.theme.cartType !== 'drawer' || !drawer) { window.location.href = routes.cart; return; }
    drawer.classList.add('is-open');
    lock(true);
  }
  function closeCart() { if (drawer) { drawer.classList.remove('is-open'); lock(false); } }

  function refreshCart() {
    return fetch(routes.root + '?sections=cart-drawer')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var html = new DOMParser().parseFromString(data['cart-drawer'], 'text/html');
        var fresh = html.querySelector('[data-cart-drawer]');
        if (fresh && drawer) {
          drawer.querySelector('.drawer__panel').innerHTML = fresh.querySelector('.drawer__panel').innerHTML;
        }
        return fetch(routes.cart + '.js').then(function (r) { return r.json(); });
      })
      .then(function (cart) {
        $$('[data-cart-count]').forEach(function (el) {
          el.textContent = cart.item_count > 0 ? cart.item_count : '';
          el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
        });
        return cart;
      });
  }

  function addToCart(items, button) {
    if (button) { button.setAttribute('aria-disabled', 'true'); }
    return fetch(routes.cartAdd + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
      .then(function () { return refreshCart(); })
      .then(function () {
        toast(strings.added);
        if (window.theme.cartType === 'drawer') openCart();
        else window.location.href = routes.cart;
      })
      .catch(function (err) { toast((err && (err.description || err.message)) || 'Erreur'); })
      .finally(function () { if (button) button.removeAttribute('aria-disabled'); });
  }

  function changeLine(key, qty) {
    if (drawer) drawer.classList.add('collection-loading');
    return fetch(routes.cartChange + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity: qty })
    })
      .then(function () {
        if ($('[data-cart-page]')) { window.location.reload(); return; }
        return refreshCart();
      })
      .finally(function () { if (drawer) drawer.classList.remove('collection-loading'); });
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-cart-open]');
    if (opener && window.theme.cartType === 'drawer' && drawer) { e.preventDefault(); openCart(); }
    if (e.target.closest('[data-cart-close]')) closeCart();

    var quick = e.target.closest('[data-quick-add]');
    if (quick) {
      e.preventDefault();
      addToCart([{ id: Number(quick.getAttribute('data-quick-add')), quantity: 1 }], quick);
    }

    var line = e.target.closest('[data-line-change]');
    if (line) changeLine(line.getAttribute('data-line-change'), Number(line.getAttribute('data-qty-target')));

    var copy = e.target.closest('[data-copy]');
    if (copy && navigator.clipboard) {
      navigator.clipboard.writeText(copy.getAttribute('data-copy')).then(function () { toast('Code copié : ' + copy.getAttribute('data-copy')); });
    }
  });

  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-line-input]');
    if (input) changeLine(input.getAttribute('data-line-input'), Math.max(0, parseInt(input.value, 10) || 0));
  });

  /* ---------------- Product page ---------------- */
  $$('[data-product-section]').forEach(function (section) {
    var jsonEl = $('[data-product-json]', section);
    if (!jsonEl) return;
    var data = JSON.parse(jsonEl.textContent);
    var form = $('[data-product-form]', section);
    var idInput = $('[data-variant-id]', section);
    var atc = $('[data-add-to-cart]', section);
    var atcLabel = $('[data-atc-label]', section);
    var stock = $('[data-stock]', section);
    var sticky = $('[data-sticky-atc]', section);
    var gallery = $('[data-gallery]', section);

    function selectedOptions() {
      var picker = $('[data-variant-picker]', section);
      if (!picker) return null;
      var opts = [];
      $$('fieldset', picker).forEach(function (fs, i) {
        var checked = $('input:checked', fs);
        opts[i] = checked ? checked.value : null;
      });
      return opts;
    }

    function findVariant(opts) {
      return data.variants.find(function (v) {
        return v.options.every(function (o, i) { return o === opts[i]; });
      });
    }

    function markAvailability(opts) {
      // grise les valeurs qui, combinées aux autres options choisies, sont indisponibles
      var picker = $('[data-variant-picker]', section);
      if (!picker) return;
      $$('input[type=radio]', picker).forEach(function (input) {
        var idx = Number(input.getAttribute('data-option-index'));
        var test = opts.slice(); test[idx] = input.value;
        var v = findVariant(test);
        input.classList.toggle('is-unavailable', !v || !v.available);
      });
    }

    function renderPrice(v) {
      var html = '<div class="price' + (v.compare ? ' price--sale' : '') + '"><span class="price__current">' + v.price + '</span>' +
        (v.compare ? '<s class="price__compare">' + v.compare + '</s>' : '') + '</div>';
      var priceBox = $('[data-product-price]', section);
      if (priceBox) priceBox.innerHTML = html + (v.save ? '<span class="product__save">' + strings.save + ' ' + v.save + '</span>' : '');
      var sp = $('[data-sticky-price]', section);
      if (sp) sp.innerHTML = html;
    }

    function renderStock(v) {
      if (!stock) return;
      var threshold = Number(stock.getAttribute('data-threshold')) || 3;
      var cls = 'stock', txt = strings.inStock;
      if (!v.available) { cls += ' stock--out'; txt = strings.soldOut; }
      else if (v.tracked && v.qty > 0 && v.qty <= threshold) { cls += ' stock--low'; txt = strings.lowStock.replace('__count__', v.qty); }
      stock.innerHTML = '<span class="' + cls + '"><span class="stock__dot"></span>' + txt + '</span>';
    }

    function update() {
      var opts = selectedOptions();
      if (!opts) return;
      $$('[data-option-value]', section).forEach(function (el) {
        el.textContent = opts[Number(el.getAttribute('data-option-value'))] || '';
      });
      markAvailability(opts);
      var v = findVariant(opts);
      if (!v) {
        if (atc) { atc.disabled = true; atcLabel.textContent = strings.unavailable; }
        return;
      }
      idInput.value = v.id;
      if (atc) { atc.disabled = !v.available; atcLabel.textContent = v.available ? strings.addToCart : strings.soldOut; }
      var sAdd = $('[data-sticky-add]', section);
      if (sAdd) sAdd.disabled = !v.available;
      var sVar = $('[data-sticky-variant]', section);
      if (sVar) sVar.textContent = v.title;
      renderPrice(v);
      renderStock(v);
      if (v.media && gallery) {
        var target = $('[data-media-id="' + v.media + '"]', gallery);
        if (target) {
          if (window.innerWidth < 750) gallery.scrollTo({ left: target.offsetLeft - 16, behavior: 'smooth' });
          else if (target !== gallery.firstElementChild) gallery.insertBefore(target, gallery.firstElementChild);
        }
      }
      var url = new URL(window.location.href);
      url.searchParams.set('variant', v.id);
      window.history.replaceState({}, '', url.toString());
    }

    section.addEventListener('change', function (e) { if (e.target.closest('[data-variant-picker]')) update(); });
    var initial = selectedOptions();
    if (initial) markAvailability(initial);

    section.addEventListener('click', function (e) {
      var q = e.target.closest('[data-qty]');
      if (q) {
        var input = q.parentElement.querySelector('input');
        input.value = Math.max(1, (parseInt(input.value, 10) || 1) + Number(q.getAttribute('data-qty')));
      }
      var img = e.target.closest('.product__media-item');
      if (img && img.querySelector('img') && window.innerWidth >= 1000) img.classList.toggle('is-zoomed');
      if (e.target.closest('[data-sticky-add]')) {
        if (atc && !atc.disabled) atc.click();
      }
    });
    if (gallery) {
      gallery.addEventListener('mousemove', function (e) {
        var item = e.target.closest('.is-zoomed');
        if (!item) return;
        var r = item.getBoundingClientRect();
        var im = item.querySelector('img');
        im.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var qty = parseInt(form.querySelector('[name="quantity"]').value, 10) || 1;
        addToCart([{ id: Number(idInput.value), quantity: qty }], atc);
      });
    }

    if (sticky && atc) {
      new IntersectionObserver(function (entries) {
        sticky.classList.toggle('is-visible', !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0);
      }).observe(atc);
    }
  });

  /* ---------------- Product recommendations ---------------- */
  $$('[data-recommendations]').forEach(function (el) {
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      fetch(el.getAttribute('data-url')).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('[data-recommendations]');
        if (fresh && fresh.innerHTML.trim()) { el.innerHTML = fresh.innerHTML; initReveal(el); initSliders(el); }
      });
    }, { rootMargin: '400px' });
    io.observe(el);
  });

  /* ---------------- Tabs ---------------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-tab]');
    if (!tab) return;
    var root = tab.closest('[data-tabs]');
    $$('[data-tab]', root).forEach(function (t) { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', t === tab); });
    $$('[data-panel]', root).forEach(function (p) {
      var on = p.getAttribute('data-panel') === tab.getAttribute('data-tab');
      p.hidden = !on;
      if (on) $$('[data-reveal]', p).forEach(function (r) { r.classList.add('is-in'); });
    });
  });

  /* ---------------- Sliders ---------------- */
  function initSliders(ctx) {
    $$('[data-slider], .slider', ctx).forEach(function (slider) {
      if (slider.__init) return; slider.__init = true;
      var wrap = slider.closest('section');
      var progress = slider.parentElement.querySelector('.slider-progress span');
      var update = function () {
        if (!progress) return;
        var max = slider.scrollWidth - slider.clientWidth;
        var ratio = slider.clientWidth / slider.scrollWidth;
        progress.style.setProperty('--p', Math.min(100, (ratio + (max > 0 ? slider.scrollLeft / max : 0) * (1 - ratio)) * 100) + '%');
      };
      slider.addEventListener('scroll', update, { passive: true });
      update();
      if (!wrap) return;
      var nav = $('[data-slider-nav]', wrap);
      if (!nav) return;
      nav.addEventListener('click', function (e) {
        var visible = $$('.slider', wrap).filter(function (s) { return s.offsetParent !== null; })[0] || slider;
        var step = visible.clientWidth * 0.8;
        if (e.target.closest('[data-next]')) visible.scrollBy({ left: step, behavior: 'smooth' });
        if (e.target.closest('[data-prev]')) visible.scrollBy({ left: -step, behavior: 'smooth' });
      });
    });
  }
  initSliders();

  /* ---------------- Reveal on scroll + counters ---------------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var start = performance.now(), dur = 1600;
    (function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('fr-FR');
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }
  var revealIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      $$('[data-count]', en.target).forEach(animateCount);
      revealIO.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;
  function initReveal(ctx) {
    $$('[data-reveal]', ctx).forEach(function (el) {
      if (revealIO) revealIO.observe(el); else el.classList.add('is-in');
    });
  }
  initReveal();

  /* ---------------- Tilt (spotlight) ---------------- */
  if (window.matchMedia('(hover: hover)').matches) {
    $$('[data-tilt]').forEach(function (el) {
      var img = el.querySelector('img');
      if (!img) return;
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        img.style.transform = 'perspective(900px) rotateY(' + x * 10 + 'deg) rotateX(' + -y * 10 + 'deg) scale(1.03)';
      });
      el.addEventListener('mouseleave', function () { img.style.transform = ''; });
    });
  }

  /* ---------------- Countdown ---------------- */
  $$('[data-countdown]').forEach(function (el) {
    var end = new Date(el.getAttribute('data-countdown')).getTime();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    (function tick() {
      var diff = end - Date.now();
      if (isNaN(end) || diff <= 0) { el.innerHTML = '<p class="h3">' + el.getAttribute('data-expired-text') + '</p>'; return; }
      el.querySelector('[data-d]').textContent = pad(Math.floor(diff / 864e5));
      el.querySelector('[data-h]').textContent = pad(Math.floor(diff / 36e5) % 24);
      el.querySelector('[data-m]').textContent = pad(Math.floor(diff / 6e4) % 60);
      el.querySelector('[data-s]').textContent = pad(Math.floor(diff / 1e3) % 60);
      setTimeout(tick, 1000);
    })();
  });

  /* ---------------- Collection filters (AJAX) ---------------- */
  var collectionEl = $('[data-collection]');
  if (collectionEl) {
    var sectionId = collectionEl.closest('.shopify-section') && collectionEl.closest('.shopify-section').id.replace('shopify-section-', '');
    var loadUrl = function (url) {
      collectionEl.classList.add('collection-loading');
      var fetchUrl = url + (url.indexOf('?') > -1 ? '&' : '?') + 'section_id=' + sectionId;
      fetch(fetchUrl).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('[data-collection]');
        var wasOpen = $('[data-filters]', collectionEl) && $('[data-filters]', collectionEl).classList.contains('is-open');
        if (fresh) collectionEl.innerHTML = fresh.innerHTML;
        if (wasOpen) $('[data-filters]', collectionEl).classList.add('is-open');
        initReveal(collectionEl);
        window.history.replaceState({}, '', url);
      }).finally(function () { collectionEl.classList.remove('collection-loading'); });
    };
    var buildUrl = function () {
      var params = new URLSearchParams();
      $$('[data-filter-form]', collectionEl).forEach(function (f) {
        new FormData(f).forEach(function (v, k) { if (v !== '') { if (k === 'sort_by') params.set(k, v); else params.append(k, v); } });
      });
      return window.location.pathname + '?' + params.toString();
    };
    var debounce;
    collectionEl.addEventListener('change', function (e) {
      if (!e.target.closest('[data-filter-form]')) return;
      if (e.target.matches('[data-sort]')) {
        $$('[data-filter-form] [name="sort_by"]', collectionEl).forEach(function (i) { i.value = e.target.value; });
      }
      clearTimeout(debounce);
      debounce = setTimeout(function () { loadUrl(buildUrl()); }, 300);
    });
    collectionEl.addEventListener('submit', function (e) { e.preventDefault(); loadUrl(buildUrl()); });
    collectionEl.addEventListener('click', function (e) {
      var link = e.target.closest('[data-filter-link]');
      if (link) { e.preventDefault(); loadUrl(link.getAttribute('href')); }
      if (e.target.closest('[data-filters-open]')) { $('[data-filters]', collectionEl).classList.add('is-open'); }
      if (e.target.closest('[data-filters-close]')) { $('[data-filters]', collectionEl).classList.remove('is-open'); }
    });
  }

  /* ---------------- Predictive search ---------------- */
  var overlay = $('[data-search-overlay]');
  if (overlay) {
    var input = $('[data-search-input]', overlay);
    var results = $('[data-search-results]', overlay);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-search-open]')) { overlay.classList.add('is-open'); lock(true); setTimeout(function () { input.focus(); }, 100); }
      if (e.target.closest('[data-search-close]')) { overlay.classList.remove('is-open'); lock(false); }
    });
    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      var q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ''; return; }
      t = setTimeout(function () {
        fetch(routes.search + '.json?q=' + encodeURIComponent(q) + '&resources[type]=product,collection&resources[limit]=10&resources[options][unavailable_products]=last')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var r = data.resources.results;
            var html = '';
            if (r.collections && r.collections.length) {
              html += '<div class="search-suggest" style="margin-bottom:1.5rem">' + r.collections.map(function (c) {
                return '<a href="' + c.url + '">' + c.title + '</a>';
              }).join('') + '</div>';
            }
            if (r.products && r.products.length) {
              html += '<div class="search-results__products">' + r.products.map(function (p) {
                return '<a class="search-result" href="' + p.url + '">' + (p.image ? '<img src="' + p.image + '&width=400" alt="" loading="lazy">' : '') +
                  '<p>' + p.title + '</p><p class="price">' + (p.price ? Number(p.price).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '') + '</p></a>';
              }).join('') + '</div>' +
              '<p style="margin-top:2rem"><a class="link-arrow" href="/search?q=' + encodeURIComponent(q) + '&options[prefix]=last">Voir tous les résultats</a></p>';
            } else {
              html += '<p class="muted">Aucun résultat pour « ' + q.replace(/</g, '&lt;') + ' »</p>';
            }
            results.innerHTML = html;
          });
      }, 220);
    });
  }
})();
