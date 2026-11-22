"""Paint the original harbor illustrations with opaque, edge-following brush marks.

Example: python scripts/paint-harbor.py path/to/original/src/art src/art
The unpainted plates are available in git at bb6428d (src/art).
Requires Pillow, numpy, and opencv-python.
"""

import argparse
import math
import zlib
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def pigment(image):
    """A cool, lifted indigo underpainting and a warm chalk highlight."""
    color = image.astype(np.float32) / 255
    light = cv2.cvtColor(color, cv2.COLOR_RGB2GRAY)[..., None]
    shadow = np.power(1 - light, 2)
    color = light + (color - light) * 1.09
    color = color * np.array([0.94, 0.91, 0.84]) + shadow * np.array([0.055, 0.085, 0.106])
    color += light * np.array([0.059, 0.065, 0.079])
    return np.uint8(np.clip(color * 255, 0, 255))


def paint(source, target, relative):
    original = Image.open(source)
    rgb = np.array(original.convert('RGB'))
    height, width = rgb.shape[:2]
    is_person = relative.parts[0] in ('cast', 'portraits')
    rng = np.random.default_rng(zlib.crc32(relative.as_posix().encode()))
    # The finer passes follow the tangent to the local value contour.
    under = pigment(cv2.bilateralFilter(rgb, 7, 33, 6))
    value = cv2.cvtColor(under, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx = cv2.Sobel(value, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(value, cv2.CV_32F, 0, 1)
    field_x = cv2.GaussianBlur(gx * gx - gy * gy, (0, 0), 3)
    field_y = cv2.GaussianBlur(2 * gx * gy, (0, 0), 3)
    tangent = 0.5 * np.arctan2(field_y, field_x) + math.pi / 2
    canvas = cv2.GaussianBlur(under, (0, 0), 3.5)
    scale = max(.5, width / (1050 if is_person else 1350))
    for nominal, opacity in [(14, .84), (7, .74), (3.5, .52)]:
        step = max(2, round(nominal * scale))
        swatch = cv2.GaussianBlur(under, (0, 0), max(.65, step * .27))
        layer = canvas.copy()
        samples = [(x, y) for y in range(0, height, step) for x in range(0, width, step)]
        rng.shuffle(samples)
        jitter = rng.uniform(-.48, .48, (len(samples), 3))
        variation = rng.normal(0, 2.8, len(samples))
        for (x, y), (jx, jy, twist), shade in zip(samples, jitter, variation):
            x = min(width - 1, max(0, int(x + step * jx)))
            y = min(height - 1, max(0, int(y + step * jy)))
            angle = tangent[y, x] + twist * .9
            u, v = math.cos(angle) * step, math.sin(angle) * step
            # Uneven corners retain the edge left by a flat bristle brush.
            points = np.array([(x - u * 1.12 + v * .32, y - v * 1.12 - u * .32),
                               (x + u * 1.16 + v * .42, y + v * 1.16 - u * .42),
                               (x + u * .92 - v * .38, y + v * .92 + u * .38),
                               (x - u * 1.27 - v * .25, y - v * 1.27 + u * .25)], dtype=np.int32)
            color = np.clip(swatch[y, x] + shade, 0, 255).astype(int).tolist()
            cv2.fillConvexPoly(layer, points, color, cv2.LINE_AA)
        canvas = cv2.addWeighted(layer, opacity, canvas, 1 - opacity, 0)
    # Save a little of the fine drawing around eyes and gameplay objects.
    canvas = cv2.addWeighted(canvas, .63 if is_person else .79, under, .37 if is_person else .21, 0)
    tooth = rng.normal(0, 1.7, (height, width)).astype(np.float32)
    dry = cv2.GaussianBlur(rng.normal(0, 1, (height, width)).astype(np.float32), (9, 3), 2.1)
    painted = Image.fromarray(np.uint8(np.clip(canvas + (tooth + dry * 4)[..., None], 0, 255)))
    if 'A' in original.getbands():
        painted.putalpha(original.getchannel('A'))
    target.parent.mkdir(parents=True, exist_ok=True)
    painted.save(target, 'WEBP', quality=89, method=5)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('Supply a separate source directory containing the original plates.')
    originals = [Path('harbor-cover.webp')]
    for group in ('scenes', 'cast', 'portraits'):
        originals.extend(path.relative_to(args.source) for path in sorted((args.source / group).glob('*.webp')))
    for item in originals:
        paint(args.source / item, args.output / item, item)
        print(item, flush=True)
