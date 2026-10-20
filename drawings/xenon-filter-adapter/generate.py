"""Generate the xenon-reactor filter adapter drawing (SVG) and laser DXF files.

Run:  python3 generate.py   (needs: pip install ezdxf)
All dimensions in mm. Origin = optical/tube axis.
"""
import math
from pathlib import Path

import ezdxf

OUT = Path(__file__).parent

# ---------------- design parameters ----------------
T_SHEET = 2.0          # body sheet thickness (5052-H32)
R_IN = 2.0             # inside bend radius
K = 0.40               # K-factor (check with shop's bend table)
FLANGE = 8.0           # flange height, outside -> slot gap = FLANGE - T_SHEET
GAP = FLANGE - T_SHEET  # 6.0
BODY_W = 71.0          # body outer width (X)
BODY_H = 70.0          # body outer height (Y), -35..+35
APERTURE = 46.0        # light aperture in both plates
TUBE_A = (55.8, 2.0, 40.0)   # OD, wall, length
TUBE_B = (56.0, 2.0, 40.0)
FILTER = 50.0          # filter 50 x 50
FILTER_T = 2.0         # filter thickness
POCKET = 50.5
CARR_T = 5.0           # carrier stack = P05 + P06
CARR_A = 3.0           # P05 pocket plate (holds filter)
CARR_B = 2.0           # P06 ledge plate
LEDGE = 46.0           # P06 square window -> 2.25 ledge
SCREW_XY = (28.9, 29.0)  # M2 countersunk screw positions (+/-)
CARR_W = 65.0
CARR_BOT = -33.0
CARR_TOP = 33.0
HANDLE_W = 30.0
HANDLE_TOP = 55.0
FINGER_D = 12.0
FINGER_Y = 44.0

BA = math.pi / 2 * (R_IN + K * T_SHEET)          # bend allowance
OSSB = R_IN + T_SHEET                             # outside setback
BD = 2 * OSSB - BA                                # bend deduction
FLAT_W = BODY_W + 2 * FLANGE - 2 * BD
FLAT_H = BODY_H + FLANGE - BD
HB = BODY_H / 2
XB = BODY_W / 2 - OSSB          # base flat ends (x)
YB = -HB + OSSB                 # base flat ends (y, bottom)
XF = FLAT_W / 2
YF = HB - FLAT_H
RELIEF = 0.5
NOTCH_X = XB - RELIEF
NOTCH_Y = YB + RELIEF
BEND_X = XB + BA / 2
BEND_Y = YB - BA / 2


# ---------------- DXF ----------------
def dxf_doc():
    doc = ezdxf.new("R2000", setup=True)
    doc.units = ezdxf.units.MM
    doc.layers.add("CUT", color=7)
    doc.layers.add("BEND", color=1, linetype="DASHED")
    doc.layers.add("NOTE", color=3)
    return doc


def front_body_outline():
    return [(-XF, HB), (-XF, NOTCH_Y), (-NOTCH_X, NOTCH_Y), (-NOTCH_X, YF),
            (NOTCH_X, YF), (NOTCH_X, NOTCH_Y), (XF, NOTCH_Y), (XF, HB)]


def carrier_outline():
    c = 2.0  # bottom corner chamfer
    h, r = HANDLE_W / 2, 5.0
    w = CARR_W / 2
    return [(-w + c, CARR_BOT), (w - c, CARR_BOT), (w, CARR_BOT + c), (w, CARR_TOP),
            (h, CARR_TOP), (h, HANDLE_TOP - r), ("arc", h - r, HANDLE_TOP - r, 0, 90),
            (-h + r, HANDLE_TOP), ("arc", -h + r, HANDLE_TOP - r, 90, 180),
            (-h, CARR_TOP), (-w, CARR_TOP), (-w, CARR_BOT + c)]


def ledge_outline():
    c, w = 2.0, CARR_W / 2
    return [(-w + c, CARR_BOT), (w - c, CARR_BOT), (w, CARR_BOT + c), (w, CARR_TOP),
            (-w, CARR_TOP), (-w, CARR_BOT + c)]


