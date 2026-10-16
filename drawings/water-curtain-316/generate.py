#!/usr/bin/env python3
"""Generate the shop drawing for a SUS316 water curtain (L=1000, inlet G1-1/2").

Output: water-curtain-316.svg (A3 landscape, units = mm on paper).
Run:  python3 generate.py
"""
import math
from pathlib import Path

# ---------------------------------------------------------------- design data (mm)
L = 1000.0       # overall length incl. end caps
W_TOP = 170.0    # overall depth (top plate)
W_BODY = 120.0   # body depth
H = 140.0        # overall height
H_LIP = 20.0     # lip height
T = 1.5          # sheet thickness
SLOT = 5.0       # outlet slot gap
BAFFLE_Y = 60.0  # perforated baffle height from bottom
SOCK_X = 60.0    # inlet centre from back face
SOCK_OD = 60.0   # socket outside diameter
SOCK_H = 25.0    # socket height
G_MAJOR = 47.803  # G1-1/2 major dia
G_MINOR = 44.845  # G1-1/2 minor dia
HOLE = 50.0      # hole in bottom plate

FONT = "Loma, 'Noto Sans Thai', Garuda, sans-serif"
out = []


def a(s):
    out.append(s)


def f(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")


def line(x1, y1, x2, y2, cls="vis"):
    a(f'<line class="{cls}" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>')


def rect(x, y, w, h, cls="vis"):
    a(f'<rect class="{cls}" x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}"/>')


def circle(cx, cy, r, cls="vis"):
    a(f'<circle class="{cls}" cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/>')


def text(x, y, s, size=3.0, anchor="middle", weight="normal", rot=0, cls="txt"):
    s = s.replace("&", "&amp;").replace("<", "&lt;")
    tr = f' transform="rotate({rot} {f(x)} {f(y)})"' if rot else ""
    a(f'<text class="{cls}" x="{f(x)}" y="{f(y)}" font-size="{size}" '
      f'text-anchor="{anchor}" font-weight="{weight}"{tr}>{s}</text>')


def dim_h(x1, x2, y, ref1, ref2, label, size=2.8):
    """Horizontal dimension between x1 and x2 drawn at y; refs are y of the features."""
    for x, r in ((x1, ref1), (x2, ref2)):
        d = 1.5 if y > r else -1.5
        line(x, r + (0.8 if y > r else -0.8), x, y + d, "dim")
    line(x1, y, x2, y, "dimarrow")
    text((x1 + x2) / 2, y - 1.0, label, size)


def dim_v(y1, y2, x, ref1, ref2, label, size=2.8, side="left"):
    for yy, r in ((y1, ref1), (y2, ref2)):
        d = 1.5 if x > r else -1.5
        line(r + (0.8 if x > r else -0.8), yy, x + d, yy, "dim")
    line(x, y1, x, y2, "dimarrow")
    tx = x - 1.0 if side == "left" else x + 1.0
    text(tx, (y1 + y2) / 2, label, size, rot=-90 if side == "left" else 90)


def leader(x1, y1, x2, y2, label, size=2.6, anchor="start"):
    a(f'<polyline class="lead" points="{f(x1)},{f(y1)} {f(x2)},{f(y2)} '
      f'{f(x2 + (12 if anchor == "start" else -12))},{f(y2)}"/>')
    text(x2 + (0.8 if anchor == "start" else -0.8), y2 - 0.8, label, size, anchor)


# ---------------------------------------------------------------- sheet
SW, SH = 420, 297
a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{SW}mm" height="{SH}mm" '
  f'viewBox="0 0 {SW} {SH}">')
