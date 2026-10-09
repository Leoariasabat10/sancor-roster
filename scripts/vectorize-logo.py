"""Reconstruye el logo SANCOR MGMT como SVG (3 capas tonales de grafito/plata) a partir de logo.webp original.
Uso: python scripts/vectorize-logo.py <logo original> <salida.svg>
Limitación: parte de un raster de 1024 px; el vector queda nítido a cualquier escala pero no añade detalle que el original no tenga."""
import sys
import numpy as np
from PIL import Image, ImageFilter
import potrace

src, dst = sys.argv[1], sys.argv[2]
K = 3                                   # sobremuestreo antes de trazar
im = Image.open(src).convert('L')
ink = 255 - np.array(im).astype(float)
ink = np.clip((ink - 6) * 1.9, 0, 255)
box = Image.fromarray(ink.astype('uint8')).getbbox()
pad = 10
x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
crop = Image.fromarray(ink.astype('uint8')).crop((x0, y0, x1, y1))
W, H = crop.size
big = crop.resize((W * K, H * K), Image.LANCZOS)

# (umbral de tinta, desenfoque previo, ruido mínimo, color): garabatos finos + cuerpo de las letras
LEVELS = [(13, 0.45, 70, '#8c8981'), (105, 0.9, 60, '#f3f0ea')]

def path_d(bm, turd):
    out = []
    for curve in bm.trace(turdsize=turd, alphamax=1.3, opticurve=True, opttolerance=2.0):
        s = curve.start_point
        d = [f'M{s.x / K:.1f} {s.y / K:.1f}']
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f'L{seg.c.x / K:.1f} {seg.c.y / K:.1f}L{seg.end_point.x / K:.1f} {seg.end_point.y / K:.1f}')
            else:
                d.append(f'C{seg.c1.x / K:.1f} {seg.c1.y / K:.1f} {seg.c2.x / K:.1f} {seg.c2.y / K:.1f} {seg.end_point.x / K:.1f} {seg.end_point.y / K:.1f}')
        d.append('Z')
        out.append(''.join(d))
    return ''.join(out)

layers = [(color, path_d(potrace.Bitmap(np.array(big.filter(ImageFilter.GaussianBlur(K * b))) <= t), turd)) for t, b, turd, color in LEVELS]   # potracer rellena donde el valor es False
# Estructura animable: garabatos (capa 0) -> palabra SANCOR -> MGMT (la capa de letras se recorta en dos con clipPath)
MG = (280, 258, 232, 44)   # x, y, ancho, alto de "MGMT" en coordenadas del viewBox
(c0, d0), (c1, d1) = layers
x, y, w, h = MG
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="SANCOR MGMT">'
       f'<defs><path id="sg-letters" fill="{c1}" fill-rule="evenodd" d="{d1}"/>'
       f'<clipPath id="sg-cm"><rect x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath>'
       f'<clipPath id="sg-cw"><path clip-rule="evenodd" d="M0 0H{W}V{H}H0Z M{x} {y}H{x + w}V{y + h}H{x}Z"/></clipPath></defs>'
       f'<path class="sg-scrib" fill="{c0}" fill-rule="evenodd" d="{d0}"/>'
       f'<g class="sg-word"><g clip-path="url(#sg-cw)"><use href="#sg-letters"/></g></g>'
       f'<g class="sg-mgmt"><g clip-path="url(#sg-cm)"><use href="#sg-letters"/></g></g></svg>')
open(dst, 'w', encoding='utf8').write(svg)
print(W, H, len(svg) // 1024, 'KB')