def write_dxfs():
    # 01 front body flat pattern
    doc = dxf_doc(); m = doc.modelspace()
    m.add_lwpolyline(front_body_outline(), close=True, dxfattribs={"layer": "CUT"})
    m.add_circle((0, 0), APERTURE / 2, dxfattribs={"layer": "CUT"})
    for sx in (-1, 1):
        m.add_line((sx * BEND_X, NOTCH_Y), (sx * BEND_X, HB), dxfattribs={"layer": "BEND"})
    m.add_line((-NOTCH_X, BEND_Y), (NOTCH_X, BEND_Y), dxfattribs={"layer": "BEND"})
    m.add_text("P01 FRONT BODY  AL5052-H32 t2.0  QTY1  BEND UP 90deg R2 x3",
               height=2.5, dxfattribs={"layer": "NOTE"}).set_placement((-XF, HB + 4))
    doc.saveas(OUT / "P01_front_body_flat_t2.dxf")

    # 02 back plate
    doc = dxf_doc(); m = doc.modelspace()
    w = BODY_W / 2
    m.add_lwpolyline([(-w, -HB), (w, -HB), (w, HB), (-w, HB)], close=True, dxfattribs={"layer": "CUT"})
    m.add_circle((0, 0), APERTURE / 2, dxfattribs={"layer": "CUT"})
    m.add_text("P02 BACK PLATE  AL5052-H32 t2.0  QTY1", height=2.5,
               dxfattribs={"layer": "NOTE"}).set_placement((-w, HB + 4))
    doc.saveas(OUT / "P02_back_plate_t2.dxf")

    # 05 filter carrier
    doc = dxf_doc(); m = doc.modelspace()
    pts = carrier_outline()
    for a, b in zip(pts, pts[1:] + pts[:1]):
        if a[0] == "arc":
            continue
        if b[0] == "arc":
            _, cx, cy, s, e = b
            m.add_arc((cx, cy), 5.0, s, e, dxfattribs={"layer": "CUT"})
            continue
        m.add_line(a, b, dxfattribs={"layer": "CUT"})
    # arc endpoints connect to following points
    p = POCKET / 2
    m.add_lwpolyline([(-p, -p), (p, -p), (p, p), (-p, p)], close=True, dxfattribs={"layer": "CUT"})
    m.add_circle((0, FINGER_Y), FINGER_D / 2, dxfattribs={"layer": "CUT"})
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.add_circle((sx * SCREW_XY[0], sy * SCREW_XY[1]), 0.8, dxfattribs={"layer": "CUT"})
    m.add_text("P05 FILTER CARRIER  AL6061-T6 t3.0  QTY1  4x D1.6 TAP M2", height=2.5,
               dxfattribs={"layer": "NOTE"}).set_placement((-CARR_W / 2, HANDLE_TOP + 4))
    doc.saveas(OUT / "P05_filter_carrier_t3.dxf")

    # 06 ledge plate
    doc = dxf_doc(); m = doc.modelspace()
    m.add_lwpolyline(ledge_outline(), close=True, dxfattribs={"layer": "CUT"})
    q = LEDGE / 2
    m.add_lwpolyline([(-q, -q), (q, -q), (q, q), (-q, q)], close=True, dxfattribs={"layer": "CUT"})
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.add_circle((sx * SCREW_XY[0], sy * SCREW_XY[1]), 1.2, dxfattribs={"layer": "CUT"})
    m.add_text("P06 LEDGE PLATE  AL5052-H32 t2.0  QTY1  4x D2.4 CSK90 M2", height=2.5,
               dxfattribs={"layer": "NOTE"}).set_placement((-CARR_W / 2, CARR_TOP + 4))
    doc.saveas(OUT / "P06_ledge_plate_t2.dxf")


# ---------------- SVG helpers ----------------
svg = []
FONT = "Loma, 'Noto Sans Thai', sans-serif"


def f(v):
    return f"{v:.2f}"


def view(ox, oy):
    return lambda x, y: (ox + x, oy - y)


def poly(P, pts, cls="vis", close=True, extra=""):
    d = " ".join(f"{f(P(*p)[0])},{f(P(*p)[1])}" for p in pts)
    tag = "polygon" if close else "polyline"
    svg.append(f'<{tag} class="{cls}" points="{d}" {extra}/>')


def rect(P, x1, y1, x2, y2, cls="vis"):
    poly(P, [(x1, y1), (x2, y1), (x2, y2), (x1, y2)], cls)


def circle(P, x, y, r, cls="vis"):
    cx, cy = P(x, y)
    svg.append(f'<circle class="{cls}" cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/>')


def line(P, a, b, cls="vis"):
    (x1, y1), (x2, y2) = P(*a), P(*b)
    svg.append(f'<line class="{cls}" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>')


def text(x, y, s, size=3.0, anchor="start", weight="normal", rot=0, cls="txt"):
    tr = f' transform="rotate({rot} {f(x)} {f(y)})"' if rot else ""
    svg.append(f'<text class="{cls}" x="{f(x)}" y="{f(y)}" font-size="{size}" '
               f'text-anchor="{anchor}" font-weight="{weight}"{tr}>{s}</text>')


def dim_h(P, x1, x2, y, label, off=0.0):
    """horizontal dimension at model height y (dimension line at y)."""
    a, b = P(x1, y), P(x2, y)
    svg.append(f'<line class="dim" x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" '
               'marker-start="url(#arr)" marker-end="url(#arr)"/>')
    text((a[0] + b[0]) / 2 + off, a[1] - 1.0, label, 2.8, "middle", cls="dimt")