a(f"""<defs>
<marker id="ar" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="3"
 markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,1.8 L10,5 L0,8.2 z" fill="#000"/></marker>
<marker id="flow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3.5" markerHeight="3.5"
 markerUnits="userSpaceOnUse" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="#1f6fd1"/></marker>
<pattern id="hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<line x1="0" y1="0" x2="0" y2="1.6" stroke="#000" stroke-width="0.18"/></pattern>
</defs>
<style>
text{{font-family:{FONT};fill:#000}}
.vis{{fill:none;stroke:#000;stroke-width:0.5}}
.thin{{fill:none;stroke:#000;stroke-width:0.25}}
.hid{{fill:none;stroke:#000;stroke-width:0.3;stroke-dasharray:1.5 0.8}}
.ctr{{fill:none;stroke:#c00;stroke-width:0.2;stroke-dasharray:6 1 1 1}}
.dim{{fill:none;stroke:#000;stroke-width:0.18}}
.dimarrow{{fill:none;stroke:#000;stroke-width:0.18;marker-start:url(#ar);marker-end:url(#ar)}}
.lead{{fill:none;stroke:#000;stroke-width:0.18;marker-start:url(#ar)}}
.sec{{fill:#000;stroke:none}}
.hatch{{fill:url(#hatch);stroke:#000;stroke-width:0.3}}
.slot{{fill:#555;stroke:none}}
.flow{{fill:none;stroke:#1f6fd1;stroke-width:0.45;stroke-dasharray:2 1;marker-end:url(#flow)}}
.inv{{fill:#fff}}
.frame{{fill:none;stroke:#000;stroke-width:0.7}}
.cut{{fill:none;stroke:#000;stroke-width:0.7}}
</style>
<rect x="0" y="0" width="{SW}" height="{SH}" fill="#fff"/>""")
rect(20, 10, 390, 277, "frame")

# ================================================================ SECTION A-A (1:1)
OX, OY = 45.0, 176.0          # sheet position of (back face, bottom)
S = 1.0


def P(x, y):
    return OX + x * S, OY - y * S


def srect(x0, y0, x1, y1, cls="sec"):
    (sx0, sy0), (sx1, sy1) = P(x0, y1), P(x1, y0)
    rect(sx0, sy0, sx1 - sx0, sy1 - sy0, cls)


# sheet-metal walls (solid black = section of thin plate)
srect(0, 0, T, H)                          # back wall
srect(0, H - T, W_TOP, H)                  # top plate
srect(0, 0, (SOCK_X - HOLE / 2), T)        # bottom plate (left of hole)
srect(SOCK_X + HOLE / 2, 0, W_BODY, T)     # bottom plate (right of hole)
srect(W_BODY - T, 0, W_BODY, H - T - SLOT)  # body front wall
srect(W_BODY, H - H_LIP, W_TOP, H - H_LIP + T)  # lip bottom
srect(W_TOP - T, H - H_LIP, W_TOP, H - T - SLOT)  # lip front (closed part)
srect(W_BODY - T, H - T - SLOT - T, W_TOP, H - T - SLOT)  # slot floor

# perforated baffle (gaps = holes)
xb = T
while xb < W_BODY - T:
    x2 = min(xb + 9.0, W_BODY - T)
    srect(xb, BAFFLE_Y, x2, BAFFLE_Y + T)
    xb = x2 + 6.0

# inlet socket (hatched solid round bar section), internal thread G1-1/2
r_o, r_maj, r_min = SOCK_OD / 2, G_MAJOR / 2, G_MINOR / 2
for side in (-1, 1):
    xa, xb2 = SOCK_X + side * r_maj, SOCK_X + side * r_o
    srect(min(xa, xb2), T, max(xa, xb2), T + SOCK_H, "hatch")
    # thread minor diameter (thick) + major (thin)
    x_min = SOCK_X + side * r_min
    line(*P(x_min, T), *P(x_min, T + SOCK_H), "vis")
# fillet welds
for xw in (SOCK_X - r_o, SOCK_X + r_o):
    s = -1 if xw < SOCK_X else 1
    x0, y0 = P(xw, T)
    a(f'<polygon class="sec" points="{f(x0)},{f(y0)} {f(x0 + s*2.5)},{f(y0)} {f(x0)},{f(y0 - 2.5)}"/>')
line(*P(SOCK_X, -12), *P(SOCK_X, T + SOCK_H + 8), "ctr")

