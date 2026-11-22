"""Render the four original illustrated rooms for The Last Post using Pillow."""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


WIDTH, HEIGHT = 1440, 900
SIZE = WIDTH, HEIGHT
OUTPUT = Path(__file__).resolve().parents[1] / "src" / "art" / "scenes"


def blend(a, b, amount):
    return tuple(round(start + (end - start) * amount) for start, end in zip(a, b))


class Scene:
    def __init__(self, seed, top, bottom):
        self.rng = random.Random(seed)
        self.image = Image.new("RGB", SIZE)
        self.draw = ImageDraw.Draw(self.image)
        for y in range(HEIGHT):
            self.line(((0, y), (WIDTH, y)), blend(top, bottom, y / HEIGHT))

    def poly(self, vertices, color, outline=None):
        self.draw.polygon(vertices, fill=color, outline=outline)

    def line(self, vertices, color, width=1):
        self.draw.line(vertices, fill=color, width=width, joint="curve")

    def box(self, bounds, color, outline=None, width=1):
        self.draw.rectangle(bounds, fill=color, outline=outline, width=width)

    def ellipse(self, bounds, color, outline=None, width=1):
        self.draw.ellipse(bounds, fill=color, outline=outline, width=width)

    def arc(self, bounds, start, end, color, width=1):
        self.draw.arc(bounds, start, end, fill=color, width=width)

    def glow(self, center, radius, color, strength):
        x, y = center
        rx, ry = radius
        # Build the light at quarter scale so the falloff stays smooth.
        scale = 4
        mask = Image.new("L", (WIDTH // scale, HEIGHT // scale))
        draw = ImageDraw.Draw(mask)
        for index in range(28, 0, -1):
            fraction = index / 28
            bounds = ((x - rx * fraction) / scale, (y - ry * fraction) / scale,
                      (x + rx * fraction) / scale, (y + ry * fraction) / scale)
            draw.ellipse(bounds, fill=int(strength * (1 - fraction * fraction) ** 2))
        mask = mask.filter(ImageFilter.GaussianBlur(2)).resize(SIZE, Image.Resampling.BILINEAR)
        self.image.paste(color, (0, 0, WIDTH, HEIGHT), mask)

    def beams(self, polygons, color, opacity):
        mask = Image.new("L", SIZE)
        draw = ImageDraw.Draw(mask)
        for polygon in polygons:
            draw.polygon(polygon, fill=opacity)
        self.image.paste(color, (0, 0, WIDTH, HEIGHT), mask.filter(ImageFilter.GaussianBlur(13)))

    def flecks(self, area, color, count):
        left, top, right, bottom = area
        for _ in range(count):
            x = self.rng.randrange(left, right)
            y = self.rng.randrange(top, bottom)
            size = self.rng.choices((1, 2, 3), (75, 23, 2))[0]
            self.ellipse((x, y, x + size, y + size * 0.7), color)

    def finish(self, name):
        mask = Image.new("L", (360, 225), 55)
        ImageDraw.Draw(mask).ellipse((-59, -45, 420, 268), fill=0)
        vignette = mask.filter(ImageFilter.GaussianBlur(26)).resize(SIZE, Image.Resampling.BILINEAR)
        self.image.paste((9, 14, 21), (0, 0, WIDTH, HEIGHT), vignette)
        grain = Image.frombytes("L", SIZE, self.rng.randbytes(WIDTH * HEIGHT))
        shade = grain.point([max(0, (130 - value) // 13) for value in range(256)])
        shine = grain.point([max(0, (value - 130) // 15) for value in range(256)])
        self.image.paste((18, 15, 21), (0, 0, WIDTH, HEIGHT), shade)
        self.image.paste((223, 211, 182), (0, 0, WIDTH, HEIGHT), shine)
        self.image.save(OUTPUT / f"{name}.webp", quality=87, method=6)


def timber(scene, bounds, first, last, *, panels=10, scratches=200):
    left, top, right, bottom = bounds
    for panel in range(panels):
        x0 = left + round((right - left) * panel / panels)
        x1 = left + round((right - left) * (panel + 1) / panels)
        color = blend(first, last, scene.rng.random())
        scene.box((x0, top, x1, bottom), color, blend(color, (16, 17, 22), .55))
        scene.line(((x0 + 2, top), (x0 + 2, bottom)), blend(color, (231, 190, 135), .16))
    for _ in range(scratches):
        x = scene.rng.randint(left + 2, right - 2)
        y = scene.rng.randint(top, bottom)
        color = blend(first, last, scene.rng.random())
        scene.line(((x, y), (x + scene.rng.choice((-1, 0, 1)), min(y + scene.rng.randrange(10, 90), bottom))), color)


def floorboards(scene, horizon, rear, near, line):
    hx, hy = horizon
    scene.poly(((0, hy), (WIDTH, hy), (WIDTH, HEIGHT), (0, HEIGHT)), rear)
    for y in range(hy, HEIGHT):
        scene.line(((0, y), (WIDTH, y)), blend(rear, near, (y - hy) / (HEIGHT - hy)))
    for x in range(-900, WIDTH + 1100, 135):
        seam_start = (hx + (x - hx) * .06, hy)
        scene.line((seam_start, (x, HEIGHT)), line, 2)
        scene.line(((seam_start[0] + 1, hy), (x + 3, HEIGHT)), blend(near, (178, 135, 104), .17))
    for level in (.05, .11, .21, .34, .52, .72, .91):
        y = hy + (HEIGHT - hy) * level
        scene.line(((0, y), (WIDTH, y)), blend(line, near, .36), 2)


def envelopes(scene, x, y, width, count, *, upright=False):
    for _ in range(count):
        px = x + scene.rng.randint(-5, 5)
        py = y - scene.rng.randint(0, count * 2)
        size = scene.rng.randint(round(width * .65), width)
        height = scene.rng.randint(15, 39) if upright else scene.rng.randint(5, 14)
        color = scene.rng.choice(((169, 137, 105), (208, 173, 119), (143, 142, 123), (224, 190, 143)))
        scene.poly(((px, py), (px + size, py + 2), (px + size - 2, py + height), (px, py + height)), color, (70, 51, 47))
        scene.line(((px + 2, py + 2), (px + size * .49, py + height * .72), (px + size - 4, py + 4)), blend(color, (77, 59, 59), .5))


def lamp(scene, x, y, size):
    scene.glow((x, y), (255 * size, 190 * size), (251, 174, 88), 79)
    scene.line(((x, y - 97 * size), (x, y - 12 * size)), (59, 45, 42), round(5 * size))
    scene.ellipse((x - 24 * size, y + 4 * size, x + 24 * size, y + 24 * size), (250, 194, 111))
    scene.poly(((x - 17 * size, y - 18 * size), (x + 17 * size, y - 18 * size),
                (x + 49 * size, y + 13 * size), (x - 49 * size, y + 13 * size)), (78, 60, 55), (52, 40, 42))
    scene.line(((x - 45 * size, y + 10 * size), (x + 45 * size, y + 10 * size)), (219, 160, 102), round(3 * size))
    scene.line(((x - 14 * size, y - 15 * size), (x + 14 * size, y - 15 * size)), (157, 104, 71), 2)


def postoffice():
    scene = Scene(431, (47, 39, 46), (130, 85, 63))
    timber(scene, (0, 141, WIDTH, 575), (111, 70, 53), (79, 51, 52), panels=20, scratches=580)
    scene.poly(((0, 0), (WIDTH, 0), (WIDTH, 148), (879, 113), (99, 162), (0, 231)), (55, 43, 48))
    scene.poly(((0, 0), (248, 0), (335, 505), (186, 679), (0, 769)), (55, 42, 47))
    scene.poly(((1440, 0), (1225, 0), (1165, 492), (1229, 676), (1440, 753)), (71, 46, 47))
    scene.line(((0, 205), (330, 133), (1121, 129), (1440, 201)), (158, 91, 59), 8)
    for x, y in ((36, 251), (115, 231), (193, 216)):
        scene.poly(((x, y), (x + 46, y - 11), (x + 71, y + 192), (x + 18, y + 209)), (63, 47, 46), (89, 60, 53))
        scene.line(((x + 44, y - 9), (x + 65, y + 186)), (95, 63, 51), 3)
    scene.poly(((92, 292), (191, 269), (200, 389), (100, 418)), (137, 93, 61), (54, 42, 43))
    scene.poly(((101, 298), (186, 278), (191, 382), (106, 405)), (90, 105, 89), (182, 135, 84))
    scene.poly(((106, 369), (126, 335), (148, 340), (172, 310), (189, 319), (192, 379), (108, 402)), (116, 117, 91))
    scene.line(((109, 388), (131, 368), (150, 374), (188, 349)), (196, 157, 98), 2)
    scene.line(((96, 447), (251, 410)), (158, 94, 55), 7)
    for x, y in ((131, 438), (180, 425), (225, 416)):
        scene.line(((x, y), (x + 4, y + 12), (x + 12, y + 8)), (185, 129, 69), 3)
    scene.poly(((160, 435), (171, 427), (196, 484), (210, 493), (219, 550), (164, 568), (151, 502)),
               (105, 82, 59), (67, 53, 48))
    scene.line(((158, 511), (203, 498), (204, 522), (183, 542), (166, 535), (158, 511)), (162, 121, 74), 2)

    scene.box((384, 147, 745, 486), (58, 49, 49), (149, 110, 75), 8)
    for y in range(165, 475):
        colors = ((135, 155, 150), (214, 162, 107), (62, 94, 98))
        color = blend(colors[0], colors[1], (y - 165) / 178) if y < 343 else blend(colors[1], colors[2], min(1, (y - 343) / 59))
        scene.line(((396, y), (733, y)), color)
    scene.ellipse((659, 268, 698, 306), (231, 194, 128))
    for _ in range(40):
        x, y = scene.rng.randint(399, 704), scene.rng.randint(208, 448)
        limit = min(733, x + scene.rng.randrange(7, 38))
        scene.line(((x, y), (limit, y)), (171, 154, 124) if y < 360 else (109, 125, 108), scene.rng.choice((1, 2)))
    scene.poly(((395, 387), (435, 375), (478, 377), (495, 386), (548, 397), (594, 400), (641, 423),
                (709, 426), (735, 418), (735, 475), (395, 475)), (48, 67, 66))
    for x, y in ((441, 376), (475, 378), (608, 409), (676, 425)):
        scene.box((x, y - 12, x + 17, y + 4), (51, 66, 64))
        scene.poly(((x - 2, y - 11), (x + 14, y - 21), (x + 19, y - 11)), (57, 73, 66))
        scene.box((x + 6, y - 6, x + 8, y - 3), (239, 181, 88))
    for x in (390, 510, 624, 733):
        scene.box((x, 155, x + 9, 486), (73, 53, 49), (151, 104, 72))
    scene.box((387, 330, 743, 342), (68, 51, 48), (163, 114, 75), 2)
    scene.poly(((371, 478), (755, 478), (773, 495), (356, 495)), (158, 112, 73), (68, 48, 43))
    scene.box((365, 495, 765, 506), (78, 52, 44), (116, 78, 54))

    timber(scene, (776, 193, 1114, 501), (89, 57, 47), (105, 63, 47), panels=7)
    for row in range(5):
        for column in range(6):
            x, y = 789 + column * 52, 207 + row * 52
            scene.box((x, y, x + 48, y + 44), (58, 42, 42), (191, 126, 71), 2)
            scene.box((x + 5, y + 5, x + 44, y + 33), scene.rng.choice(((74, 53, 48), (82, 54, 45), (89, 60, 47))))
            if scene.rng.random() < .68:
                envelopes(scene, x + 5, y + 22, 36, scene.rng.randrange(2, 6))
            scene.box((x + 17, y + 36, x + 31, y + 40), (158, 113, 70))
            scene.line(((x + 20, y + 38), (x + 28, y + 38)), (228, 187, 116))
    for y in (179, 190, 474, 482, 504):
        scene.line(((770, y), (1121, y)), (134, 82, 56), 7)
        scene.line(((770, y - 3), (1121, y - 3)), (176, 113, 69), 2)

    floorboards(scene, (740, 515), (106, 75, 57), (61, 49, 48), (55, 40, 41))
    scene.poly(((528, 650), (910, 640), (1237, 900), (244, 900)), (117, 59, 44), (156, 100, 59))
    scene.poly(((566, 661), (891, 655), (1156, 886), (323, 886)), (86, 54, 46), (177, 117, 70))
    for y in range(661, 885, 8):
        fraction = (y - 661) / 225
        x = 563 - fraction * 228
        end = 892 + fraction * 261
        scene.line(((x, y), (end, y)), (103, 62, 48))
        if y % 3 == 0:
            scene.line(((x + 12, y + 3), (end - 12, y + 3)), (125, 77, 51))

    scene.poly(((131, 619), (426, 601), (634, 758), (634, 900), (57, 900)), (68, 43, 45), (38, 32, 37))
    scene.poly(((67, 733), (609, 752), (609, 897), (32, 897)), (90, 50, 47), (176, 99, 57))
    for x in range(73, 600, 85):
        scene.poly(((x, 754), (x + 69, 759), (x + 63, 877), (x - 5, 878)), (109, 62, 50), (144, 79, 54))
        scene.line(((x + 5, 771), (x, 870), (x + 57, 868)), (75, 41, 41), 2)
    scene.poly(((114, 606), (406, 581), (637, 737), (610, 755), (34, 734)), (142, 89, 57), (193, 134, 80))
    scene.line(((35, 728), (611, 745), (632, 737)), (222, 156, 92), 4)
    for _ in range(76):
        x, y = scene.rng.randrange(119, 401), scene.rng.randrange(610, 711)
        scene.line(((x, y), (x + scene.rng.randrange(5, 67), y + 1)), (158, 99, 61))
    scene.poly(((211, 638), (352, 627), (415, 669), (272, 698)), (78, 99, 78), (174, 128, 72))
    envelopes(scene, 257, 657, 92, 9)
    scene.ellipse((405, 695, 467, 710), (85, 62, 50), (170, 125, 71), 2)
    scene.poly(((429, 651), (446, 651), (462, 696), (411, 696)), (96, 88, 66), (202, 148, 78))
    scene.ellipse((428, 646, 448, 655), (216, 161, 85), (113, 74, 54))

    scene.poly(((1141, 100), (1251, 105), (1261, 547), (1135, 521)), (67, 47, 47), (171, 108, 63))
    scene.poly(((1148, 120), (1238, 124), (1248, 533), (1144, 513)), (87, 54, 50), (126, 77, 54))
    for y in (158, 282, 401):
        scene.box((1158, y, 1230, y + 85), (97, 59, 52), (133, 79, 58), 2)
    scene.ellipse((1208, 350, 1228, 373), (186, 130, 72), (91, 60, 50), 2)
    lamp(scene, 750, 178, 1.14)
    lamp(scene, 1063, 154, .66)
    scene.beams((((729, 207), (775, 207), (996, 586), (533, 527)),), (243, 177, 96), 19)
    scene.glow((657, 528), (495, 260), (239, 157, 80), 34)
    scene.flecks((442, 220, 1012, 527), (187, 131, 77), 80)
    scene.finish("postoffice")


def gear(scene, x, y, radius, teeth, phase, colors):
    dark, metal, bright = colors
    vertices = []
    for index in range(teeth * 4):
        angle = phase + math.tau * index / (teeth * 4)
        size = radius if index % 4 in (1, 2) else radius * .88
        vertices.append((x + math.cos(angle) * size, y + math.sin(angle) * size))
    scene.poly(tuple((px + 8, py + 12) for px, py in vertices), dark)
    scene.poly(vertices, metal, dark)
    for relative, width, color in ((.83, 3, bright), (.7, 5, dark), (.65, 2, bright)):
        r = radius * relative
        scene.ellipse((x - r, y - r, x + r, y + r), None, color, width)
    for spoke in range(6):
        angle = phase + math.tau * (spoke + .5) / 6
        tx, ty = math.cos(angle), math.sin(angle)
        near = radius * .22
        far = radius * .68
        offset = radius * .05
        scene.poly(((x + tx * near - ty * offset, y + ty * near + tx * offset),
                    (x + tx * far - ty * offset, y + ty * far + tx * offset),
                    (x + tx * far + ty * offset, y + ty * far - tx * offset),
                    (x + tx * near + ty * offset, y + ty * near - tx * offset)), bright, dark)
        hole_x, hole_y = x + tx * radius * .78, y + ty * radius * .78
        scene.ellipse((hole_x - 3, hole_y - 3, hole_x + 3, hole_y + 3), dark, bright)
    r = radius * .21
    scene.ellipse((x - r, y - r, x + r, y + r), dark, bright, 3)
    r *= .47
    scene.ellipse((x - r, y - r, x + r, y + r), metal, bright, 2)


def clock():
    scene = Scene(542, (42, 50, 60), (75, 84, 83))
    for row in range(13):
        y = row * 62 - 14
        for column in range(-1, 16):
            x = column * 105 + (row % 2) * 55
            middle = 1 - abs(x - 760) / 790
            color = blend((56, 62, 69), (102, 107, 105), max(0, middle) * scene.rng.uniform(.5, .9))
            scene.poly(((x + 2, y + 3), (x + 97, y), (x + 104, y + 58), (x, y + 60)), color, (40, 49, 56))
            scene.line(((x + 7, y + 6), (x + 88, y + 3)), blend(color, (170, 174, 156), .2), 2)
            for _ in range(12):
                dx, dy = scene.rng.randint(7, 94), scene.rng.randint(7, 51)
                scene.line(((x + dx, y + dy), (x + dx + 4, y + dy)), blend(color, (143, 144, 125), .3))

    for x in (81, 1148):
        scene.poly(((x, 0), (x + 133, 0), (x + 121, 780), (x - 34, 900)), (52, 57, 63), (43, 49, 55))
        scene.line(((x + 17, 0), (x - 14, 784)), (103, 99, 87), 5)
        scene.line(((x + 100, 0), (x + 87, 570)), (92, 95, 89), 7)
        for y in range(15, 761, 75):
            scene.line(((x + 34, y), (x + 91, y - 5)), (78, 80, 76), 3)

    scene.poly(((0, 790), (0, 354), (46, 299), (136, 275), (207, 293), (261, 340), (278, 576),
                (199, 605), (132, 731)), (50, 56, 63), (40, 49, 56))
    scene.line(((0, 350), (45, 293), (136, 267), (210, 286), (262, 331), (281, 569)), (111, 107, 96), 8)
    scene.line(((0, 351), (45, 302), (136, 279), (204, 298), (253, 339), (269, 579)), (64, 69, 72), 8)

    scene.ellipse((347, 118, 705, 473), (51, 61, 70), (28, 37, 48), 5)
    scene.ellipse((367, 137, 684, 453), (134, 170, 173), (175, 166, 140), 7)
    scene.ellipse((382, 152, 669, 438), (91, 133, 148), (65, 100, 109), 3)
    scene.ellipse((403, 173, 647, 418), (113, 151, 156), (190, 191, 164), 2)
    scene.ellipse((423, 193, 626, 396), (139, 171, 170), (191, 185, 155), 2)
    clock_center = (525, 295)
    for minute in range(60):
        angle = math.tau * minute / 60
        radius = 138
        length = 24 if minute % 5 == 0 else 8
        a = (clock_center[0] + math.cos(angle) * radius, clock_center[1] + math.sin(angle) * radius)
        b = (clock_center[0] + math.cos(angle) * (radius - length), clock_center[1] + math.sin(angle) * (radius - length))
        scene.line((a, b), (59, 78, 79) if minute % 5 == 0 else (98, 117, 111), 3 if minute % 5 == 0 else 1)
    scene.line(((507, 301), clock_center, (562, 213)), (49, 65, 69), 9)
    scene.line(((532, 306), clock_center, (468, 268)), (61, 71, 72), 9)
    scene.ellipse((514, 284, 536, 306), (158, 128, 84), (54, 70, 72), 3)
    scene.glow((528, 299), (293, 248), (164, 215, 210), 55)

    scene.poly(((715, 190), (1052, 226), (1040, 642), (723, 646)), (54, 60, 60), (102, 104, 89))
    for x in (716, 1034):
        scene.line(((x, 216), (x - 2, 646)), (47, 50, 55), 24)
        scene.line(((x - 8, 219), (x - 9, 640)), (142, 107, 79), 3)
    for y in (230, 402, 571):
        scene.line(((704, y), (1052, y + 8)), (47, 50, 53), 22)
        scene.line(((701, y - 8), (1052, y + 1)), (138, 108, 82), 3)
        for x in (708, 747, 983, 1040):
            scene.ellipse((x - 4, y - 5, x + 4, y + 3), (162, 145, 108), (51, 55, 54))
    gear(scene, 853, 339, 138, 26, .1, ((49, 48, 51), (124, 89, 70), (175, 137, 95)))
    gear(scene, 964, 503, 77, 19, .28, ((43, 49, 52), (104, 112, 106), (158, 158, 130)))
    gear(scene, 746, 502, 64, 16, .21, ((53, 51, 52), (129, 96, 71), (188, 143, 93)))
    scene.line(((860, 431), (867, 623)), (39, 49, 53), 13)
    scene.line(((863, 431), (869, 620)), (172, 130, 84), 4)
    scene.ellipse((831, 600, 911, 643), (109, 80, 62), (193, 144, 94), 2)
    scene.arc((835, 603, 907, 638), 198, 340, (181, 134, 85), 3)
    for x in (1094, 1111):
        for y in range(35, 586, 13):
            scene.ellipse((x, y, x + 10, y + 15), None, (169, 143, 102), 2)
            scene.line(((x + 4, y), (x + 4, y + 8)), (62, 64, 63), 2)

    floorboards(scene, (806, 630), (74, 79, 78), (45, 55, 62), (39, 51, 59))
    scene.poly(((0, 729), (126, 733), (251, 689), (562, 701), (635, 787), (635, 900), (0, 900)), (47, 54, 61), (51, 57, 57))
    for step in range(12):
        y = 833 - step * 31
        rx = 304 - step * 8
        lx = -71 + step * 12
        dy = 13 - step * .4
        scene.poly(((lx, y), (rx, y - dy), (rx + 15, y + 2), (lx + 6, y + 21)), (97 - step * 2, 101 - step, 94 - step), (55, 60, 65))
        scene.poly(((lx + 6, y + 21), (rx + 15, y + 2), (rx + 17, y + 18), (lx + 7, y + 39)), (64, 71, 74), (50, 57, 61))
        scene.line(((lx + 7, y + 20), (rx + 14, y + 2)), (133 - step * 2, 123 - step, 106 - step), 2)
        post_x = rx + 7
        scene.line(((post_x, y + 5), (post_x + 1, y - 107)), (37, 44, 48), 7)
        scene.line(((post_x + 2, y + 3), (post_x + 3, y - 106)), (114, 102, 82), 2)
    scene.line(((220, 371), (230, 437), (252, 534), (288, 652), (330, 753)), (42, 48, 52), 15)
    scene.line(((220, 368), (230, 434), (252, 530), (288, 648), (330, 748)), (138, 113, 87), 4)
    scene.poly(((605, 587), (743, 598), (731, 749), (586, 742)), (57, 65, 66), (44, 51, 57))
    scene.poly(((604, 594), (740, 602), (712, 624), (571, 614)), (123, 115, 91), (56, 63, 65))
    scene.poly(((571, 614), (712, 624), (696, 741), (577, 745)), (73, 77, 75), (129, 117, 95))
    scene.poly(((583, 635), (696, 642), (684, 724), (588, 726)), (81, 84, 79), (52, 62, 65))
    envelopes(scene, 635, 594, 54, 4)
    for index in range(10):
        x, y = 1193 + index * 7, 689 + index * 13
        scene.line(((x, y), (x + 104, y + 34)), (74, 79, 76), 4)
    scene.beams((((403, 224), (559, 180), (897, 696), (613, 778)),), (177, 222, 201), 25)
    scene.glow((396, 734), (310, 168), (165, 147, 112), 31)
    scene.flecks((373, 263, 928, 674), (177, 176, 142), 108)
    scene.finish("clock")


def fern(scene, x, y, spread, height, shade, leaf):
    scene.ellipse((x - spread * .3, y - 7, x + spread * .3, y + 11), (35, 64, 59))
    for direction in (-1, 1):
        for stalk in range(7):
            length = height * scene.rng.uniform(.48, 1.03)
            span = spread * scene.rng.uniform(.45, 1.0)
            curve = []
            for i in range(9):
                t = i / 8
                curve.append((x + direction * span * t ** 1.35, y - length * math.sin(t * 1.85)))
            scene.line(curve, shade, max(1, round(height / 29)))
            for index, (px, py) in enumerate(curve[2:], start=2):
                size = height * .12 * (1 - index / 11) * scene.rng.uniform(.8, 1.4)
                tint = blend(shade, leaf, scene.rng.uniform(.34, .96))
                scene.poly(((px - direction * size * 1.7, py - size), (px - direction * size * .1, py - size * 1.6),
                            (px + direction * size * 1.75, py - size * .18), (px, py + size * .2)), tint)
                scene.poly(((px, py), (px + direction * size * 1.53, py + size * .32),
                            (px + direction * size * .32, py + size), (px - direction * size * 1.2, py + size * .6)), shade)


def pot(scene, x, y, width, height):
    scene.ellipse((x - width, y + height * .8, x + width, y + height * 1.12), (34, 55, 52))
    scene.poly(((x - width, y), (x + width, y), (x + width * .68, y + height), (x - width * .58, y + height)),
               (115, 73, 60), (61, 49, 43))
    scene.poly(((x - width * .9, y + 7), (x - width * .36, y + 6), (x - width * .32, y + height),
                (x - width * .58, y + height)), (154, 103, 73))
    scene.ellipse((x - width, y - 10, x + width, y + 11), (62, 65, 48), (175, 124, 85), 3)


def mirror(scene, x, y, radius, tilt):
    def glass_point(rx, ry, index):
        angle = math.tau * index / 36
        dx, dy = math.cos(angle) * rx, math.sin(angle) * ry
        return x + dx + dy * tilt, y + dy

    stand = y + radius * 2.0
    scene.line(((x - 1, y + radius * .5), (x + 1, stand)), (53, 88, 77), 5)
    scene.line(((x + 2, y + radius * .5), (x + 3, stand)), (168, 153, 103), 2)
    scene.ellipse((x - radius * .48, stand - 3, x + radius * .57, stand + 5), (66, 96, 78), (164, 149, 102))
    outer = tuple(glass_point(radius * .63, radius, index) for index in range(36))
    inside = tuple(glass_point(radius * .49, radius * .89, index) for index in range(36))
    scene.poly(outer, (122, 113, 73), (53, 83, 72))
    scene.poly(inside, (161, 190, 162), (105, 132, 105))
    scene.line((glass_point(radius * .49, radius * .89, 21), glass_point(radius * .49, radius * .89, 9)), (219, 221, 161), 3)
    scene.line((glass_point(radius * .63, radius, 22), glass_point(radius * .63, radius, 34)), (197, 175, 107), 2)


def greenhouse():
    scene = Scene(356, (83, 133, 137), (144, 172, 135))
    scene.glow((782, 209), (710, 490), (222, 223, 154), 154)

    for _ in range(117):
        x, y = scene.rng.randint(-70, 1450), scene.rng.randint(353, 554)
        width = scene.rng.randint(25, 186)
        height = scene.rng.randint(39, 136)
        color = scene.rng.choice(((105, 145, 114), (120, 155, 117), (128, 161, 121), (110, 148, 117)))
        scene.ellipse((x, y, x + width, y + height), color)

    roof_top = (731, 234)
    glass_palette = ((139, 174, 151), (169, 191, 152), (127, 165, 153), (146, 176, 154), (188, 197, 148))
    for index, x in enumerate(range(-420, 1690, 185)):
        scene.poly(((x, 0), (x + 170, 0), (731 + (x - 731) * .26 + 37, 238),
                    (731 + (x - 731) * .26, 234)), glass_palette[index % len(glass_palette)], (86, 123, 119))
        scene.line(((x + 18, 11), (731 + (x - 731) * .26 + 3, 230)), (205, 214, 164), 2)

    scene.poly(((189, 483), (189, 248), (311, 117), (522, 49), (727, 32), (1017, 75),
                (1203, 204), (1255, 464), (1139, 561), (315, 529)), None, (106, 138, 116))
    scene.poly(((517, 504), (517, 341), (563, 270), (632, 233), (724, 215), (822, 237), (880, 278),
                (929, 347), (929, 508)), (152, 185, 138), (66, 103, 97))
    scene.poly(((561, 513), (565, 355), (610, 297), (674, 266), (726, 252), (779, 268),
                (838, 304), (877, 365), (876, 512)), (182, 199, 139), (116, 143, 107))
    for _ in range(47):
        x, y = scene.rng.randint(567, 858), scene.rng.randint(373, 508)
        radius = scene.rng.randint(8, 28)
        scene.ellipse((x - radius, y - radius, x + radius, y + radius),
                      scene.rng.choice(((136, 163, 121), (152, 175, 128), (146, 172, 115), (174, 189, 126))))
    for x in (615, 676, 725, 777, 836):
        summit = 245 + abs(725 - x) * .46
        scene.line(((x, summit), (x, 514)), (76, 110, 98), 5)
        scene.line(((x + 2, summit), (x + 2, 514)), (189, 194, 138), 2)
        scene.line(((x, summit), roof_top), (133, 154, 117), 3)
    scene.line(((520, 366), (929, 367)), (78, 105, 90), 7)
    scene.line(((520, 366), (929, 366)), (177, 184, 131), 2)
    scene.line(((521, 446), (926, 446)), (100, 129, 99), 4)

    floorboards(scene, (723, 518), (102, 132, 109), (45, 76, 73), (47, 82, 74))
    scene.poly(((620, 514), (825, 514), (1191, 900), (273, 900)), (104, 128, 107), (80, 99, 88))
    for level in (.05, .12, .22, .37, .56, .79, 1.0):
        y = 514 + 386 * level
        a, b = 620 - 347 * level, 825 + 366 * level
        scene.line(((a, y), (b, y)), (65, 91, 82), 3)
        scene.line(((a, y + 3), (b, y + 3)), (139, 152, 116))
    for index in range(1, 7):
        scene.line(((620 + 205 * index / 7, 516), (273 + 918 * index / 7, 900)), (73, 99, 87), 2)

    arches = ((526, 234, 927, 534, 6), (402, 152, 1022, 590, 8), (242, 66, 1212, 651, 11),
              (53, -59, 1383, 832, 16), (-225, -193, 1652, 968, 23))
    for left, top, right, bottom, thickness in arches:
        center = (left + right) / 2
        height = 514 - top
        arch = tuple((center + (right - center) * math.cos(angle * math.pi / 24),
                      493 - height * math.sin(angle * math.pi / 24)) for angle in range(25))
        scene.line(((right + 6, bottom),) + arch + ((left - 7, bottom),), (50, 81, 76), thickness + 3)
        scene.line(tuple((px + 2, py - 2) for px, py in arch), (87, 129, 111), max(3, thickness // 2))
        for x in (left, right):
            scene.line(((x + 3, 482), (x + 3, bottom - 2)), (173, 174, 119), max(1, thickness // 5))
            scene.ellipse((x - 4, 463, x + 5, 472), (170, 169, 119), (58, 93, 78), 2)
    for a, b in (((0, 385), (521, 432)), ((0, 496), (515, 485)), ((1439, 383), (927, 432)),
                 ((1439, 480), (929, 483)), ((43, 163), (556, 283)), ((1391, 161), (861, 283))):
        scene.line((a, b), (67, 107, 92), 7)
        scene.line(((a[0], a[1] + 2), (b[0], b[1] + 2)), (132, 155, 114), 2)

    for direction in (-1, 1):
        transform = lambda horizontal: 725 + direction * horizontal
        corners = ((transform(171), 508), (transform(282), 510), (transform(690), 703), (transform(329), 755))
        for distance, y, h in ((211, 519, 72), (265, 594, 104), (340, 708, 153), (609, 704, 146)):
            x = transform(distance)
            scene.poly(((x - 8, y), (x + 10, y), (x + 9, y + h), (x - 8, y + h - 4)), (48, 75, 68), (41, 60, 55))
            scene.line(((x - 4, y + 4), (x - 4, y + h - 8)), (110, 130, 93), 2)
        scene.poly(corners, (109, 131, 100), (153, 161, 111))
        scene.line((corners[0], corners[3], corners[2]), (70, 92, 77), 13)
        scene.line(((transform(209), 522), (transform(402), 741)), (141, 148, 102), 2)
        for index in range(10):
            f = index / 10
            y = 535 + 164 * f
            x = transform(217 + f * (275 if index % 2 else 157))
            width = 13 + 25 * f
            pot(scene, x, y, width, 17 + f * 30)
            fern(scene, x, y + 2, 29 + f * 60, 33 + f * 85, (52, 94, 72), (134, 158, 94))

    for x, y, radius, tilt in ((788, 442, 22, .19), (746, 463, 27, -.24), (690, 483, 35, .18)):
        mirror(scene, x, y, radius, tilt)
    pot(scene, 636, 535, 17, 23)
    scene.line(((635, 531), (632, 519), (637, 513)), (79, 117, 77), 2)
    scene.poly(((637, 514), (645, 506), (647, 512), (637, 519)), (129, 150, 73), (82, 111, 73))
    scene.poly(((341, 608), (396, 601), (418, 622), (362, 635)), (143, 97, 65), (92, 80, 59))
    scene.poly(((347, 609), (392, 605), (410, 619), (364, 629)), (193, 168, 108), (160, 128, 87))
    scene.line(((381, 624), (368, 608)), (121, 109, 79), 2)

    scene.beams((((890, 112), (970, 109), (994, 760), (519, 748)),
                 ((1025, 159), (1121, 204), (1141, 854), (669, 863))), (235, 232, 164), 48)
    scene.glow((805, 527), (430, 307), (231, 224, 147), 63)
    for x, y, size in ((48, 733, 227), (171, 861, 217), (1325, 757, 209), (1431, 708, 178)):
        pot(scene, x, y, 60, 85)
        fern(scene, x, y, size * .68, size, (35, 68, 62), (76, 118, 77))
    scene.flecks((439, 186, 968, 680), (209, 210, 152), 145)
    scene.finish("greenhouse")


def station():
    scene = Scene(762, (32, 61, 82), (136, 147, 143))
    scene.glow((670, 448), (708, 360), (193, 173, 142), 134)
    for _ in range(112):
        x, y = scene.rng.randrange(WIDTH), scene.rng.randint(70, 439)
        length = scene.rng.randint(9, 112)
        scene.line(((x, y), (x + length, y - 1)), scene.rng.choice(((100, 130, 137), (111, 135, 139), (98, 126, 134))), 1)
    scene.poly(((0, 379), (122, 372), (235, 410), (371, 420), (472, 405), (593, 429), (676, 401),
                (731, 430), (887, 380), (1002, 410), (1229, 344), (1440, 358), (1440, 582), (0, 574)), (63, 91, 105))
    scene.poly(((0, 409), (107, 428), (216, 426), (281, 455), (439, 464), (511, 444), (582, 464),
                (688, 458), (778, 470), (944, 440), (1106, 449), (1440, 394), (1440, 616), (0, 632)), (51, 77, 90))
    for index in range(67):
        x, y = scene.rng.randrange(WIDTH), scene.rng.randrange(458, 538)
        height = scene.rng.randint(10, 54)
        spread = scene.rng.randint(7, 17)
        scene.poly(((x, y - height), (x + spread, y + 10), (x - spread, y + 10)),
                   (45, 69, 80) if index % 3 else (57, 82, 87))

    scene.poly(((541, 453), (609, 413), (666, 447), (666, 519), (541, 522)), (67, 75, 78), (38, 61, 72))
    scene.poly(((529, 452), (605, 409), (678, 449), (674, 459), (604, 424), (532, 459)), (47, 66, 77), (111, 118, 109))
    scene.box((561, 469, 589, 491), (195, 144, 86), (59, 63, 64), 3)
    scene.box((617, 460, 638, 490), (231, 166, 90), (61, 66, 66), 3)
    scene.line(((627, 460), (627, 487)), (107, 85, 65), 2)
    scene.glow((625, 482), (99, 79), (249, 177, 103), 109)

    floorboards(scene, (706, 505), (75, 99, 104), (41, 61, 76), (29, 55, 71))
    scene.poly(((677, 501), (744, 503), (786, 900), (31, 900)), (45, 70, 80), (35, 54, 67))
    scene.poly(((627, 511), (676, 503), (45, 900), (0, 900), (0, 748)), (56, 78, 87), (79, 102, 102))
    for y in range(518, 898, 4):
        f = (y - 500) / 400
        a = 680 - f * 610
        b = 725 + f * 97
        x = scene.rng.uniform(a, b - 4)
        scene.line(((x, y), (x + scene.rng.randint(2, 20), y - 2)), (76, 91, 96), scene.rng.choice((1, 1, 2)))
    for level in (.02, .04, .07, .105, .15, .205, .27, .34, .42, .51, .61, .73, .87, 1.03):
        y = 505 + 392 * level
        a = 677 - level * 641
        b = 744 + level * 39
        depth = level * 17 + 1
        scene.poly(((a, y + depth), (b, y), (b + 7, y + depth), (a - 18, y + depth * 2)), (34, 49, 62), (77, 91, 95))
    for start, end in (((692, 502), (183, 900)), ((723, 503), (622, 900))):
        scene.line((start, end), (23, 50, 60), 23)
        scene.line((start, end), (116, 140, 141), 8)
        scene.line(((start[0] - 3, start[1]), (end[0] - 4, end[1])), (180, 168, 140), 2)

    scene.poly(((743, 500), (1440, 535), (1440, 900), (762, 900)), (70, 97, 105), (39, 67, 78))
    scene.poly(((743, 505), (786, 509), (905, 900), (762, 900)), (91, 111, 114), (53, 79, 88))
    for f in (.08, .15, .24, .36, .52, .71, .94):
        y = 510 + 390 * f
        scene.line(((761 + 16 * f, y), (1440, y + 60 * f)), (53, 81, 91), 2)
    for f in (.22, .44, .69, .83):
        scene.line(((745 + 695 * f * .31, 517), (765 + 675 * f, 900)), (57, 86, 95), 2)
    for _ in range(200):
        x, y = scene.rng.randint(791, 1439), scene.rng.randint(557, 899)
        length = scene.rng.randrange(4, 49)
        color = scene.rng.choice(((89, 121, 124), (111, 135, 127), (68, 111, 120), (56, 82, 95)))
        scene.line(((x, y), (x + length, y + 1)), color)
    for x, y, length in ((891, 610, 100), (1114, 697, 174), (954, 834, 274)):
        scene.ellipse((x, y, x + length, y + length * .09), (111, 129, 122), (76, 112, 120), 2)
        scene.line(((x + length * .19, y + length * .05), (x + length * .81, y + length * .05)), (137, 142, 126), 2)

    scene.poly(((727, 309), (1440, 3), (1440, 293), (735, 382)), (44, 63, 75), (112, 123, 119))
    scene.poly(((714, 316), (1440, -37), (1440, 1), (729, 345)), (80, 96, 104), (47, 66, 78))
    scene.poly(((719, 337), (1440, 38), (1440, 62), (725, 358)), (38, 53, 67), (127, 133, 123))
    scene.line(((725, 354), (1440, 62)), (146, 136, 116), 3)
    scene.line(((733, 378), (1440, 292)), (28, 49, 61), 7)
    for x, top, bottom, width in ((759, 360, 537, 11), (838, 329, 571, 16), (996, 265, 658, 23),
                                  (1221, 161, 802, 33), (1394, 76, 895, 52)):
        scene.line(((x, top), (x, bottom)), (31, 52, 63), width)
        scene.line(((x - width * .22, top), (x - width * .22, bottom)), (111, 121, 111), max(1, width // 6))
        scene.poly(((x - width, top + 18), (x + width, top + 6), (x + width, top + 17), (x - width, top + 29)),
                   (79, 98, 102), (48, 69, 75))
        scene.line(((x - width, top + 29), (x - width * 4.4, top + 66)), (111, 117, 108), max(2, width // 8))
        scene.box((x - width * .72, bottom - 13, x + width * .69, bottom), (72, 94, 96), (41, 65, 76))
    for index in range(11):
        f = index / 10
        start = (737 + 679 * f * f, 357 - 276 * f * f)
        end = (751 + 688 * f * f, 375 - 75 * f * f)
        scene.line((start, end), (73, 95, 103), 3 + round(f * 7))

    for x, y, scale in ((876, 353, .45), (1077, 307, .68), (1300, 250, .87)):
        lamp(scene, x, y, scale)
        scene.glow((x + 30, y + 262 * scale), (165 * scale, 90 * scale), (209, 148, 88), 55)
    scene.poly(((1012, 598), (1231, 624), (1194, 649), (994, 621)), (92, 73, 64), (139, 109, 81))
    scene.line(((1017, 583), (1236, 607)), (104, 84, 75), 14)
    scene.line(((1017, 566), (1241, 591)), (112, 88, 75), 11)
    for a, b, c in (((1013, 566), (1011, 617), (1003, 674)), ((1204, 591), (1199, 643), (1186, 701))):
        scene.line((a, b, c), (36, 60, 67), 9)

    scene.line(((358, 408), (358, 665)), (34, 59, 71), 11)
    scene.line(((355, 412), (355, 664)), (111, 131, 128), 3)
    scene.poly(((297, 418), (436, 412), (440, 453), (296, 460)), (46, 67, 74), (138, 143, 124))
    scene.poly(((303, 424), (428, 418), (432, 447), (303, 453)), (61, 87, 90), (77, 104, 104))
    scene.line(((326, 437), (410, 433)), (157, 154, 124), 2)
    scene.line(((326, 444), (388, 441)), (137, 143, 122), 2)
    scene.poly(((337, 624), (366, 618), (383, 629), (352, 637)), (118, 122, 112), (54, 78, 90))
    scene.line(((607, 532), (607, 570)), (44, 60, 63), 8)
    scene.poly(((580, 490), (593, 474), (622, 475), (632, 489), (633, 530), (581, 530)), (127, 74, 62), (50, 61, 66))
    scene.poly(((583, 489), (598, 477), (622, 479), (632, 490), (592, 494)), (159, 99, 73), (112, 83, 66))
    scene.line(((590, 504), (623, 503)), (190, 142, 91), 4)
    scene.line(((590, 505), (623, 504)), (56, 65, 65), 2)

    scene.glow((710, 525), (153, 125), (237, 185, 110), 91)
    scene.ellipse((705, 508, 717, 518), (245, 211, 143))
    scene.line(((710, 518), (709, 547)), (61, 68, 63), 3)
    scene.glow((710, 515), (58, 63), (241, 207, 136), 81)
    for _ in range(245):
        x, y = scene.rng.randrange(WIDTH), scene.rng.randrange(200, HEIGHT)
        if x < 728 or y > 361 + (x - 728) * -.08:
            length = scene.rng.randrange(9, 45)
            shade = scene.rng.choice(((110, 143, 148), (127, 153, 151), (94, 130, 139)))
            scene.line(((x, y), (x - length * .16, y + length)), shade, 1)
    scene.finish("station")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for render in (postoffice, clock, greenhouse, station):
        render()
