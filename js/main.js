(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---- Menú móvil ----
  const root = document.documentElement;
  const btn = $('#menuBtn');
  const setMenu = (open) => {
    root.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', open);
    btn.firstElementChild.textContent = open ? 'Cerrar' : 'Menú';
  };
  btn.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  $$('#nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setMenu(false); btn.focus(); } });
  matchMedia('(min-width:900px)').addEventListener('change', (e) => e.matches && setMenu(false));

  // ---- Reveal al entrar en viewport (una vez) ----
  const reveals = $$('[data-reveal], .reveal-mask');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else reveals.forEach((el) => el.classList.add('in'));

  // ---- Filtros del roster (sobre el HTML ya renderizado) ----
  const state = { g: 'all', b: 'all', q: '' };
  const items = $$('#index li[data-genre]');
  const genres = $$('#index .genre');
  const tiers = $$('#index .tier');
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function apply(scroll) {
    const q = norm(state.q);
    let n = 0;
    items.forEach((li) => {
      const ok = (state.g === 'all' || li.dataset.genre === state.g) &&
                 (state.b === 'all' || li.dataset.band === state.b) &&
                 (!q || li.dataset.name.includes(q));
      li.hidden = !ok;
      n += ok;
    });
    tiers.forEach((t) => { t.hidden = !$('li:not([hidden])', t); });
    genres.forEach((g) => { g.hidden = !$('li:not([hidden])', g); });
    const filtering = state.g !== 'all' || state.b !== 'all' || q !== '';
    $('#count').innerHTML = `<b>${n}</b> ${n === 1 ? 'artista' : 'artistas'}`;
    $('#reset').hidden = !filtering;
    $('#empty').hidden = n > 0;
    $('#elite').hidden = $('#paquete').hidden = filtering;
    if (scroll) {
      const top = $('#roster').getBoundingClientRect().top + scrollY;
      if (scrollY > top) scrollTo({ top, behavior: 'instant' });
    }
  }

  const bind = (id, key) => {
    const pills = $$('.pill', $(id));
    pills.forEach((p) => p.addEventListener('click', () => {
      state[key] = p.dataset[key];
      pills.forEach((x) => x.setAttribute('aria-pressed', x === p));
      apply(true);
    }));
  };
  bind('#genrePills', 'g');
  bind('#budgetPills', 'b');

  const search = $('#search');
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = search.value; apply(true); }, 120);
  });

  $('#reset').addEventListener('click', () => {
    state.g = state.b = 'all'; state.q = ''; search.value = '';
    $$('.pill').forEach((p) => p.setAttribute('aria-pressed', 'g' in p.dataset ? p.dataset.g === 'all' : p.dataset.b === 'all'));
    apply(false);
    search.focus();
  });


  // ---- Cabecera: fondo al salir del tope (un solo listener pasivo) ----
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Galería de retratos: scroll nativo sin barra; arrastre con ratón, botones, teclado y progreso ----
  const vp = $('#galleryViewport');
  if (vp) {
    const [prev, next] = [$('.gal-prev'), $('.gal-next')];
    const bar = $('.gal-progress span');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let ticking = false;

    function update() {
      ticking = false;
      const max = vp.scrollWidth - vp.clientWidth;
      const atStart = vp.scrollLeft < 4, atEnd = vp.scrollLeft > max - 4;
      vp.classList.toggle('m-both', !atStart && !atEnd);
      vp.classList.toggle('m-start', atEnd && !atStart);
      prev.disabled = atStart; next.disabled = atEnd;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, (vp.scrollLeft + vp.clientWidth) / vp.scrollWidth) : 1})`;
    }
    const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    vp.addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    prev.hidden = next.hidden = false;
    update();

    const step = (dir) => vp.scrollBy({ left: dir * vp.clientWidth * 0.8, behavior: reduced.matches ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    vp.addEventListener('keydown', (e) => {
      if (e.target !== vp) return; // las flechas de un enlace enfocado siguen siendo del navegador
      if (e.key === 'ArrowRight') { e.preventDefault(); step(0.5); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-0.5); }
    });

    // Arrastre con ratón (táctil y trackpad usan el scroll nativo)
    let down = null, moved = false;
    vp.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button) return;
      down = { x: e.clientX, left: vp.scrollLeft }; moved = false;
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) > 5) { moved = true; vp.classList.add('dragging'); }
      if (moved) vp.scrollLeft = down.left - dx;
    });
    addEventListener('pointerup', () => { down = null; vp.classList.remove('dragging'); });
    vp.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    vp.addEventListener('dragstart', (e) => e.preventDefault());
  }

  // ---- Ficha del artista (progresivo: sin JS, los enlaces van directo a WhatsApp) ----
  const dlg = $('#profile');
  const data = JSON.parse($('#roster-data').textContent);
  const el = (tag, attrs = {}, text) => Object.assign(document.createElement(tag), attrs, text !== undefined && { textContent: text });
  const link = (href, text) => el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
  const mono = (n) => n.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  function openProfile(i) {
    const a = data[i];
    $('#pf-name').textContent = a.n;
    $('#pf-genre').textContent = a.g;
    $('#pf-range').textContent = a.r;
    $('#pf-cta').href = a.q;
    const media = $('#pf-media');
    media.replaceChildren(a.p ? el('img', { src: a.p, alt: `Retrato de ${a.n}` }) : el('span', { className: 'mono', ariaHidden: 'true' }, mono(a.n)));
    const cr = $('#pf-credit');
    cr.replaceChildren();
    if (a.c) cr.append(a.c.source ? 'Foto: ' : '', a.c.source ? link(a.c.source, a.c.author || 'Wikimedia Commons') : a.c.author, ', ', a.c.licenseUrl ? link(a.c.licenseUrl, a.c.license) : a.c.license);
    dlg.showModal();
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-i]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    openProfile(+a.dataset.i);
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // clic en el fondo
})();