# flow arrows
fl = [
    [(SOCK_X, -10), (SOCK_X, BAFFLE_Y - 8)],
    [(SOCK_X - 25, BAFFLE_Y + 6), (SOCK_X - 25, 112)],
    [(SOCK_X + 25, BAFFLE_Y + 6), (SOCK_X + 25, 112), (W_BODY - 8, H - T - SLOT / 2),
     (W_TOP + 14, H - T - SLOT / 2)],
    [(W_TOP + 4, H - T - SLOT / 2 - 2), (W_TOP + 9, H - 40), (W_TOP + 10, 70)],
]
for pts in fl:
    a('<polyline class="flow" points="' + " ".join(f"{f(P(*p)[0])},{f(P(*p)[1])}" for p in pts) + '"/>')
text(*(lambda p: (p[0] + 1.5, p[1]))(P(W_TOP + 10, 80)), "WATER SHEET", 2.6, "start")

# dimensions – section
x0, ytop = P(0, H)
x170, _ = P(W_TOP, H)
x120, ybot = P(W_BODY, 0)
dim_h(x0, x170, ytop - 14, ytop, ytop, "170")
dim_h(x120, x170, ytop - 7, ytop, ytop, "50")
dim_h(x0, x120, ybot + 18, ybot, ybot, "120")
xs, _ = P(SOCK_X, 0)
dim_h(x0, xs, ybot + 10, ybot, ybot + 12, "60")
dim_v(ytop, ybot, x0 - 12, x0, x0, "140")
_, yb = P(0, BAFFLE_Y)
dim_v(yb, ybot, x0 - 5, x0, x0, "60", side="left")
_, ylip = P(0, H - H_LIP)
dim_v(ytop, ylip, x170 + 20, x170, x170, "20", side="right")
_, ys1 = P(0, H - T)
_, ys2 = P(0, H - T - SLOT)
leader(x170 - 0.5, (ys1 + ys2) / 2, x170 + 8, ytop - 3, "OUTLET SLOT 5 mm, FULL LENGTH")

gx, gy = P(SOCK_X - r_min, 12)
a(f'<polyline class="lead" points="{f(gx)},{f(gy)} {f(OX + 6)},{f(OY + 27)} {f(OX + 2)},{f(OY + 27)}"/>')
text(OX - 18, OY + 31, 'FEMALE THREAD G1½" (BSPP)', 2.8, "start", "bold")
text(OX - 18, OY + 34.6, "SUS316 SOCKET Ø60 × 25 H", 2.5, "start")
leader(*P(104, BAFFLE_Y + T), *P(90, BAFFLE_Y + 16),
       "PERFORATED BAFFLE Ø6 @15", 2.5, "end")
leader(*P(T, 100), *(lambda p: (p[0] + 10, p[1] - 8))(P(T, 100)), "SUS316 t = 1.5", 2.5)
leader(*P(140, H - H_LIP + T / 2), *P(108, H - H_LIP - 10),
       "SEALED BOX (FULLY WELDED)", 2.5, "end")

text(OX + 85, OY + 40, "SECTION A-A", 4.2, weight="bold")
text(OX + 85, OY + 45, "SCALE 1:1", 3.0)

# ================================================================ FRONT VIEW (1:5)
FS = 0.12
FX, FY = 266.0, 124.0   # sheet position of (L=0, bottom)


def F(l, y):
    return FX + l * FS, FY - y * FS


