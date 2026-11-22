"""Paint three original South Bank landscapes. Requires Python, Pillow and NumPy."""

import math
from pathlib import Path
import random

import numpy as np
from PIL import Image, ImageColor, ImageDraw


W, H = 1600, 900
S = W / 1200
OUT = Path(__file__).resolve().parents[1] / "src/art/voyage"


def rgb(c):
    return ImageColor.getrgb(c) if isinstance(c, str) else c


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(rgb(a), rgb(b)))


def point(x, y):
    return round(x * S), round(y * S)


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


class Painting:
    def __init__(self, seed, top, horizon, foreground, sky_limit):
        self.r = random.Random(seed)
        self.noise = np.random.default_rng(seed)
        self.image = Image.new("RGB", (W, H))
        self.draw = ImageDraw.Draw(self.image)
        for y in range(H):
            t = y / S
            shade = mix(top, horizon, min(1, t / sky_limit)) if t < sky_limit else mix(
                horizon, foreground, min(1, (t - sky_limit) / (675 - sky_limit)))
            self.draw.line((0, y, W, y), fill=shade)

    def poly(self, pts, c):
        self.draw.polygon([point(*pt) for pt in pts], fill=rgb(c))

    def line(self, pts, c, w=1):
        self.draw.line([point(*pt) for pt in pts], fill=rgb(c), width=max(1, round(w * S)))

    def ellipse(self, x, y, rx, ry, c):
        self.draw.ellipse([point(x-rx, y-ry), point(x+rx, y+ry)], fill=rgb(c))

    def wash(self, pts, c, accent, marks=90, direction=(1, 0), length=23):
        """A silhouette carries opaque, broken strokes clipped to its edge."""
        xs, ys = zip(*pts)
        x0, y0 = point(min(xs), min(ys))
        x1, y1 = point(max(xs), max(ys))
        size = x1-x0+1, y1-y0+1
        image = Image.new("RGB", size, rgb(c))
        brush = ImageDraw.Draw(image)
        dx, dy = direction
        for _ in range(marks):
            x, y = self.r.uniform(-5, size[0]), self.r.uniform(-5, size[1])
            l = self.r.uniform(.12, 1.3) * length * S
            end = (x + dx*l, y + dy*l)
            thickness = self.r.uniform(.55, 3.8)*S
            shade = mix(c, accent, self.r.uniform(.1, .82))
            brush.polygon([(x,y), (x+dx*l*.25+dy*thickness,y+dy*l*.25-dx*thickness),
                           end, (x+dx*l*.65-dy*thickness*.4,y+dy*l*.65+dx*thickness*.4)], fill=shade)
        mask = Image.new("L", size)
        ImageDraw.Draw(mask).polygon([(round(x*S)-x0,round(y*S)-y0) for x,y in pts], fill=255)
        self.image.paste(image, (x0,y0), mask)

    def ridge(self, y, relief, base, light, seed_x, floor=675):
        pts = []
        for x in range(-20, 1230, 6):
            t = x + seed_x
            k = .54*math.sin(t/129) + .27*math.sin(t/54) + .12*math.cos(t/24) + .07*math.sin(t/9)
            pts.append((x, y + relief*k + self.r.uniform(-1,1)))
        self.wash(pts+[(1230,floor),(-20,floor)], base, light, 270, (1,-.2), 46)
        return pts

    def field(self, rows, cols):
        patch = Image.fromarray(self.noise.uniform(0,255,(rows,cols)).astype(np.uint8))
        return np.asarray(patch.resize((W,H), Image.Resampling.BICUBIC), dtype=np.float32)/255-.5

    def sky(self, c, threshold=.14):
        base = np.asarray(self.image, dtype=np.float32)
        clouds = self.field(9,5)*.73+self.field(32,22)*.26+self.field(97,53)*.1
        density = np.clip((clouds-threshold)*3.6,0,.86)[:,:,None]
        self.image = Image.fromarray(np.uint8(base*(1-density)+np.array(rgb(c))*density))
        self.draw = ImageDraw.Draw(self.image)

    def finish(self, name):
        # A low-frequency displacement roughens cut edges; smaller fields deposit pigment.
        yy,xx = np.indices((H,W),dtype=np.int32)
        dx = np.rint(2.9*self.field(190,240)+1.3*self.field(89,104)).astype(np.int32)
        dy = np.rint(2.6*self.field(167,251)+1.1*self.field(75,79)).astype(np.int32)
        plate = np.asarray(self.image)[np.clip(yy+dy,0,H-1),np.clip(xx+dx,0,W-1)].astype(np.float32)
        tooth = self.noise.normal(0,2.6,(H,W)).astype(np.float32)
        tone = tooth+3*self.field(300,120)+6*self.field(94,43)+5*self.field(25,18)
        plate += tone[:,:,None]
        image = Image.fromarray(plate.clip(0,255).astype(np.uint8))
        OUT.mkdir(parents=True,exist_ok=True)
        image.save(OUT / f"{name}.webp",quality=88,method=6)


