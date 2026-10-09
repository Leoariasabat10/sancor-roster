// Genera index.html a partir de src/index.html + data/roster.json.  Uso: node scripts/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const { whatsapp, artists } = JSON.parse(readFileSync('data/roster.json', 'utf8'));
const tpl = readFileSync('src/index.html', 'utf8');

const GENRES = {
  urbano: 'Reggaeton / Urbano', popular: 'Música Popular', regional: 'Regional Mexicano',
  vallenato: 'Vallenato', salsa: 'Salsa', djs: "DJ's",
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const wa = (text) => `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
const quote = (a) => wa('Hola, quiero cotizar a ' + a.name);

const band = (lo) => (lo === null ? 'consulta' : lo >= 150 ? 'high' : lo >= 50 ? 'mid' : lo >= 10 ? 'low' : 'entry');
const isElite = (lo) => lo !== null && lo >= 200;
const bucket = (a) => (a.lo === null ? 'consulta' : a.lo >= 200 ? 'top' : a.lo >= 100 ? 'premium' : `${a.lo}-${a.hi}`);
const tierLabel = (a) => (a.lo === null ? 'Bajo consulta' : a.lo >= 200 ? '$200K+' : a.lo >= 100 ? '$100K – $200K' : `$${a.lo}K – $${a.hi}K`);
const range = (a) => (a.lo === null ? 'Bajo consulta' : `$${a.lo}K – $${a.hi}K USD`);
const initials = (n) => n.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
artists.forEach((a, i) => { a.i = i; });

const img = (a, cls, sizes, lazy = true) => a.photo
  ? `<img class="${cls}" src="${esc(a.photo)}" alt="Retrato de ${esc(a.name)}" width="${a.photoSize[0]}" height="${a.photoSize[1]}" ${lazy ? ' loading="lazy"' : ''} decoding="async"${sizes ? ` sizes="${sizes}"` : ''}>`
  : `<span class="mono" aria-hidden="true">${initials(a.name)}</span>`;
// Un enlace por artista: con JS abre la ficha; sin JS va directo a WhatsApp.
const link = (a, cls, inner, extra = '') => `<a class="${cls}" href="${quote(a)}" target="_blank" rel="noopener noreferrer" data-i="${a.i}"${extra}>${inner}</a>`;

// ---- Elite ----
const elite = artists.filter((a) => isElite(a.lo)).sort((a, b) => b.hi - a.hi);
const eliteHtml = elite.map((a, i) => `
      <li>${link(a, 'poster', `
        <span class="poster-media">${img(a, 'poster-img', '(min-width:1100px) 20vw, 50vw')}</span>
        <span class="poster-name">${esc(a.name)}</span>
        <span class="poster-meta"><span>${GENRES[a.genre]}</span><span>${range(a)}</span></span>`, ` data-reveal style="--i:${i % 5}"`)}</li>`).join('');

// ---- Collage del hero: 3 columnas de retratos verticales ----
const byName = (n) => artists.find((a) => a.name === n);
const HERO_COLS = [['Arcangel', 'Myke Towers', 'Nicky Jam'], ['Rauw Alejandro', 'Camilo', 'Ozuna'], ['Silvestre Dangond', 'Natanael Cano', 'Ryan Castro']];
let n = 0;
const heroHtml = HERO_COLS.map((col, c) => `
    <li class="hcol" style="--c:${c}"><ul>${col.map((nm) => { const a = byName(nm); return `
      <li>${link(a, 'shot', img(a, 'shot-img', '(min-width:900px) 16vw, 30vw', false), ` style="--n:${n++}"`)}</li>`; }).join('')}
    </ul></li>`).join('');

// ---- Tira de retratos (solo fotos de una persona, mayor tarifa primero) ----
const SOLO = (a) => a.photo && !/ y | & |Piso 21|Cali|Trébol|Zion|Alexis/.test(a.name);
const faces = artists.filter(SOLO).sort((a, b) => (b.hi ?? 0) - (a.hi ?? 0)).slice(0, 14);
const facesHtml = faces.map((a) => `
      <li>${link(a, 'face', `<span class="face-media">${img(a, 'face-img', '', false)}</span><span class="face-name">${esc(a.name)}</span>`)}</li>`).join('');

// ---- Índice completo, agrupado por género y rango ----
let index = '';
for (const g of Object.keys(GENRES)) {
  const list = artists.filter((a) => a.genre === g);
  const tiers = new Map();
  for (const a of list) {
    const k = bucket(a);
    if (!tiers.has(k)) tiers.set(k, []);
    tiers.get(k).push(a);
  }
  const ordered = [...tiers.values()].sort((A, B) => (A[0].lo === null) - (B[0].lo === null) || (B[0].hi ?? 0) - (A[0].hi ?? 0));
  index += `\n    <section class="genre" data-genre="${g}" aria-labelledby="g-${g}">
      <header class="genre-head"><h3 id="g-${g}">${GENRES[g]}</h3><span class="genre-count">${list.length}</span></header>`;
  for (const t of ordered) {
    index += `\n      <div class="tier"><h4 class="tier-name">${tierLabel(t[0])}</h4><ul class="artist-list">`;
    for (const a of t) {
      index += `\n        <li data-genre="${g}" data-band="${band(a.lo)}" data-name="${esc(norm(a.name))}">${link(a, 'artist',
        `<span class="thumb">${img(a, 'thumb-img')}</span><span class="artist-name">${esc(a.name)}</span><svg class="artist-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg><span class="sr-only"> — ver ficha y cotizar</span>`)}</li>`;
    }
    index += '\n      </ul></div>';
  }
  index += '\n    </section>';
}

// ---- Datos para la ficha (JS) y créditos de foto ----
const data = artists.map((a) => ({ n: a.name, g: GENRES[a.genre], r: range(a), p: a.photo ?? null, c: a.credit ?? null, q: quote(a) }));
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const credits = artists.filter((a) => a.credit).map((a) =>
  `<li><span>${esc(a.name)}</span> <a href="${esc(a.credit.source)}" target="_blank" rel="noopener noreferrer">${esc(a.credit.author || 'Autor en Commons')}</a>, ${a.credit.licenseUrl ? `<a href="${esc(a.credit.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(a.credit.license)}</a>` : esc(a.credit.license)}</li>`).join('\n        ');

const genreCount = new Set(artists.map((a) => a.genre)).size;
const out = tpl
  .replaceAll('{{COUNT}}', artists.length)
  .replaceAll('{{GENRES}}', genreCount)
  .replaceAll('{{PHOTOS}}', artists.filter((a) => a.photo).length)
  .replace('{{LOGO}}', readFileSync('img/sancor-logo.svg', 'utf8'))
  .replace('<!--HERO-->', heroHtml.replace('class="shot-img"', 'class="shot-img" fetchpriority="high"'))
  .replace('<!--FACES-->', facesHtml)
  .replace('<!--ELITE-->', eliteHtml)
  .replace('<!--INDEX-->', index)
  .replace('<!--CREDITS-->', credits)
  .replace('<!--DATA-->', json);
writeFileSync('index.html', out);
console.log(`index.html: ${artists.length} artistas, ${elite.length} elite, ${faces.length} en tira, ${artists.filter((a) => a.photo).length} con foto`);