def dim_v(P, y1, y2, x, label):
    a, b = P(x, y1), P(x, y2)
    svg.append(f'<line class="dim" x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" '
               'marker-start="url(#arr)" marker-end="url(#arr)"/>')
    text(a[0] - 1.0, (a[1] + b[1]) / 2, label, 2.8, "middle", rot=-90, cls="dimt")


def ext(P, a, b):
    line(P, a, b, "ext")


def leader(P, at, to, label, anchor="start"):
    (x1, y1), (x2, y2) = P(*at), P(*to)
    svg.append(f'<polyline class="dim" points="{f(x1)},{f(y1)} {f(x2)},{f(y2)} '
               f'{f(x2 + (12 if anchor == "start" else -12))},{f(y2)}" marker-start="url(#arr)"/>')
    text(x2 + (1 if anchor == "start" else -1), y2 - 0.8, label, 2.8, anchor, cls="dimt")


def title(x, y, s, sub=""):
    text(x, y, s, 4.0, "middle", "bold")
    if sub:
        text(x, y + 4.5, sub, 2.8, "middle")


# ---------------- views ----------------
def front_view(ox, oy):
    P = view(ox, oy)
    w = BODY_W / 2
    # carrier (hidden inside body) and handle (visible)
    poly(P, [(-w + 2, CARR_BOT) if False else (-CARR_W / 2 + 2, CARR_BOT), (CARR_W / 2 - 2, CARR_BOT),
             (CARR_W / 2, CARR_BOT + 2), (CARR_W / 2, CARR_TOP), (-CARR_W / 2, CARR_TOP),
             (-CARR_W / 2, CARR_BOT + 2)], "hid")
    poly(P, [(-HANDLE_W / 2, HB), (-HANDLE_W / 2, HANDLE_TOP - 5), (-HANDLE_W / 2 + 5, HANDLE_TOP),
             (HANDLE_W / 2 - 5, HANDLE_TOP), (HANDLE_W / 2, HANDLE_TOP - 5), (HANDLE_W / 2, HB)], "vis",
         close=False)
    circle(P, 0, FINGER_Y, FINGER_D / 2)
    rect(P, -FILTER / 2, -FILTER / 2, FILTER / 2, FILTER / 2, "hid")
    rect(P, -w, -HB, w, HB)
    circle(P, 0, 0, TUBE_A[0] / 2)
    circle(P, 0, 0, TUBE_A[0] / 2 - TUBE_A[1])
    circle(P, 0, 0, APERTURE / 2, "vis glass")
    line(P, (-w - 6, 0), (w + 6, 0), "ctr"); line(P, (0, -HB - 6), (0, HANDLE_TOP + 4), "ctr")
    # dimensions
    ext(P, (-w, -HB), (-w, -HB - 10)); ext(P, (w, -HB), (w, -HB - 10))
    dim_h(P, -w, w, -HB - 8, f"{BODY_W:g}")
    ext(P, (-HANDLE_W / 2, HANDLE_TOP), (-HANDLE_W / 2, HANDLE_TOP + 7))
    ext(P, (HANDLE_W / 2, HANDLE_TOP), (HANDLE_W / 2, HANDLE_TOP + 7))
    dim_h(P, -HANDLE_W / 2, HANDLE_W / 2, HANDLE_TOP + 5, f"{HANDLE_W:g}")
    ext(P, (-w, HB), (-w - 10, HB)); ext(P, (-w, -HB), (-w - 10, -HB))
    dim_v(P, -HB, HB, -w - 8, f"{BODY_H:g}")
    ext(P, (HANDLE_W / 2, HANDLE_TOP), (w + 18, HANDLE_TOP)); ext(P, (w, -HB), (w + 18, -HB))
    dim_v(P, -HB, HANDLE_TOP, w + 16, f"{HANDLE_TOP + HB:g}")
    ext(P, (w, 0), (w + 10, 0))
    dim_v(P, -HB, 0, w + 8, f"{HB:g}")
    leader(P, (TUBE_A[0] / 2 * 0.707, TUBE_A[0] / 2 * 0.707), (w + 2, HB + 9), f"Ø{TUBE_A[0]} (ท่อ A)")
    leader(P, (-APERTURE / 2 * 0.707, -APERTURE / 2 * 0.707), (-w + 30, -HB - 16),
           f"รูรับแสง Ø{APERTURE:g}", "end")
    leader(P, (0, FINGER_Y + FINGER_D / 2 * 0.0 - FINGER_D / 2 * -1 * 0), (-w - 2, HANDLE_TOP + 2),
           f"รูนิ้ว Ø{FINGER_D:g}", "end")
    title(ox, oy - HANDLE_TOP - 18, "VIEW A : มองจากด้านท่อ A", "มาตราส่วน 1:1")


