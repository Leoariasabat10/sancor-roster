// Busca fotos libres en Wikipedia/Commons para cada artista. Salida: scratch/candidates.json (revisar a mano).
// Uso: node scripts/find-photos.mjs <salida.json>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const UA = { 'User-Agent': 'SancorRosterBot/1.0 (https://github.com/sancormgmt-blip/sancor-roster; sancor.mgmt@gmail.com)' };
const { artists } = JSON.parse(readFileSync('data/roster.json', 'utf8'));
const MUSIC = /sing|rapper|music|cantante|reggaet|\bDJ\b|compositor|vallenat|salsa|grupo|group|band|banda|músic|trap|rap\b|urbano|producer|productor|duo|dúo|songwriter|orquesta|orchestra|artista/i;
const OK_LIC = /^(CC BY(-SA)? [\d.]+( \w+)?|CC0.*|Public domain.*|PD.*|CC BY(-SA)?.*)$/i;
const BAD_LIC = /\bNC\b|\bND\b|fair use|non-free/i;

// Títulos de Wikipedia cuando el nombre del roster no coincide o es ambiguo
const TITLE = {
  'Arcangel': 'Arcángel (cantante)', 'Beele': 'Beéle', 'Anuel': 'Anuel AA', 'Camilo': 'Camilo (cantante)',
  'Kapo': 'Kapo (cantante)', 'Jhayco': 'Jhayco', 'Sech': 'Sech (cantante)', 'Zion': 'Zion & Lennox',
  'Lennox': 'Zion & Lennox', 'Hades': 'Hades66', 'Darell': 'Darell', 'Pirlo': 'Pirlo (cantante)', 'Nath': 'Nath (cantante)',
  'Kris R': 'Kris R.', 'Almighty': 'Almighty (rapero)', 'Noriel': 'Noriel', 'Mackie': 'Mackie (cantante)',
  'Reykon': 'Reykon', 'Westcol': 'Westcol', 'Pressure': 'Pressure (cantante)', 'Amaro': 'Amaro (cantante)',
  'Greeicy': 'Greeicy', 'Alzate': 'Alzate (cantante)', 'Junior H': 'Junior H', 'Kybba': 'Kybba',
  'Piso 21': 'Piso 21', 'Boza': 'Boza (cantante)', 'Topboy': 'Topboy', 'Sebastián Yatra': 'Sebastián Yatra',
  'Ñejo': 'Ñejo', 'Brytiago': 'Brytiago', 'Soley': 'Soley', 'Clooy': 'Clooy',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) { // espera entre peticiones y reintenta si Wikimedia limita
  for (let i = 0; i < 6; i++) {
    await sleep(350);
    const r = await fetch(url, { headers: UA });
    const t = await r.text();
    try { return JSON.parse(t); } catch { await sleep(4000 * (i + 1)); }
  }
  throw new Error('limitado por Wikimedia');
}
const api = (lang, p) => getJson(`https://${lang}.wikipedia.org/w/api.php?format=json&origin=*&redirects=1&` + new URLSearchParams(p));

async function lookup(name) {
  const t = TITLE[name] ?? name;
  for (const lang of ['es', 'en']) {
    for (const title of [t, `${t} (cantante)`, `${t} (singer)`]) {
      const j = await api(lang, { action: 'query', titles: title, prop: 'pageimages|description|pageprops', piprop: 'original|name', ppprop: 'disambiguation' });
      const pg = Object.values(j.query?.pages ?? {})[0];
      if (!pg || pg.missing !== undefined || pg.pageprops?.disambiguation !== undefined) continue;
      if (!MUSIC.test(pg.description ?? '')) continue;
      if (!pg.pageimage) return { title: pg.title, lang, desc: pg.description, note: 'sin imagen' };
      const f = await getJson('https://commons.wikimedia.org/w/api.php?format=json&origin=*&' + new URLSearchParams({
        action: 'query', titles: 'File:' + pg.pageimage, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: 1000 }));
      const ii = Object.values(f.query?.pages ?? {})[0]?.imageinfo?.[0];
      if (!ii) return { title: pg.title, lang, desc: pg.description, note: 'imagen no está en Commons (probable uso legítimo local)' };
      const m = ii.extmetadata ?? {};
      const lic = m.LicenseShortName?.value ?? '';
      const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return {
        title: pg.title, lang, desc: pg.description, file: pg.pageimage, url: ii.thumburl, w: ii.width, h: ii.height,
        license: lic, licenseUrl: m.LicenseUrl?.value ?? '', author: strip(m.Artist?.value), source: ii.descriptionurl,
        ok: OK_LIC.test(lic) && !BAD_LIC.test(lic),
      };
    }
  }
  return { note: 'sin página musical' };
}

const out = existsSync(process.argv[2]) ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : {};
for (const a of artists) {
  if (out[a.name] && !String(out[a.name].note ?? '').startsWith('error')) continue;
  try { out[a.name] = await lookup(a.name); } catch (e) { out[a.name] = { note: 'error ' + e.message }; }
  const r = out[a.name];
  console.log(a.name.padEnd(24), r.ok ? 'OK ' : '-- ', r.title ?? '', '|', r.license ?? r.note ?? '');
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