def shimmer(p, start, depth, dark, light, sun, count=1400):
    for _ in range(count):
        y=p.r.uniform(start,start+depth)
        x=p.r.uniform(-20,1210)
        t=(y-start)/depth
        width=p.r.uniform(1,10+20*t)
        bright=max(0,1-abs(x-sun)/(20+t*260))
        col=mix(dark,light,min(.95,p.r.uniform(.03,.36)+bright*.6))
        p.poly([(x,y),(x+width*.5,y-.2-t),(x+width,y),(x+width*.39,y+.4+t)],col)


def reed_clump(p,x,y,h,colors,count=24):
    for _ in range(count):
        root=x+p.r.uniform(-h*.8,h*.8)
        end=root+p.r.uniform(-.65,.64)*h
        high=p.r.uniform(.18,1.1)*h
        p.poly([(root-1.8,y),(root+(end-root)*.35,y-high*.63),
                (end,y-high),(root+1.3,y)],p.r.choice(colors))
        if p.r.random()<.17:
            p.line([(end,y-high),(end+(end-root)*.09,y-high*1.16)],colors[0],1.7)


def pine(p,x,y,h,c,light):
    p.line([(x,y),(x+h*.015,y-h)], c, h*.037)
    for i in range(11):
        z=i/11
        tip=y-h+h*z*.83
        w=h*(.035+.23*z)
        pts=[(x,tip-h*.07),(x+w*.27,tip+h*.08),(x+w,tip+h*.2),
             (x+w*.68,tip+h*.19),(x+w*.8,tip+h*.23),(x,tip+h*.17),
             (x-w*.87,tip+h*.24),(x-w*.76,tip+h*.18),(x-w,tip+h*.19),(x-w*.32,tip+h*.04)]
        p.poly(pts,c)
        p.poly([(x,tip-h*.06),(x-w*.34,tip+h*.055),(x-w*.93,tip+h*.18),(x-w*.44,tip+h*.13)],light)


def bird(p,x,y,s,c):
    p.line([(x-s,y-s*.31),(x-s*.55,y-s*.36),(x,y),(x+s*.4,y-s*.5),(x+s,y-s*.64)],c,max(1,s*.12))


def cabin(p,x,y,s,wall,shadow,roof,glint):
    """Weatherboard shed in three-quarter view, built around the eaves."""
    def pts(points):
        return [(x+u*s,y+v*s) for u,v in points]
    def face(points,c,a,n=65,d=(1,0),l=18):
        p.wash(pts(points),c,a,n,d,l*s)
    def line(points,c,w=1):
        p.line(pts(points),c,s*w)
    face([(-72,-2),(40,7),(40,72),(-72,60)],wall,glint)
    face([(40,7),(82,-10),(82,54),(40,72)],shadow,wall)
    for i in range(8):
        line([(-72,4+i*7),(40,14+i*7)],mix(wall,shadow,.6),1.2)
        line([(40,14+i*7),(82,-3+i*7)],mix(shadow,roof,.4))
    face([(-83,0),(-52,-42),(55,-34),(38,11)],roof,glint,170,(.52,-1),12)
    face([(38,11),(55,-34),(91,-8)], shadow,wall,26)
    for j in range(13):
        u=-80+j*9.2
        line([(u,1+(u+80)*.08),(u+28,-38+(u+80)*.07)],mix(roof,glint,.38),1.4)
    line([(-54,-42),(56,-34),(91,-8)],glint,2.6)
    line([(-84,1),(38,12),(90,-8)],shadow,3)
    face([(-62,7),(-18,11),(-18,43),(-62,40)],shadow,roof,15)
    face([(-58,11),(-22,14),(-22,38),(-58,35)],glint,roof,18,(.6,-1))
    line([(-40,11),(-40,39)],shadow,2.7)
    line([(-60,24),(-19,27)],shadow,2.7)
    face([(-6,16),(26,18),(26,69),(-6,65)],shadow,roof,30,(0,1))
    for j in [1,8,14,21]:
        line([(j,20),(j,64)],mix(shadow,wall,.6),1.3)
    line([(-8,65),(27,69)],roof,3)
    p.ellipse(x+18*s,y+43*s,s*1.8,s*1.8,glint)