def section_view(ox, oy):
    P = view(ox, oy)      # x = flow axis z, y = y
    za0 = -TUBE_A[2]
    ra, rai = TUBE_A[0] / 2, TUBE_A[0] / 2 - TUBE_A[1]
    rb, rbi = TUBE_B[0] / 2, TUBE_B[0] / 2 - TUBE_B[1]
    z1, z2, z3, z4 = 0, T_SHEET, T_SHEET + GAP, 2 * T_SHEET + GAP
    zb1 = z4 + TUBE_B[2]
    ap = APERTURE / 2
    for s in (1, -1):
        rect(P, za0, s * rai, z1, s * ra, "cut")       # tube A walls
        rect(P, z4, s * rbi, zb1, s * rb, "cut")       # tube B walls
        rect(P, z1, s * ap, z2, s * HB, "cut")         # front plate
        rect(P, z3, s * ap, z4, s * HB, "cut")         # back plate
    rect(P, z2, -HB, z3, -HB + T_SHEET, "cut")         # bottom flange
    # carrier in slot (section at x=0 passes through finger hole)
    cz1, cz2 = z2 + (GAP - CARR_T) / 2, z3 - (GAP - CARR_T) / 2
    p, q = POCKET / 2, LEDGE / 2
    cm = cz1 + CARR_A
    rect(P, cz1, CARR_BOT, cm, -p, "cut2")                       # P05
    rect(P, cz1, p, cm, FINGER_Y - FINGER_D / 2, "cut2")
    rect(P, cz1, FINGER_Y + FINGER_D / 2, cm, HANDLE_TOP, "cut2")
    rect(P, cm, CARR_BOT, cz2, -q, "cut")                        # P06
    rect(P, cm, q, cz2, CARR_TOP, "cut")
    # filter glass seated on P06 ledge
    gz = cm - FILTER_T / 2
    rect(P, cm - FILTER_T, -FILTER / 2, cm, FILTER / 2, "glass")
    line(P, (za0 - 6, 0), (zb1 + 6, 0), "ctr")
    # weld symbols (fillet triangles)
    for (zz, rr, sgn) in ((z1, ra, -1), (z4, rb, 1)):
        for s in (1, -1):
            x, y = P(zz, s * rr)
            dx = 2.2 * sgn
            dy = -2.2 * s
            svg.append(f'<polygon class="weld" points="{f(x)},{f(y)} {f(x + dx)},{f(y)} {f(x)},{f(y + dy)}"/>')
    # dims along axis
    yd = -HB - 9
    for zz in (za0, z1, z4, zb1):
        ext(P, (zz, -ra if zz <= z1 else -rb), (zz, yd - 2))
    dim_h(P, za0, z1, yd, f"{TUBE_A[2]:g}")
    dim_h(P, z4, zb1, yd, f"{TUBE_B[2]:g}")
    dim_h(P, z1, z4, yd - 3.5, f"{z4:g}", off=0)
    ext(P, (za0, -ra), (za0, yd - 9)); ext(P, (zb1, -rb), (zb1, yd - 9))
    dim_h(P, za0, zb1, yd - 7, f"{zb1 - za0:g} (ยาวรวม)")
    # diameters
    ext(P, (za0, ra), (za0 - 9, ra)); ext(P, (za0, -ra), (za0 - 9, -ra))
    dim_v(P, -ra, ra, za0 - 7, f"Ø{TUBE_A[0]} h9 (OD)")
    ext(P, (zb1, rb), (zb1 + 9, rb)); ext(P, (zb1, -rb), (zb1 + 9, -rb))
    dim_v(P, -rb, rb, zb1 + 11, f"Ø{TUBE_B[0]:.1f} h9 (OD)")
    leader(P, (gz, 10), (z4 + 14, HB + 6), f"ร่องเสียบกว้าง 6 | ฟิลเตอร์ 50x50 หนา {FILTER_T:g}")
    leader(P, (z4, -30), (z4 + 14, -HB - 2), "ท่อ B")
    leader(P, (z1, -30), (za0 + 2, -HB - 2), "ท่อ A", "end")
    leader(P, (z1 - 1.5, ra + 1.0), (za0 + 4, HB + 6), "เชื่อมรอบ TIG a3", "end")
    # flow arrow
    a, b = P(za0 + 5, 6), P(za0 + 25, 6)
    svg.append(f'<line class="dim" x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" marker-end="url(#arr)"/>')
    text(a[0], a[1] - 1.2, "แสง/การไหล", 2.6)
    title(ox + (za0 + zb1) / 2, oy - HANDLE_TOP - 18, "SECTION B-B : ภาพตัดผ่านแกน", "มาตราส่วน 1:1")


