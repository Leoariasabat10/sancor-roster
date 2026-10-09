# SANCOR MGMT — sitio del roster

Sitio estático (HTML + CSS + JS sin dependencias de runtime), publicado en GitHub Pages desde la raíz de `master`.

## Estructura
- `data/roster.json` — artistas, géneros y rangos de precio (única fuente de contenido del roster; campo opcional `photo` por artista).
- `src/index.html` — plantilla de la página.
- `scripts/build.mjs` — genera `index.html` (roster ya renderizado, visible sin JS).
- `css/styles.css`, `js/main.js`, `fonts/` (autoalojadas), `img/`.

## Editar y publicar
```
node scripts/build.mjs        # regenera index.html (Node 18+)
python -m http.server 8000    # probar en http://localhost:8000
git add -A && git commit -m "..." && git push   # GitHub Pages publica solo
```
No edites `index.html` a mano: se sobrescribe. Para añadir una foto oficial: `"photo": "img/artistas/nombre.webp"` en el artista (aparece en la tarjeta Elite).

## Pendientes de decisión
- `robots: noindex` se mantiene (decisión original). Para indexar, quitar la meta en `src/index.html`.
