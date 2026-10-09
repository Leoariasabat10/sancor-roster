"""Descarga las fotos aprobadas de Wikimedia Commons, las optimiza y registra crédito en data/roster.json.
Uso: python scripts/fetch-photos.py <candidates.json>
Excluidas a mano tras revisión: identidad dudosa o foto compartida con terceros / resolución baja."""
import json, sys, time, unicodedata, re, io, subprocess
from pathlib import Path
from PIL import Image

EXCLUDE = {
    'Geezy',                     # coincidía con otro rapero (B.G.)
    'Zion', 'Lennox',            # foto de dúo con una tercera persona
    'Jowell y Randy',            # idem
    'Nelson Velásquez', 'Jerry Rivera', 'Maelo Ruiz',  # resolución < 300 px
    'Fuerza Regida', 'Guayacán Orquesta', 'Jean Carlos Centeno',  # toma de escenario, artista casi invisible
}
UA = {'User-Agent': 'SancorRosterBot/1.0 (https://github.com/sancormgmt-blip/sancor-roster; sancor.mgmt@gmail.com)'}
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()).strip('-')

def get(url):
    url = url.split('?')[0]
    for i in range(6):
        time.sleep(0.8)
        r = subprocess.run(['curl', '-sfL', '-A', UA['User-Agent'], url], capture_output=True)
        if r.returncode == 0 and r.stdout:
            return r.stdout
        time.sleep(5 * (i + 1))
    raise RuntimeError(url)

cands = json.load(open(sys.argv[1], encoding='utf8'))
roster = json.load(open('data/roster.json', encoding='utf8'))
out = Path('img/artistas'); out.mkdir(parents=True, exist_ok=True)
n = 0
for a in roster['artists']:
    c = cands.get(a['name'])
    if not c or not c.get('ok') or a['name'] in EXCLUDE or (c['w'] < 300 and c['h'] < 300):
        a.pop('photo', None); a.pop('credit', None); continue
    f = out / f"{slug(a['name'])}.webp"
    if not f.exists():
        im = Image.open(io.BytesIO(get(c['url']))).convert('RGB')
        im.thumbnail((720, 1000))
        im.save(f, 'WEBP', quality=80, method=6)
    w, h = Image.open(f).size
    a['photo'] = f.as_posix(); a['photoSize'] = [w, h]
    a['credit'] = {'author': c['author'][:120], 'license': c['license'], 'licenseUrl': c['licenseUrl'], 'source': c['source']}
    n += 1
    print('ok', a['name'], w, h)
json.dump(roster, open('data/roster.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(n, 'fotos')