fx0, fy0 = F(0, 0)
fx1, fy1 = F(L, H)
rect(fx0, fy1, fx1 - fx0, fy0 - fy1)
line(*F(0, H - H_LIP), *F(L, H - H_LIP))
sx0, sy0 = F(T, H - T)
sx1, sy1 = F(L - T, H - T - SLOT)
rect(sx0, sy0, sx1 - sx0, sy1 - sy0, "slot")
line(*F(0, H - T - SLOT), *F(L, H - T - SLOT), "thin")
line(*F(0, H - T), *F(L, H - T), "thin")
# hidden inlet
hx0, hy0 = F(L / 2 - r_o, T + SOCK_H)
hx1, hy1 = F(L / 2 + r_o, 0)
rect(hx0, hy0, hx1 - hx0, hy1 - hy0, "hid")
line(*F(L / 2, -12), *F(L / 2, H + 8), "ctr")
# section mark A-A
for xx in (fx0 - 8, fx1 + 2):
    line(xx, fy1 - 2, xx + 6, fy1 - 2, "cut")
for xx, d in ((fx0 - 5, 1), (fx1 + 5, 1)):
    pass
text(fx0 - 5, fy1 - 3.5, "A", 3.4, weight="bold")
text(fx1 + 5, fy1 - 3.5, "A", 3.4, weight="bold")
dim_h(fx0, fx1, fy1 - 8, fy1, fy1, "1000")
dim_h(fx0, F(L / 2, 0)[0], fy0 + 7, fy0, fy0, "500")
dim_v(fy1, fy0, fx1 + 9, fx1, fx1, "140", side="right")
text((fx0 + fx1) / 2, fy0 + 14, "FRONT VIEW (OUTLET SIDE)", 3.6, weight="bold")

# ================================================================ BOTTOM VIEW (1:5)
BX, BY = 266.0, 146.0   # sheet position of (L=0, back face) ; depth grows downward


def B(l, d):
    return BX + l * FS, BY + d * FS


bx0, by0 = B(0, 0)
bx1, by1 = B(L, W_TOP)
rect(bx0, by0, bx1 - bx0, by1 - by0)
line(*B(0, W_BODY), *B(L, W_BODY))
cx, cy = B(L / 2, SOCK_X)
circle(cx, cy, HOLE / 2 * FS, "vis")
circle(cx, cy, r_min * FS, "thin")
circle(cx, cy, r_o * FS, "hid")
line(cx - 8, cy, cx + 8, cy, "ctr")
line(cx, cy - 8, cx, cy + 8, "ctr")
dim_v(by0, by1, bx1 + 9, bx1, bx1, "170", side="right")
dim_v(by0, B(0, W_BODY)[1], bx0 - 4, bx0, bx0, "120", side="left")
dim_h(bx0, cx, by1 + 5, by1, cy, "500")
leader(cx + 2, cy - 2, cx + 14, by0 - 3, 'G1½" FEMALE INLET (CENTRE)', 2.4)
text((bx0 + bx1) / 2, by1 + 12, "BOTTOM VIEW", 3.6, weight="bold")

# ================================================================ ISOMETRIC (approx 1:10)
IS = 0.12
IX, IY = 280.0, 72.0
cl, sl = math.cos(math.radians(12)), math.sin(math.radians(12))
cd, sd = math.cos(math.radians(40)), math.sin(math.radians(40))


def I(l, x, y):
    # l along length (right, slightly up), x = depth (outlet toward viewer), y up
    return (IX + (l * cl - x * cd * 0.6) * IS,
            IY - (l * sl - x * sd * 0.6 + y) * IS)


prof = [(0, 0), (W_BODY, 0), (W_BODY, H - H_LIP), (W_TOP, H - H_LIP), (W_TOP, H), (0, H)]
for ll in (0, L):
    a('<polygon class="vis" fill="#f2f2f2" points="' +
      " ".join(f"{f(I(ll, x, y)[0])},{f(I(ll, x, y)[1])}" for x, y in prof) + '"/>')
for x, y in prof:
    if (x, y) in ((0, 0),):
        continue
    line(*I(0, x, y), *I(L, x, y), "vis")
line(*I(0, W_TOP, H - T - SLOT / 2), *I(L, W_TOP, H - T - SLOT / 2), "thin")
text(IX + 52, IY + 16, "ISOMETRIC VIEW (NOT TO SCALE)", 3.4, weight="bold")