def quay(p,a,b,c,d,base,accent,planks=30):
    p.wash([a,b,c,d],base,accent,250,(1,-.3),24)
    for i in range(planks+1):
        t=i/planks
        p.line([lerp(a,b,t),lerp(d,c,t)],mix(base,accent,p.r.uniform(.35,.8)),1.4)
    p.line([d,c],mix(base,"#171f26",.62),4)


def post(p,x,y,h,c,highlight,w=5):
    p.poly([(x-w,y),(x-w*.9,y-h),(x+w*.68,y-h-1),(x+w,y)],c)
    p.line([(x-w*.7,y-1),(x-w*.67,y-h)],highlight,max(1,w*.4))
    p.ellipse(x,y-h,w,w*.35,highlight)


def wheel(p,x,y,r,c,lit):
    p.ellipse(x,y,r,r,c)
    p.ellipse(x,y,r*.78,r*.78,lit)
    p.ellipse(x,y,r*.62,r*.62,c)
    for n in range(8):
        a=n*math.tau/8
        p.line([(x,y),(x+math.cos(a)*r*.81,y+math.sin(a)*r*.81)],lit,r*.11)
    p.ellipse(x,y,r*.18,r*.18,lit)


def ledger(p,x,y,s,cover,pages):
    p.poly([(x-25*s,y-4*s),(x+1*s,y-12*s),(x+25*s,y-5*s),
            (x+9*s,y+8*s),(x-21*s,y+3*s)],cover)
    for side in [[(-23,-5),(-5,-11),(1,-7),(-6,3)],[(1,-7),(8,-12),(24,-7),(9,5),(-6,3)]]:
        p.poly([(x+i*s,y+j*s) for i,j in side],pages)
    for k in range(4):
        p.line([(x+(4-k)*s,y+(-6+k*1.9)*s),(x+(15-k)*s,y+(-7+k*1.9)*s)],cover,.7*s)