def flat_view(ox, oy):
    P = view(ox, oy)
    poly(P, front_body_outline())
    circle(P, 0, 0, APERTURE / 2)
    for sx in (-1, 1):
        line(P, (sx * BEND_X, NOTCH_Y), (sx * BEND_X, HB), "bend")
    line(P, (-NOTCH_X, BEND_Y), (NOTCH_X, BEND_Y), "bend")
    line(P, (-8, 0), (8, 0), "ctr"); line(P, (0, -8), (0, 8), "ctr")
    ext(P, (-XF, HB), (-XF, HB + 8)); ext(P, (XF, HB), (XF, HB + 8))
    dim_h(P, -XF, XF, HB + 6, f"{FLAT_W:.2f}")
    ext(P, (-BEND_X, HB), (-BEND_X, HB + 3)); ext(P, (BEND_X, HB), (BEND_X, HB + 3))
    dim_h(P, -BEND_X, BEND_X, HB + 2, f"{2 * BEND_X:.2f} (เส้นพับ)")
    ext(P, (XF, HB), (XF + 9, HB)); ext(P, (NOTCH_X, YF), (XF + 9, YF))
    dim_v(P, YF, HB, XF + 7, f"{FLAT_H:.2f}")
    ext(P, (XF, BEND_Y), (XF + 3, BEND_Y))
    dim_v(P, BEND_Y, HB, XF + 2.5, f"{HB - BEND_Y:.2f}")
    leader(P, (-NOTCH_X, NOTCH_Y - 4), (-XF + 10, YF - 7), "บากมุม (relief)")
    leader(P, (APERTURE / 2 * 0.707, -APERTURE / 2 * 0.707), (XF - 2, YF - 7), f"Ø{APERTURE:g}")
    text(ox, oy + 10, "--- = เส้นพับขึ้น 90°, R ใน 2", 2.6, "middle", cls="red")
    title(ox, oy - HB - 20, "P01 FRONT BODY : แผ่นคลี่ (Flat)", "Al 5052-H32 หนา 2  |  1:1")


def carrier_view(ox, oy):
    P = view(ox, oy)
    pts = [p for p in carrier_outline() if p[0] != "arc"]
    # approximate handle radius corners for svg with polyline (arcs drawn as path)
    h, r, w = HANDLE_W / 2, 5.0, CARR_W / 2
    d = []
    seq = [(-w + 2, CARR_BOT), (w - 2, CARR_BOT), (w, CARR_BOT + 2), (w, CARR_TOP), (h, CARR_TOP),
           (h, HANDLE_TOP - r)]
    for i, p in enumerate(seq):
        x, y = P(*p); d.append(("M" if i == 0 else "L") + f"{f(x)},{f(y)}")
    x, y = P(h - r, HANDLE_TOP); d.append(f"A{r},{r} 0 0 0 {f(x)},{f(y)}")
    x, y = P(-h + r, HANDLE_TOP); d.append(f"L{f(x)},{f(y)}")
    x, y = P(-h, HANDLE_TOP - r); d.append(f"A{r},{r} 0 0 0 {f(x)},{f(y)}")
    for p in [(-h, CARR_TOP), (-w, CARR_TOP), (-w, CARR_BOT + 2)]:
        x, y = P(*p); d.append(f"L{f(x)},{f(y)}")
    svg.append(f'<path class="vis" d="{" ".join(d)} Z"/>')
    p = POCKET / 2
    rect(P, -p, -p, p, p)
    rect(P, -FILTER / 2, -FILTER / 2, FILTER / 2, FILTER / 2, "glass")
    circle(P, 0, FINGER_Y, FINGER_D / 2)
    for sx in (-1, 1):
        for sy in (-1, 1):
            circle(P, sx * SCREW_XY[0], sy * SCREW_XY[1], 0.8)
    leader(P, (SCREW_XY[0] + 0.6, SCREW_XY[1] + 0.6), (w + 4, CARR_TOP + 6), "4xØ1.6 ต๊าป M2")
    line(P, (-w - 5, 0), (w + 5, 0), "ctr"); line(P, (0, CARR_BOT - 5), (0, HANDLE_TOP + 4), "ctr")
    ext(P, (-w, CARR_BOT), (-w, CARR_BOT - 9)); ext(P, (w, CARR_BOT), (w, CARR_BOT - 9))
    dim_h(P, -w, w, CARR_BOT - 7, f"{CARR_W:g}")
    ext(P, (-p, -p), (-p, CARR_BOT - 3)); ext(P, (p, -p), (p, CARR_BOT - 3))
    dim_h(P, -p, p, CARR_BOT - 2, f"□{POCKET}")
    ext(P, (w, CARR_BOT), (w + 10, CARR_BOT)); ext(P, (h, HANDLE_TOP), (w + 10, HANDLE_TOP))
    dim_v(P, CARR_BOT, HANDLE_TOP, w + 8, f"{HANDLE_TOP - CARR_BOT:g}")
    ext(P, (w, CARR_TOP), (w + 3, CARR_TOP))
    dim_v(P, CARR_BOT, CARR_TOP, w + 2.5, f"{CARR_TOP - CARR_BOT:g}")
    ext(P, (-h, HANDLE_TOP), (-h, HANDLE_TOP + 5)); ext(P, (h, HANDLE_TOP), (h, HANDLE_TOP + 5))
    dim_h(P, -h, h, HANDLE_TOP + 3, f"{HANDLE_W:g}")
    ext(P, (-w, 0), (-w - 9, 0)); ext(P, (-w, CARR_BOT), (-w - 9, CARR_BOT))
    dim_v(P, CARR_BOT, 0, -w - 7, f"{-CARR_BOT:g}")
    ext(P, (-FINGER_D / 2, FINGER_Y), (-w - 9, FINGER_Y))
    dim_v(P, 0, FINGER_Y, -w - 7, f"{FINGER_Y:g}")
    text(ox, oy + 4, "ฟิลเตอร์ 50x50", 2.6, "middle", cls="blue")
    text(ox, oy + 8, f"หนา {FILTER_T:g} วางบนบ่า P06 + ซิลิโคน", 2.4, "middle", cls="blue")
    leader(P, (w - 1, CARR_BOT + 1), (w + 4, CARR_BOT - 12), "ลบมุม 2x45°")
    leader(P, (FINGER_D / 2 * 0.707, FINGER_Y + FINGER_D / 2 * 0.707), (h + 6, HANDLE_TOP + 9), f"Ø{FINGER_D:g}")
    title(ox, oy - HANDLE_TOP - 15, "P05 ถาดใส่ฟิลเตอร์ (Carrier)", "Al 6061-T6 หนา 3  |  1:1")


