// Genera index.html a partir de src/index.html + data/roster.json.  Uso: node scripts/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const { whatsapp, artists } = JSON.parse(readFileSync('data/roster.json', 'utf8'));
const tpl = readFileSync('src/index.html', 'utf8');

const GENRES = {
  urbano: 'Reggaeton / Urbano', popular: 'Música Popular', regional: 'Regional Mexicano',
  vallenato: 'Vallenato', salsa: 'Salsa', djs: "DJ's",
};
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const wa = (text) => `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;

const band = (lo) => (lo === null ? 'consulta' : lo >= 150 ? 'high' : lo >= 50 ? 'mid' : lo >= 10 ? 'low' : 'entry');
const isElite = (lo) => lo !== null && lo >= 200;
const bucket = (a) => (a.lo === null ? 'consulta' : a.lo >= 200 ? 'top' : a.lo >= 100 ? 'premium' : `${a.lo}-${a.hi}`);
const tierLabel = (a) => (a.lo === null ? 'Bajo consulta' : a.lo >= 200 ? '$200K+' : a.lo >= 100 ? '$100K – $200K' : `$${a.lo}K – $${a.hi}K`);
const range = (a) => (a.lo === null ? 'Bajo consulta' : `$${a.lo}K – $${a.hi}K USD`);
const initials = (n) => n.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// ---- Elite (spotlight) ----
const elite = artists.filter((a) => isElite(a.lo)).sort((a, b) => b.hi - a.hi);
const eliteHtml = elite.map((a, i) => `
      <li><a class="poster" href="${wa('Hola, quiero cotizar a ' + a.name)}" target="_blank" rel="noopener noreferrer" data-reveal style="--i:${i % 3}">
        <span class="poster-media" aria-hidden="true">${a.photo ? `<img src="${esc(a.photo)}" alt="" loading="lazy">` : `<span class="poster-mono">${initials(a.name)}</span>`}</span>
        <span class="poster-name">${esc(a.name)}</span>
        <span class="poster-meta"><span>${GENRES[a.genre]}</span><span>${range(a)}</span></span>
      </a></li>`).join('');

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
      index += `\n        <li data-genre="${g}" data-band="${band(a.lo)}" data-name="${esc(norm(a.name))}"><a class="artist" href="${wa('Hola, quiero cotizar a ' + a.name)}" target="_blank" rel="noopener noreferrer"><span class="artist-name">${esc(a.name)}</span><svg class="artist-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg><span class="sr-only"> — cotizar por WhatsApp</span></a></li>`;
    }
    index += '\n      </ul></div>';
  }
  index += '\n    </section>';
}

const genreCount = new Set(artists.map((a) => a.genre)).size;
const out = tpl
  .replaceAll('{{COUNT}}', artists.length)
  .replaceAll('{{GENRES}}', genreCount)
  .replace('<!--ELITE-->', eliteHtml)
  .replace('<!--INDEX-->', index);
writeFileSync('index.html', out);
console.log(`index.html: ${artists.length} artistas, ${elite.length} elite`);