def marsh():
    p=Painting(801,"#607c8c","#f4c69b","#486469",261)
    p.sky("#efd3bd",.012)
    p.ellipse(775,178,34,34,"#fce0a8")
    p.ridge(222,25,"#ada5a0","#d4b4a8",42)
    p.ridge(245,20,"#8c9590","#aaa697",340)
    p.ridge(257,8,"#6d827b","#9a9d87",539,294)
    for x in range(-8,1210,9):
        y=261+4*math.sin(x/67)
        pine(p,x,y,p.r.uniform(4,14),"#788780","#8b9584")
    p.wash([(-10,266),(1210,268),(1210,680),(-10,680)],"#89a09a","#e9c9a0",1300,(1,0),64)
    shimmer(p,267,410,"#819b94","#fff0c4",775,1850)
    for x in [813,842,868,887,911,929,951]:
        h=p.r.uniform(4,8)
        p.poly([(x-5,256),(x-5,256-h),(x,253-h),(x+8,256-h),(x+8,256)],"#8e8e7c")
    for x,y,z in [(700,143,5),(717,139,4),(729,142,3),(660,155,4)]:
        bird(p,x,y,z,"#697678")
    # Distant reed islands leave a bright, winding passage down the middle.
    for x,y,w,h in [(17,287,180,7),(870,293,160,5),(1055,305,180,13),(453,309,90,6),
                     (74,337,175,11),(1142,354,160,14),(790,328,52,5)]:
        p.wash([(x-w,y),(x-w*.26,y-h),(x+w*.5,y-h*.75),(x+w,y),(x+w*.24,y+4)],"#758578","#afa67d",70)
        for _ in range(24):
            reed_clump(p,x+p.r.uniform(-w*.85,w*.85),y,p.r.uniform(2,h),["#a69b78","#8b8f73","#6d7d70"],7)
    shore=[(-5,332),(82,314),(169,307),(283,321),(317,343),(397,350),(426,377),(367,394),
           (301,394),(246,421),(137,434),(85,458),(-8,461)]
    p.wash(shore,"#777d63","#c3af76",520,(1,-.25),14)
    for _ in range(75):
        x=p.r.uniform(-20,390); y=365+p.r.uniform(-7,8)
        reed_clump(p,x,y,p.r.uniform(6,16),["#b9a779","#929471","#6f795e"],12)
    for x in [174,226,322]:
        post(p,x,414,36,"#554f43","#93856b",3.6)
    cabin(p,243,319,1.17,"#b39c74","#675f51","#686c69","#ddc394")
    quay(p,(19,427),(347,368),(373,380),(36,446),"#a38b68","#655f50",27)
    for x,y in [(64,434),(186,408),(294,384)]:
        post(p,x,y,19,"#655e4f","#c9ab7b",4)
    # A cork ticket board and three old tickets catch the morning light.
    p.poly([(201,359),(230,363),(230,387),(201,384)],"#625344")
    p.poly([(203,361),(228,364),(228,384),(203,382)],"#c1a477")
    for i,(u,v) in enumerate([(206,364),(215,365),(210,374)]):
        p.poly([(u,v),(u+8,v+1),(u+7,v+9),(u-1,v+8)],["#e6cda0","#c37b62","#e7d1a5"][i])
    ledger(p,259,391,.91,"#785c48","#ead4a5")
    # Tide staff stands against open water, with a float and an enamel scale.
    quay(p,(570,341),(679,327),(682,332),(576,350),"#aa9275","#746c5b",14)
    for x,y in [(580,353),(667,340)]:
        post(p,x,y,17,"#5b5a50","#aa9e82",4)
    post(p,635,343,124,"#535951","#c9b284",7)
    p.poly([(633,226),(640,225),(640,337),(633,338)],"#e1d4ac")
    for i in range(23):
        y=232+i*4.4
        p.line([(634,y),(640 if i%2==0 else 637,y)],"#984f40",1.5)
    p.poly([(621,218),(636,208),(650,217),(650,222),(621,223)],"#6d6556")
    p.line([(643,224),(650,307)],"#5a6259")
    p.ellipse(650,309,5,7,"#c27657")
    # Flat-bottomed ferry in profile. A hand winch and line lead to the ramp.
    ferry=[(785,437),(878,426),(1014,421),(1060,412),(1041,447),(1000,456),(834,466),(800,456)]
    p.wash(ferry,"#494f4b","#947c5d",270,(1,-.07))
    p.poly([(788,436),(884,420),(1015,414),(1059,410),(1014,425),(833,443)],"#c7ac80")
    p.line([(789,438),(831,447),(1012,429),(1057,414)],"#e0bd87",3)
    p.line([(810,452),(838,459),(1003,447),(1041,434)],"#937c64",2)
    cabin(p,943,396,.57,"#a98f6b","#5e665a","#5b6660","#d4bd8b")
    p.poly([(941,364),(944,296),(949,296),(949,373)],"#66695a")
    p.line([(945,298),(1028,414)],"#7c8071")
    p.line([(945,298),(829,435)],"#727868")
    p.poly([(947,299),(972,305),(947,308)],"#b46f57")
    wheel(p,889,420,10,"#4e5a53","#c79163")
    quay(p,(1074,445),(1199,443),(1210,463),(1010,461),"#a28766","#665c50",19)
    p.line([(891,419),(1008,449),(1059,446)],"#5b6255",2)
    for x,y in [(1048,467),(1128,460),(1178,453)]:
        post(p,x,y,35,"#655e4d","#c0a77d",5)
    p.wash([(-5,486),(84,478),(167,502),(241,555),(403,574),(517,647),(630,678),(-5,678)],"#666f56","#b39b65",790,(.7,-1),28)
    p.wash([(914,676),(965,611),(1041,578),(1123,526),(1210,514),(1210,680)],"#626e57","#a19268",450,(.4,-1),28)
    for _ in range(245):
        x=p.r.uniform(-25,1240)
        edge=(480+.37*x if x<650 else 512+.48*(1210-x))
        y=p.r.uniform(edge,700) if edge<700 else 700
        reed_clump(p,x,y,p.r.uniform(10,39)*(1 if y>600 else .65),["#534f3f","#707554","#b5a16a","#8b895f"],14)
    for x,y,h in [(25,667,146),(73,665,115),(1121,674,95),(1177,665,133)]:
        reed_clump(p,x,y,h,["#4a5141","#655f45","#5c644a","#9c8c5e"],15)
    p.finish("marsh")


