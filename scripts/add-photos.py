"""Incorpora fotos entregadas por SANCOR/los artistas (press kit, fotos propias con permiso).
1. Copia cada foto a img/artistas-drop/ con el nombre EXACTO de data/fotos-pendientes.md (p. ej. beele.jpg).
2. python scripts/add-photos.py --credit "Foto: cortesía de <fuente>"
3. node scripts/build.mjs
Solo se registran archivos cuyo nombre coincide con un artista del roster. No sobrescribe fotos ya verificadas salvo con --replace."""
import argparse, io, json, re, unicodedata
from pathlib import Path
from PIL import Image, ImageOps

ap = argparse.ArgumentParser()
ap.add_argument('--credit', default='Foto: cortesía del artista y SANCOR MGMT')
ap.add_argument('--license', default='Uso autorizado por el titular')
ap.add_argument('--replace', action='store_true')
a = ap.parse_args()

slug = lambda s: re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()).strip('-')
roster = json.load(open('data/roster.json', encoding='utf8'))
by = {slug(x['name']): x for x in roster['artists']}
src, out = Path('img/artistas-drop'), Path('img/artistas')
src.mkdir(exist_ok=True); out.mkdir(exist_ok=True)
done = 0
for f in sorted(src.iterdir()):
    if f.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp'}:
        continue
    art = by.get(slug(f.stem))
    if not art:
        print('SIN COINCIDENCIA (renombra):', f.name); continue
    if art.get('photo') and not a.replace:
        print('ya tiene foto verificada, omitido:', art['name']); continue
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    if min(im.size) < 400:
        print('RESOLUCIÓN BAJA (<400 px), omitido:', f.name, im.size); continue
    im.thumbnail((720, 1000))
    dest = out / f'{slug(art["name"])}.webp'
    im.save(dest, 'WEBP', quality=82, method=6)
    art['photo'] = dest.as_posix(); art['photoSize'] = list(im.size)
    art['credit'] = {'author': a.credit, 'license': a.license, 'licenseUrl': '', 'source': ''}
    print('ok', art['name'], im.size); done += 1
json.dump(roster, open('data/roster.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(done, 'fotos añadidas;', sum('photo' in x for x in roster['artists']), 'de', len(roster['artists']), 'con foto')