def ledge_view(ox, oy):
    P = view(ox, oy)
    w, q = CARR_W / 2, LEDGE / 2
    poly(P, ledge_outline())
    rect(P, -q, -q, q, q)
    rect(P, -POCKET / 2, -POCKET / 2, POCKET / 2, POCKET / 2, "hid")
    for sx in (-1, 1):
        for sy in (-1, 1):
            circle(P, sx * SCREW_XY[0], sy * SCREW_XY[1], 1.2)
            circle(P, sx * SCREW_XY[0], sy * SCREW_XY[1], 2.0, "hid")
    line(P, (-w - 4, 0), (w + 4, 0), "ctr"); line(P, (0, CARR_BOT - 4), (0, CARR_TOP + 4), "ctr")
    ext(P, (-q, -q), (-q, CARR_BOT - 4)); ext(P, (q, -q), (q, CARR_BOT - 4))
    dim_h(P, -q, q, CARR_BOT - 3, f"□{LEDGE:g} (บ่า 2.25)")
    ext(P, (-w, CARR_BOT), (-w, CARR_BOT - 9)); ext(P, (w, CARR_BOT), (w, CARR_BOT - 9))
    dim_h(P, -w, w, CARR_BOT - 8, f"{CARR_W:g}")
    ext(P, (w, CARR_BOT), (w + 8, CARR_BOT)); ext(P, (w, CARR_TOP), (w + 8, CARR_TOP))
    dim_v(P, CARR_BOT, CARR_TOP, w + 6, f"{CARR_TOP - CARR_BOT:g}")
    ext(P, (-SCREW_XY[0], SCREW_XY[1]), (-SCREW_XY[0], CARR_TOP + 5))
    ext(P, (SCREW_XY[0], SCREW_XY[1]), (SCREW_XY[0], CARR_TOP + 5))
    dim_h(P, -SCREW_XY[0], SCREW_XY[0], CARR_TOP + 3, f"{2 * SCREW_XY[0]:g}")
    ext(P, (-SCREW_XY[0], -SCREW_XY[1]), (-w - 8, -SCREW_XY[1]))
    ext(P, (-SCREW_XY[0], SCREW_XY[1]), (-w - 8, SCREW_XY[1]))
    dim_v(P, -SCREW_XY[1], SCREW_XY[1], -w - 6, f"{2 * SCREW_XY[1]:g}")
    text(ox, oy + 9, "4xØ2.4 เจาะผาย 90° (สกรู M2x4 หัวจม)", 2.4, "middle", cls="dimt")
    title(ox, oy - CARR_TOP - 13, "P06 แผ่นบ่ารองฟิลเตอร์", "Al 5052-H32 หนา 2  |  1:1  (ยึดกับ P05)")


