// 2ª pasada: para artistas sin foto, busca en Wikidata (P18) y en categorías de Commons.
// Uso: node scripts/find-photos2.mjs <candidates.json previo> <salida.json>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const UA = { 'User-Agent': 'SancorRosterBot/1.0 (https://github.com/sancormgmt-blip/sancor-roster; sancor.mgmt@gmail.com)' };
const { artists } = JSON.parse(readFileSync('data/roster.json', 'utf8'));
const prev = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MUSIC = /sing|rapper|music|cantante|reggaet|\bDJ\b|compositor|vallenat|salsa|grupo|group|band|banda|músic|trap|\brap|urbano|producer|productor|duo|dúo|songwriter|orquesta|orchestra|artista|cantautor|influenc|youtuber/i;
const OK_LIC = /^(CC BY(-SA)? [\d.]+|CC0.*|Public domain.*|PD.*)/i;
const BAD_LIC = /\bNC\b|\bND\b|fair use|non-free/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
async function getJson(url) {
  for (let i = 0; i < 6; i++) {
    await sleep(350);
    const t = await (await fetch(url, { headers: UA })).text();
    try { return JSON.parse(t); } catch { await sleep(4000 * (i + 1)); }
  }
  throw new Error('limitado');
}
const q = (base, p) => getJson(base + '?format=json&origin=*&' + new URLSearchParams(p));
const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function info(file, why) {
  const f = await q('https://commons.wikimedia.org/w/api.php', { action: 'query', titles: file.startsWith('File:') ? file : 'File:' + file, prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: 1000 });
  const ii = Object.values(f.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!ii || !/^image\/(jpeg|png|webp)/.test(ii.mime)) return null;
  const m = ii.extmetadata ?? {};
  const lic = m.LicenseShortName?.value ?? '';
  return { file, why, url: ii.thumburl, w: ii.width, h: ii.height, license: lic, licenseUrl: m.LicenseUrl?.value ?? '', author: strip(m.Artist?.value), source: ii.descriptionurl,
    ok: OK_LIC.test(lic) && !BAD_LIC.test(lic) && ii.width >= 300 };
}

async function viaWikidata(name) {
  for (const lang of ['es', 'en']) {
    const s = await q('https://www.wikidata.org/w/api.php', { action: 'wbsearchentities', search: name, language: lang, type: 'item', limit: 5 });
    for (const e of s.search ?? []) {
      if (norm(e.label ?? '') !== norm(name) && !(e.aliases ?? []).some((a) => norm(a) === norm(name)) && !norm(e.match?.text ?? '').includes(norm(name))) continue;
      if (!MUSIC.test(e.description ?? '')) continue;
      const c = await q('https://www.wikidata.org/w/api.php', { action: 'wbgetclaims', entity: e.id, property: 'P18' });
      const img = c.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (img) { const r = await info(img, `wikidata ${e.id} (${e.description})`); if (r) return r; }
    }
  }
  return null;
}
async function viaCategory(name) {
  for (const cat of [name, name.replace(/ y /g, ' & ')]) {
    const r = await q('https://commons.wikimedia.org/w/api.php', { action: 'query', list: 'categorymembers', cmtitle: 'Category:' + cat, cmtype: 'file', cmlimit: 12 });
    const files = (r.query?.categorymembers ?? []).map((m) => m.title);
    for (const f of files) { const x = await info(f, `commons Category:${cat}`); if (x?.ok) return x; }
  }
  return null;
}

const out = existsSync(process.argv[3]) ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : {};
for (const a of artists) {
  if (prev[a.name]?.ok) continue;
  if (out[a.name] && !out[a.name].error) continue;
  try {
    out[a.name] = (await viaWikidata(a.name)) ?? (await viaCategory(a.name)) ?? { none: true };
  } catch (e) { out[a.name] = { error: e.message }; }
  const r = out[a.name];
  console.log(a.name.padEnd(24), r.ok ? 'OK ' : '-- ', r.file ?? '', '|', r.license ?? (r.error || 'sin resultado'));
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