def saltworks():
    p=Painting(1302,"#62929d","#f3d8b1","#d7bc96",233)
    p.sky("#f6e7d1",.065)
    p.ridge(204,24,"#a7aaa0","#d4be9d",970)
    p.ridge(224,16,"#808f88","#b8ad8f",681)
    p.wash([(-4,234),(1203,231),(1203,680),(-4,680)],"#c9b78e","#efdab6",1200,(.92,-.12),45)
    # Straight dykes recede towards the sea. Water varies with evaporative depth.
    def pan(u,v):
        mag=115+1430*v
        return 652+(u-.5)*mag,229+438*v
    colors=["#91b5af","#b5c5ab","#d9c8a9","#b4c7b7","#d9b4a0","#9fbcb2"]
    rows=[.025,.065,.125,.214,.345,.543,.82,1.2]
    for row,(v0,v1) in enumerate(zip(rows,rows[1:])):
        for col in range(-3,5):
            a=col*.36
            pts=[pan(a+.008,v0+.006),pan(a+.349,v0+.006),pan(a+.349,v1-.006),pan(a+.008,v1-.006)]
            if max(x for x,y in pts)<-8 or min(x for x,y in pts)>1208:
                continue
            color=colors[(row*3+col)%len(colors)]
            p.wash(pts,color,"#fbebcd",45+row*20,(1,0),23)
            p.line([pts[0],pts[1],pts[2]],"#a79c80",max(.6,2*v1))
            p.line([pts[2],pts[3],pts[0]],"#efe4c8",1+2*v1)
    # A low salt warehouse, smokestack and the last mill on the headland.
    for x in [36,78,102,135,1042,1085]:
        cabin(p,x,219,p.r.uniform(.11,.24),"#b6a582","#7b8171","#9c8476","#c9bc9c")
    p.poly([(1104,228),(1109,180),(1121,180),(1129,228)],"#9b8e78")
    p.poly([(1106,183),(1114,171),(1125,182)],"#8f776b")
    for i in range(4):
        a=i*math.pi/2-.39
        dx,dy=math.cos(a),math.sin(a)
        p.poly([(1115+dx*4,181+dy*4),(1115+dx*33,181+dy*33),
                (1115+dx*34-dy*5,181+dy*34+dx*5),
                (1115+dx*13-dy*4,181+dy*13+dx*4)],"#978d75")
    # Strong facets and irregular ridges on drying salt mounds.
    def mound(x,y,w,h):
        peak=(x-w*.12,y-h)
        p.wash([(x-w,y), (x-w*.6,y-h*.36),peak,(x+w*.16,y-h*.58),
                (x+w*.37,y-h*.22),(x+w*.28,y+2)],"#f5e8ca","#d9cbb1",100,(.6,.8),12)
        p.wash([peak,(x+w*.24,y-h*.74),(x+w*.6,y-h*.34),(x+w,y),
                (x+w*.25,y+2),(x+w*.3,y-h*.14)],"#b8b5ac","#dad1ba",110,(.8,.72),17)
    for args in [(24,275,69,33),(119,280,64,40),(811,252,40,22),
                 (877,258,74,37),(985,269,89,51),(1086,278,91,53),(1195,277,72,31)]:
        mound(*args)
    for x,y,s in [(510,140,7),(529,137,5),(541,140,4),(853,122,4)]:
        bird(p,x,y,s,"#647c7c")
    # The account shed sits on a wide dusty service road.
    p.wash([(-5,300),(189,275),(343,279),(424,303),(385,337),(259,353),(-5,386)],
           "#cbb38d","#e8d2a6",520,(1,-.15),22)
    cabin(p,216,280,1.12,"#cfb98c","#9b866b","#aa7460","#f2d397")
    # Ledger desk outside the office, distinguished from the large packing table.
    for x,y in [(241,342),(281,343),(309,332)]:
        post(p,x,y+15,21,"#86745e","#c9a87a",2.3)
    p.wash([(232,334),(285,326),(315,330),(264,341)],"#987f63","#d1b288",45)
    ledger(p,270,330,.88,"#88614b","#f3e2b7")
    p.poly([(148,316),(165,319),(166,341),(149,338)],"#90674f")
    for i in range(4):
        p.line([(149,321+i*4),(164,323+i*4)],"#bdac81")
    # An open sluice has a visible running channel beneath the hoist.
    p.wash([(540,278),(685,274),(824,395),(770,424),(686,382)],"#928f79","#c9bc94",450,(.8,.35))
    p.wash([(612,300),(646,296),(761,394),(714,401)],"#80aaa3","#e1dbc0",180,(.8,.5),15)
    for x,y,w,h in [(553,325,27,33),(656,319,28,39)]:
        p.wash([(x,y),(x+w,y+3),(x+w,y-h),(x,y-h-3)],"#a27e65","#d2b292",48)
        p.poly([(x+w,y+3),(x+w+13,y-2),(x+w+13,y-h-6),(x+w,y-h)],"#8f7966")
        for r in range(4):
            p.line([(x,y-r*h/4),(x+w,y+3-r*h/4)],"#c3a98b")
        p.poly([(x-3,y-h-4),(x+11,y-h-8),(x+w+17,y-h-5),(x+w,y-h+1)],"#ddc8a0")
    p.wash([(575,314),(660,310),(660,280),(575,284)],"#617b75","#bac0a7",110,(0,1),14)
    for u in [579,594,611,627,647,656]:
        p.line([(u,283),(u,313)],"#415e5d",2.3)
    for x,y in [(571,291),(669,286)]:
        post(p,x,y,61,"#436363","#c0b594",4.3)
    p.line([(568,230),(674,225)],"#54716a",6)
    p.line([(568,227),(674,222)],"#d0ba90",2)
    p.line([(622,282),(622,229)],"#5a6157",4)
    wheel(p,624,257,16,"#785f51","#dc9d70")
    # Packing station at the outward edge of the near pans.
    p.wash([(732,405),(865,355),(1205,363),(1205,514),(889,511)],"#bdaa86","#e6d0a1",510,(1,-.15),29)
    for x,y in [(847,457),(901,475),(1024,450),(980,442)]:
        post(p,x,y+26,40,"#7b705b","#cab086",4.5)
    quay(p,(827,433),(988,412),(1036,433),(884,459),"#ae916a","#745e4f",14)
    def crate(x,y,s):
        def q(pts): return [(x+a*s,y+b*s) for a,b in pts]
        p.wash(q([(-26,-18),(7,-12),(7,18),(-26,11)]),"#bb936a","#ddba89",50)
        p.wash(q([(7,-12),(30,-22),(30,8),(7,18)]),"#9b775d","#cda57b",40)
        p.poly(q([(-26,-18),(-2,-28),(30,-22),(7,-12)]),"#dbc29a")
        for a in [-22,-3,4]:
            p.line(q([(a,-15+(a+22)*.16),(a,11+(a+22)*.16)]),"#87674f",2*s)
        p.line(q([(-24,9),(5,-10)]),"#e3c295",3*s)
        p.line(q([(10,14),(26,-18)]),"#c49d74",3*s)
    crate(925,434,1.18)
    crate(984,423,.74)
    for i in range(4):
        x=1057+i*24; y=427-i*2
        p.wash([(x-17,y+7),(x-15,y-2),(x-6,y-10),(x-7,y-17),(x,y-19),
                (x+2,y-12),(x+13,y-6),(x+19,y+4),(x+14,y+10),(x-11,y+12)],
               "#ded0aa","#f7e8c1",36,(.4,1),9)
    mound(91,669,190,120)
    mound(231,692,151,83)
    p.wash([(958,677),(1000,633),(1095,594),(1205,573),(1205,678)],"#a39978","#c9b78b",420,(.8,-.3),20)
    for _ in range(49):
        x=p.r.uniform(983,1240); y=676-(x-984)*.38+p.r.uniform(-8,32)
        reed_clump(p,x,y,p.r.uniform(10,28),["#83815f","#ac9d70","#bbad80"],10)
    p.finish("saltworks")


