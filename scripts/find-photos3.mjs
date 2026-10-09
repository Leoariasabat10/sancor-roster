// 3ª pasada: búsqueda de texto completo en Commons (archivos) + Openverse (Flickr y otros con licencia abierta).
// Exige que el nombre del artista aparezca (frase completa) en el título o en las categorías del archivo.
// Uso: node scripts/find-photos3.mjs <salida.json>   -> candidatos para REVISIÓN VISUAL, nunca aprobados automáticamente.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const UA = { 'User-Agent': 'SancorRosterBot/1.0 (https://github.com/sancormgmt-blip/sancor-roster; sancor.mgmt@gmail.com)' };
const { artists } = JSON.parse(readFileSync('data/roster.json', 'utf8'));
const OK_LIC = /^(CC BY(-SA)? [\d.]+|CC0.*|Public domain.*|PD.*)/i;
const BAD_LIC = /\bNC\b|\bND\b|fair use|non-free/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
async function getJson(url) {
  for (let i = 0; i < 5; i++) {
    await sleep(400);
    const r = await fetch(url, { headers: UA }); const t = await r.text();
    try { return JSON.parse(t); } catch { await sleep(3000 * (i + 1)); }
  }
  return null;
}
const variants = (n) => [...new Set([norm(n), norm(n.replace(/ y /g, ' & ')), norm(n.replace(/ & /g, ' y '))])];
const hit = (hay, vs) => vs.some((v) => ` ${norm(hay)} `.includes(` ${v} `));

async function commons(name) {
  const vs = variants(name); const out = [];
  const s = await getJson('https://commons.wikimedia.org/w/api.php?format=json&origin=*&' + new URLSearchParams({ action: 'query', list: 'search', srnamespace: 6, srsearch: `"${name}"`, srlimit: 15 }));
  const titles = (s?.query?.search ?? []).map((x) => x.title).filter((t) => /\.(jpe?g|png|webp)$/i.test(t));
  for (const t of titles) {
    const f = await getJson('https://commons.wikimedia.org/w/api.php?format=json&origin=*&' + new URLSearchParams({ action: 'query', titles: t, prop: 'imageinfo|categories', iiprop: 'url|extmetadata|size', iiurlwidth: 800, cllimit: 30 }));
    const pg = Object.values(f?.query?.pages ?? {})[0]; const ii = pg?.imageinfo?.[0]; if (!ii) continue;
    const cats = (pg.categories ?? []).map((c) => c.title).join(' | ');
    const m = ii.extmetadata ?? {}; const lic = m.LicenseShortName?.value ?? '';
    if (!(hit(t, vs) || hit(cats, vs))) continue;
    if (!OK_LIC.test(lic) || BAD_LIC.test(lic) || ii.width < 400) continue;
    out.push({ src: 'commons', title: t, cats: cats.slice(0, 200), url: ii.thumburl, w: ii.width, h: ii.height, license: lic, licenseUrl: m.LicenseUrl?.value ?? '', author: strip(m.Artist?.value).slice(0, 120), source: ii.descriptionurl });
  }
  return out;
}
async function openverse(name) {
  const vs = variants(name); const out = [];
  const d = await getJson('https://api.openverse.org/v1/images/?' + new URLSearchParams({ q: `"${name}"`, license: 'by,by-sa,cc0,pdm', page_size: 20, mature: 'false' }));
  for (const r of d?.results ?? []) {
    if (r.source === 'wikimedia' || r.source === 'wikimedia_commons') continue; // ya cubierto
    const text = `${r.title} ${(r.tags ?? []).map((t) => t.name).join(' ')}`;
    if (!hit(text, vs) || (r.width ?? 0) < 400) continue;
    out.push({ src: 'openverse:' + r.source, title: r.title, url: r.url, thumb: r.thumbnail, w: r.width, h: r.height, license: `CC ${String(r.license).toUpperCase()} ${r.license_version}`, licenseUrl: r.license_url ?? '', author: (r.creator ?? '').slice(0, 120), source: r.foreign_landing_url });
  }
  return out;
}

const out = existsSync(process.argv[2]) ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : {};
for (const a of artists) {
  if (a.photo || out[a.name]) continue;
  try { out[a.name] = [...(await commons(a.name)), ...(await openverse(a.name))].slice(0, 6); } catch (e) { out[a.name] = []; }
  console.log(a.name.padEnd(26), out[a.name].length, out[a.name].map((c) => c.title.slice(0, 40)).join(' ; '));
  writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
}
