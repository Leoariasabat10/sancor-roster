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
  const reveals = $$('[data-reveal]');
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
})();