def observatory():
    p=Painting(7741,"#35445e","#e6b4a2","#4e5d69",253)
    p.sky("#9094b1",-.04)
    # The late twilight has a few stars above a sliver of moon.
    for _ in range(78):
        x,y=p.r.uniform(0,1200),p.r.uniform(2,132)
        p.ellipse(x,y,.65,.7,mix("#9296ac","#e9ddbd",p.r.uniform(.1,.8)))
    x,y,r=767,91,18
    crescent=[]
    for j in range(37):
        a=math.pi/2+j*math.pi/36
        crescent.append((x+math.cos(a)*r,y+math.sin(a)*r))
    for j in range(37):
        a=-math.pi/2-j*math.pi/36
        crescent.append((x+math.cos(a)*r*.64+2,y+math.sin(a)*r))
    p.poly(crescent,"#ebe0c0")
    p.ridge(220,55,"#aaa6b2","#bdb3b9",102)
    p.ridge(252,51,"#8d92a3","#a7a3ab",451)
    p.ridge(274,77,"#788297","#8e8ea0",970)
    far=p.ridge(303,72,"#637387","#88909a",755)
    for i in range(0,len(far),2):
        u,v=far[i]
        pine(p,u,v+2,p.r.uniform(3,13),"#687789","#748091")
    p.ridge(355,74,"#586977","#7a848c",840)
    # Island lights far below. A narrow warm road breaks the cool valley.
    for _ in range(85):
        x=p.r.uniform(24,1188)
        y=346+16*math.sin(x/53)+p.r.gauss(0,7)
        if p.r.random()<.83:
            p.ellipse(x,y,p.r.uniform(.6,1.8),.7,"#d4bd96")
    p.wash([(-5,394),(56,374),(118,347),(186,331),(256,338),(309,326),
            (381,326),(459,296),(510,283),(581,276),(637,269),(696,278),
            (742,307),(770,347),(857,364),(967,365),(1024,383),(1204,363),
            (1204,681),(-5,681)],"#596c68","#89927c",1350,(.9,-.45),33)
    # Slabs, shallow grass and cut-stone retaining walls shape the summit road.
    p.wash([(130,681),(208,607),(329,545),(494,504),(655,468),(744,427),
            (730,402),(640,393),(547,386),(474,366),(495,342),(616,312),
            (684,301),(637,296),(569,309),(476,330),(437,357),(438,377),
            (496,399),(621,415),(661,428),(611,444),(436,472),(300,497),
            (146,548),(-5,635),(-5,681)],"#96908a","#c7b6a0",680,(1,-.18),27)
    p.wash([(825,416),(913,380),(1027,370),(1156,394),(1202,415),
            (1203,512),(1126,538),(1011,518),(922,482)],"#727780","#adb0a1",360,(.8,-.5),30)
    def rock(x,y,w,h):
        p.wash([(x-w,y),(x-w*.63,y-h*.68),(x-w*.2,y-h),(x+w*.5,y-h*.77),
                (x+w,y-h*.13),(x+w*.38,y+h*.09)],"#667078","#97988e",28,(.8,-.22),w*.3)
        p.poly([(x-w*.62,y-h*.66),(x-w*.2,y-h),(x+w*.48,y-h*.76),
                (x+w*.08,y-h*.53),(x-w*.18,y-h*.57)],"#a1a095")
    for _ in range(76):
        x,y=p.r.uniform(-15,1210),p.r.uniform(411,685)
        rock(x,y,p.r.uniform(2,18),p.r.uniform(2,9))
    for x,y,h in [(10,371,50),(35,360,62),(63,345,53),(103,341,30),
                  (333,338,34),(353,335,51),(370,337,39),(753,350,38),
                  (783,363,52),(808,354,30),(1181,389,109),(1146,390,76)]:
        pine(p,x,y,h,"#495d5e","#68776b")
    # A windsock with a sagging seam reads clearly against the distant peaks.
    p.wash([(195,346),(260,332),(287,339),(283,348),(203,357)],"#858478","#a7a38e",65)
    post(p,243,342,109,"#525e62","#c0b5a1",2.8)
    p.line([(243,239),(259,226),(264,227)],"#aab0ac",1.6)
    p.line([(244,246),(266,233)],"#bab8a7")
    p.line([(243,259),(209,344)],"#949a8d")
    p.line([(243,259),(271,339)],"#9b9f91")
    for j in range(7):
        a=j/7;b=(j+1)/7
        def sock(t,side):
            return 262+76*t,228-11*math.sin(t*2.8)+6*t+side*(9-6*t)
        p.wash([sock(a,-1),sock(b,-1),sock(b,1),sock(a,1)],
               ["#cc7667","#ddceb1"][j%2],["#f0a185","#f3e3c6"][j%2],12,(1,0),8)
    p.line([(262,218),(262,238)],"#d8c3a7",2)
    # Recording hut with a copper meridian dome; the rain gauge stands alongside.
    cabin(p,601,244,.95,"#acada4","#73858a","#6d8087","#f1cb97")
    p.poly([(609,209),(609,197),(612,187),(617,177),(625,170),(637,167),
            (647,171),(655,179),(661,190),(663,206),(650,213)],"#708b8d")
    p.poly([(609,199),(613,186),(620,175),(632,168),(637,167),(626,179),
            (623,190),(623,208),(610,208)],"#abb6a7")
    for k in [-1,0,1]:
        p.line([(635,169),(635+k*9,177),(635+k*16,191),(635+k*19,207)],"#667d80",1.5)
    p.line([(606,207),(640,212),(666,207)],"#465e67",3)
    p.line([(636,169),(636,154)],"#526572",2)
    p.line([(627,158),(649,157),(645,154)],"#78878a",1.8)
    # Slatted instrument shelter and the large copper precipitation funnel.
    for u in [677,697]:
        post(p,u,298,43,"#697977","#b5bdab",2.2)
    p.poly([(668,264),(692,261),(706,265),(706,282),(684,288),(668,282)],"#c6c9b8")
    p.line([(665,263),(691,256),(709,263)],"#d7cbb3",3)
    for j in range(4):
        p.line([(670,266+j*4),(684,269+j*4),(704,265+j*4)],"#818e8b",1.6)
    p.ellipse(652,283,12,4,"#bca993")
    p.poly([(641,282),(663,281),(659,289),(658,307),(647,309),(646,289)],"#8b9c99")
    p.line([(647,290),(648,305)],"#d8cfb2",2)
    # A beacon with glass, brass mullions, a Fresnel lens and a service balcony.
    p.wash([(858,471),(897,447),(965,437),(1008,457),(978,480),(903,490)],
           "#7e7c78","#b4ac94",150,(1,-.3),19)
    p.wash([(894,457),(903,366),(952,364),(963,454),(931,469)],"#a7a69a","#d8cabb",250,(.12,1),17)
    p.wash([(931,469),(936,368),(952,364),(963,454)],"#798887","#adb2a3",86,(.15,1),13)
    for j in range(7):
        a=j/7
        p.line([lerp((894,457),(903,366),a),lerp((931,469),(936,368),a),lerp((963,454),(952,364),a)],"#969b91",.85)
    p.poly([(909,455),(911,425),(915,419),(923,421),(926,427),(924,459)],"#57696b")
    p.line([(916,451),(916,428)],"#83928a",1.8)
    p.poly([(889,369),(901,360),(946,355),(971,364),(960,373),(916,381)],"#465c62")
    p.poly([(890,366),(907,356),(946,352),(970,362),(952,368),(915,374)],"#b7afa0")
    p.poly([(906,359),(906,315),(924,308),(949,315),(949,356),(931,364)],"#e9b971")
    p.poly([(909,319),(923,314),(923,359),(910,354)],"#ffe1a1")
    p.poly([(929,314),(946,319),(946,352),(929,357)],"#cfa978")
    for j in range(7):
        p.line([(912,328+j*3),(925,325+j*3),(945,329+j*3)],"#f4d79c",1.1)
    for x,y in [(906,314),(925,308),(949,314)]:
        p.line([(x,y),(x,y+46)],"#495f62",3.1)
    p.poly([(897,316),(905,307),(913,303),(924,287),(938,305),(949,308),(958,316),(929,323)],"#566d70")
    p.poly([(898,316),(914,305),(924,287),(925,312),(929,322)],"#81948b")
    p.line([(923,288),(923,277)],"#64696a",2.2)
    p.ellipse(923,278,2.7,3,"#c7b79c")
    for x,y in [(889,365),(905,370),(918,373),(940,369),(963,364)]:
        p.line([(x,y),(x,y-14)],"#4e6163",1.8)
    p.line([(887,350),(916,359),(944,354),(965,347)],"#8e968b",2.2)
    p.line([(1001,465),(1062,436),(1116,433)],"#606a68",1.6)
    for x,y in [(1000,482),(1061,455),(1115,450)]:
        post(p,x,y,24,"#626b68","#9e9b89",2.5)
    # Steep foreground outcrop and dark conifers frame the amber lens.
    p.wash([(-10,527),(66,490),(97,493),(151,522),(192,528),(256,559),
            (278,603),(359,649),(412,682),(-10,682)],"#424f58","#68746d",220,(.8,-.45),27)
    p.wash([(748,679),(817,624),(875,611),(944,589),(1001,552),(1080,546),
            (1113,514),(1202,496),(1202,684)],"#48565b","#758079",300,(.73,-.5),34)
    for x,y,h in [(-19,551,195),(18,529,171),(55,506,101),(86,493,75),
                  (1195,524,220),(1164,530,108),(1136,532,73),(1089,551,46)]:
        pine(p,x,y,h,"#384950","#516059")
    for x,y,w,h in [(36,657,63,48),(117,654,39,21),(891,668,52,26),(1074,646,58,38),(1189,618,66,41)]:
        rock(x,y,w,h)
    for _ in range(125):
        x=p.r.choice([p.r.uniform(-14,201),p.r.uniform(922,1209)])
        y=p.r.uniform(606,690)
        reed_clump(p,x,y,p.r.uniform(5,23),["#495856","#6d7669","#91917a"],9)
    p.finish("observatory")


if __name__ == "__main__":
    marsh()
    saltworks()
    observatory()