def back_view(ox, oy):
    P = view(ox, oy)
    w = BODY_W / 2
    rect(P, -w, -HB, w, HB)
    circle(P, 0, 0, APERTURE / 2)
    line(P, (-w - 4, 0), (w + 4, 0), "ctr"); line(P, (0, -HB - 4), (0, HB + 4), "ctr")
    ext(P, (-w, -HB), (-w, -HB - 8)); ext(P, (w, -HB), (w, -HB - 8))
    dim_h(P, -w, w, -HB - 6, f"{BODY_W:g}")
    ext(P, (w, HB), (w + 8, HB)); ext(P, (w, -HB), (w + 8, -HB))
    dim_v(P, -HB, HB, w + 6, f"{BODY_H:g}")
    leader(P, (APERTURE / 2 * 0.707, APERTURE / 2 * 0.707), (w - 4, HB + 6), f"Ø{APERTURE:g}")
    title(ox, oy - HB - 13, "P02 BACK PLATE", "Al 5052-H32 หนา 2  |  1:1")


def table(x, y, cols, rows, widths, size=2.6, rh=5.2, head=True):
    tw = sum(widths)
    for i, row in enumerate([cols] + rows):
        yy = y + i * rh
        if i == 0 and head:
            svg.append(f'<rect class="thead" x="{f(x)}" y="{f(yy)}" width="{f(tw)}" height="{f(rh)}"/>')
        cx = x
        for c, wdt in zip(row, widths):
            text(cx + 1.2, yy + rh - 1.5, c, size, weight="bold" if i == 0 else "normal")
            cx += wdt
        svg.append(f'<line class="thin" x1="{f(x)}" y1="{f(yy + rh)}" x2="{f(x + tw)}" y2="{f(yy + rh)}"/>')
    h = rh * (len(rows) + 1)
    svg.append(f'<rect class="thin" x="{f(x)}" y="{f(y)}" width="{f(tw)}" height="{f(h)}" fill="none"/>')
    cx = x
    for wdt in widths[:-1]:
        cx += wdt
        svg.append(f'<line class="thin" x1="{f(cx)}" y1="{f(y)}" x2="{f(cx)}" y2="{f(y + h)}"/>')
    return y + h