# ================================================================ NOTES
NX, NY = 28.0, 232.0
text(NX, NY, "NOTES / SPECIFICATION", 3.8, "start", "bold")
notes = [
    "1. MATERIAL: STAINLESS STEEL SUS316 (AISI 316), t = 1.5 mm THROUGHOUT",
    "2. WATER INLET: SUS316 SOCKET, FEMALE THREAD G1½\" (BSPP / Rp1½)",
    "    WELDED TO BOTTOM AT MID-LENGTH (L = 500), QTY 1",
    "3. OVERALL LENGTH 1000 mm INCLUDING END CAPS (t = 1.5)",
    "4. OUTLET SLOT 5 mm GAP × 50 mm DEEP, FULL LENGTH",
    "    LIP STRAIGHT & LEVEL WITHIN ±0.3 mm FOR A SMOOTH SHEET",
    "5. FLOW BAFFLE: PERFORATED Ø6 HOLES @ 15 mm PITCH",
    "6. CONTINUOUS TIG WELD ALL SEAMS, ER316L FILLER, WATERTIGHT",
    "7. EXTERNAL FINISH: HAIRLINE / No.8 MIRROR (PER CLIENT)",
    "    CLEAN WELDS & PASSIVATE AFTER WELDING",
    "8. HYDROSTATIC LEAK TEST 1.5 bar FOR 10 MIN",
    "9. GENERAL TOLERANCE ±1 mm (ISO 2768-m)",
    "10. SUGGESTED PUMP FLOW: APPROX. 6–10 m³/h PER 1 m",
]
for i, n in enumerate(notes):
    col, row = (0, i) if i < 7 else (1, i - 7)
    text(NX + col * 112, NY + 6 + row * 6.2, n, 2.45, "start")

# ================================================================ TITLE BLOCK
TX, TY, TW, TH = 250.0, 219.0, 160.0, 68.0
rect(TX, TY, TW, TH, "frame")
a(f'<rect x="{f(TX)}" y="{f(TY)}" width="{f(TW)}" height="10" fill="#111"/>')
text(TX + TW / 2, TY + 6.8, "WONDER TECHNOLOGY CO., LTD.", 5.0, weight="bold", cls="inv")
TY += 10
line(TX, TY + 8, TX + TW, TY + 8, "thin")
text(TX + 2, TY + 3.2, "PROJECT", 2.1, "start")
text(TX + TW / 2 + 12, TY + 6.2, "VELRA THONGLOR", 4.4, weight="bold")
TY += 8
rows = [TY + 12, TY + 22, TY + 31, TY + 40]
for yy in rows:
    line(TX, yy, TX + TW, yy, "thin")
line(TX + 80, rows[0], TX + 80, TY + TH - 18, "thin")
text(TX + TW / 2, TY + 5.5, "STAINLESS STEEL 316 WATER CURTAIN", 4.6, weight="bold")
text(TX + TW / 2, TY + 10.2, 'L 1000 × 170 × 140 mm  •  INLET G1½" FEMALE THREAD', 3.0)
cells = [
    (TX + 2, rows[0] + 4, "MATERIAL", "SUS316  t = 1.5 mm"),
    (TX + 82, rows[0] + 4, "DRAWING No.", "WC-316-1000-01"),
    (TX + 2, rows[1] + 4, "SCALE", "AS SHOWN (A3)"),
    (TX + 82, rows[1] + 4, "UNITS", "MILLIMETRES (mm)"),
    (TX + 2, rows[2] + 4, "QTY", "1 SET"),
    (TX + 82, rows[2] + 4, "DATE", "16/10/2026"),
    (TX + 2, rows[3] + 4, "DRAWN BY", "................"),
    (TX + 82, rows[3] + 4, "CHECKED / APPROVED", "................"),
]
for x, y, k, v in cells:
    text(x, y - 0.6, k, 2.1, "start")
    text(x + 2, y + 4.6, v, 3.2, "start", "bold")

a("</svg>")
Path(__file__).with_name("water-curtain-316.svg").write_text("\n".join(out), encoding="utf-8")
print("written")