def build_svg():
    W, H = 420, 297
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">')
    svg.append(f"""<defs>
<marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="3"
 markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="#1d4e89"/></marker>
<pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
 <line x1="0" y1="0" x2="0" y2="2" stroke="#222" stroke-width="0.25"/></pattern>
<pattern id="hatch2" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
 <line x1="0" y1="0" x2="0" y2="2" stroke="#555" stroke-width="0.25"/></pattern>
</defs>
<style>
 text {{ font-family: {FONT}; fill:#111; }}
 .vis {{ fill:none; stroke:#000; stroke-width:0.45; }}
 .hid {{ fill:none; stroke:#000; stroke-width:0.25; stroke-dasharray:1.6 0.8; }}
 .ctr {{ fill:none; stroke:#b03030; stroke-width:0.2; stroke-dasharray:5 1 1 1; }}
 .bend {{ fill:none; stroke:#c00; stroke-width:0.35; stroke-dasharray:3 1.2; }}
 .ext {{ stroke:#1d4e89; stroke-width:0.15; }}
 .dim {{ fill:none; stroke:#1d4e89; stroke-width:0.2; }}
 .dimt {{ fill:#1d4e89; }}
 .cut {{ fill:url(#hatch); stroke:#000; stroke-width:0.4; }}
 .cut2 {{ fill:url(#hatch2); stroke:#000; stroke-width:0.4; }}
 .glass {{ fill:#bfe3f5; fill-opacity:0.6; stroke:#2b7bb9; stroke-width:0.3; }}
 .weld {{ fill:#333; }}
 .thin {{ fill:none; stroke:#000; stroke-width:0.25; }}
 .thead {{ fill:#e8edf3; }}
 .red {{ fill:#c00; }} .blue {{ fill:#2b7bb9; }}
</style>
<rect x="0" y="0" width="{W}" height="{H}" fill="#fff"/>
<rect class="vis" x="8" y="8" width="{W - 16}" height="{H - 16}" stroke-width="0.7"/>""")

    front_view(62, 92)
    section_view(176, 92)
    flat_view(62, 222)
    carrier_view(158, 230)
    back_view(250, 222)
    ledge_view(350, 150)

    # notes
    nx, ny = 292, 20
    text(nx, ny, "หมายเหตุ / ข้อกำหนด", 3.6, weight="bold")
    notes = [
        "1. หน่วย mm. ค่าเผื่อทั่วไป ±0.2 (ชิ้นเลเซอร์), ±0.5 (หลังเชื่อม)",
        "2. Ø55.8 / Ø56.0 = ขนาดโตนอก (OD) ของปลายท่อที่สวมเข้าเครื่อง",
        "   ถ้าขนาดเครื่องเป็นเพลา/ท่อตัวผู้ ให้ทำเป็นปลอกสวมนอก ID +0.1~0.2",
        "3. ความต่าง 0.2 mm ต้องกลึงผิว OD หลังเชื่อม (สต๊อกท่อ Ø60 หรือหนากว่า)",
        "   ถ้าไม่มีเครื่องกลึง ใช้ท่อสำเร็จใกล้เคียงแล้วปรับฟิตด้วยโอริง/เทป",
        "4. P01 พับขึ้น 90° 3 ด้าน (ซ้าย ขวา ล่าง) ไปทางด้านท่อ B, R ใน 2",
        f"   K=0.4 → BA={BA:.2f}, BD={BD:.2f}  ตรวจกับตารางพับของร้านก่อนตัด",
        "5. วาง P02 บนปลายปีก P01 เชื่อม TIG ตามขอบ 3 ด้าน (ด้านบนเปิด)",
        "6. เชื่อมท่อ A ที่หน้า P01, ท่อ B ที่หน้า P02 รอบวง fillet a3",
        "   ใช้แกนจิ๊กจับศูนย์ร่วม (ร่วมศูนย์ ≤0.3) เชื่อมสลับจุดกันบิด",
        "7. ลวดเชื่อม ER5356 (ถ้าจะชุบอโนไดซ์) หรือ ER4043",
        "8. ลบคม ขัดเม็ดเชื่อมในร่องให้เรียบ ถาด P05 ต้องเลื่อนเข้าออกลื่น",
        "9. แนะนำชุบอโนไดซ์ดำด้าน ลดแสงสะท้อนภายใน",
        f"10. ฟิลเตอร์ 50x50 หนา {FILTER_T:g} วางในช่อง P05 บนบ่า P06 ยึดซิลิโคนที่มุม",
        "11. ไฟล์ DXF: P01, P02, P05, P06 (layer CUT=ตัด, BEND=เส้นพับ)",
    ]
    for i, n in enumerate(notes):
        text(nx, ny + 6 + i * 4.6, n, 2.55)

    # BOM
    by = 205
    text(292, by - 3, "รายการชิ้นส่วน (BOM)", 3.4, weight="bold")
    end = table(292, by, ["No.", "ชิ้นส่วน", "วัสดุ / ขนาด", "วิธีทำ", "จำนวน"], [
        ["P01", "บอดี้หน้า", "Al5052-H32 t2", "เลเซอร์+พับ", "1"],
        ["P02", "แผ่นหลัง", "Al5052-H32 t2", "เลเซอร์", "1"],
        ["P03", "ท่อ A", f"Al6061 OD{TUBE_A[0]} x t2 x 40", "ตัด+กลึง", "1"],
        ["P04", "ท่อ B", f"Al6061 OD{TUBE_B[0]:.1f} x t2 x 40", "ตัด+กลึง", "1"],
        ["P05", "ถาดฟิลเตอร์", "Al6061-T6 t3", "เลเซอร์+ต๊าป", "1"],
        ["P06", "แผ่นบ่ารอง", "Al5052-H32 t2", "เลเซอร์", "1"],
        ["-", "สกรูหัวจม", "M2x4 สแตนเลส", "ซื้อ", "4"],
    ], [10, 21, 38, 21, 15])

    # title block
    ty = end + 6
    tw = [36, 69]
    rows = [["ชื่อแบบ", "อแดปเตอร์ใส่ฟิลเตอร์ 5x5 cm"],
            ["เครื่อง", "Xenon reactor (ปลาย Ø55.8 / Ø56)"],
            ["วัสดุหลัก", "อลูมิเนียม | ตัด-พับ-เลเซอร์-เชื่อม"],
            ["มาตราส่วน / กระดาษ", "1:1  |  A3   (ห้ามวัดจากกระดาษ ใช้ตัวเลข)"],
            ["วันที่ / Rev", "2026-10-20  |  Rev B (ฟิลเตอร์หนา 2)"]]
    table(292, ty, rows[0], rows[1:], tw, size=2.6, rh=5.6, head=True)

    svg.append("</svg>")
    (OUT / "xenon_filter_adapter.svg").write_text("\n".join(svg), encoding="utf-8")


if __name__ == "__main__":
    write_dxfs()
    build_svg()
    print(f"flat {FLAT_W:.2f} x {FLAT_H:.2f}, BA {BA:.3f}, BD {BD:.3f}")
