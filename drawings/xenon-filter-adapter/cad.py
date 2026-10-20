"""Per-part CAD drawings (DXF R2010, opens in AutoCAD 2010+) for the filter adapter.

Run:  python3 cad.py   (needs: pip install ezdxf)
Output: cad/*.dxf  -- 1:1 model space, mm. Layers:
  CUT (laser contour)  BEND (bend line)  VISIBLE  HIDDEN  CENTER  DIM  NOTE  BORDER
For laser cutting, freeze every layer except CUT (and BEND for P01).
"""
import math
from pathlib import Path

import ezdxf
from ezdxf.enums import TextEntityAlignment

import generate as g

OUT = Path(__file__).parent / "cad"
OUT.mkdir(exist_ok=True)
DATE = "2026-10-20"
REV = "B"
B90 = math.tan(math.radians(22.5))  # lwpolyline bulge for a 90 deg arc


def new_doc():
    doc = ezdxf.new("R2010", setup=True)
    doc.units = ezdxf.units.MM
    doc.header["$INSUNITS"] = 4
    doc.header["$MEASUREMENT"] = 1
    doc.header["$LTSCALE"] = 0.5
    doc.styles.new("THAI", dxfattribs={"font": "tahoma.ttf"})
    doc.dimstyles.new("ISO25", dxfattribs={
        "dimtxt": 2.5, "dimasz": 2.5, "dimexe": 1.25, "dimexo": 0.625, "dimgap": 0.625,
        "dimdec": 2, "dimzin": 8, "dimtad": 1, "dimtih": 0, "dimtoh": 0, "dimtxsty": "THAI",
        "dimclrd": 5, "dimclre": 5, "dimclrt": 5, "dimlunit": 2, "dimdsep": ord("."),
        "dimcen": 0, "dimtmove": 2,
    })
    for name, color, lt in (("CUT", 7, "CONTINUOUS"), ("BEND", 1, "DASHED"), ("VISIBLE", 7, "CONTINUOUS"),
                            ("HIDDEN", 8, "HIDDEN"), ("CENTER", 1, "CENTER"), ("DIM", 5, "CONTINUOUS"),
                            ("NOTE", 3, "CONTINUOUS"), ("BORDER", 7, "CONTINUOUS"), ("HATCH", 8, "CONTINUOUS"),
                            ("WELD", 6, "CONTINUOUS")):
        doc.layers.add(name, color=color, linetype=lt)
    doc.layers.get("CUT").dxf.lineweight = 50
    doc.layers.get("VISIBLE").dxf.lineweight = 50
    return doc, doc.modelspace()


# ---------------- primitives ----------------
def at(o, p):
    return (o[0] + p[0], o[1] + p[1])


def pl(m, o, pts, layer, close=True, fmt="xy"):
    pts = [(o[0] + p[0], o[1] + p[1], *p[2:]) for p in pts]
    m.add_lwpolyline(pts, format=fmt, close=close, dxfattribs={"layer": layer})


def rect(m, o, x1, y1, x2, y2, layer):
    pl(m, o, [(x1, y1), (x2, y1), (x2, y2), (x1, y2)], layer)


def circ(m, o, x, y, r, layer):
    m.add_circle(at(o, (x, y)), r, dxfattribs={"layer": layer})


def ln(m, o, a, b, layer):
    m.add_line(at(o, a), at(o, b), dxfattribs={"layer": layer})


def cross(m, o, x, y, a, b=None):
    b = a if b is None else b
    ln(m, o, (x - a, y), (x + a, y), "CENTER")
    ln(m, o, (x, y - b), (x, y + b), "CENTER")


def txt(m, p, s, h=2.5, align=TextEntityAlignment.LEFT, layer="NOTE", rot=0):
    t = m.add_text(s, height=h, rotation=rot, dxfattribs={"layer": layer, "style": "THAI"})
    t.set_placement(p, align=align)
    return t


def dlin(m, o, p1, p2, base, angle=0, text="<>"):
    m.add_linear_dim(base=at(o, base), p1=at(o, p1), p2=at(o, p2), angle=angle, text=text,
                     dimstyle="ISO25", dxfattribs={"layer": "DIM"}).render()


def ddia(m, o, c, r, ang=45, text="<>"):
    m.add_diameter_dim(center=at(o, c), radius=r, angle=ang, text=text, dimstyle="ISO25",
                       override={"dimtoh": 1}, dxfattribs={"layer": "DIM"}).render()


def drad(m, o, c, r, ang=45, text="<>"):
    m.add_radius_dim(center=at(o, c), radius=r, angle=ang, text=text, dimstyle="ISO25",
                     override={"dimtoh": 1}, dxfattribs={"layer": "DIM"}).render()


def leader(m, o, p_from, p_to, s, left=False):
    a, b = at(o, p_from), at(o, p_to)
    c = (b[0] + (-14 if left else 14), b[1])
    m.add_lwpolyline([a, b, c], dxfattribs={"layer": "DIM"})
    # arrow head
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    for s_ in (0.3, -0.3):
        m.add_line(a, (a[0] + 2.5 * math.cos(ang + s_), a[1] + 2.5 * math.sin(ang + s_)),
                   dxfattribs={"layer": "DIM"})
    txt(m, (b[0] + (-1 if left else 1), b[1] + 0.8), s, 2.5,
        TextEntityAlignment.BOTTOM_RIGHT if left else TextEntityAlignment.BOTTOM_LEFT, "DIM")


def sheet(m, W, H, part_no, name, material, qty, process, scale="1:1"):
    rect(m, (0, 0), 0, 0, W, H, "BORDER")
    rect(m, (0, 0), 10, 10, W - 10, H - 10, "BORDER")
    x0, y0, tw = W - 10 - 130, 10, 130
    rows = [("ชื่อแบบ / TITLE", "อแดปเตอร์ฟิลเตอร์ 5x5 cm - Xenon reactor"),
            ("ชิ้นส่วน / PART", f"{part_no}  {name}"),
            ("วัสดุ / MATERIAL", material),
            ("จำนวน / QTY", qty),
            ("วิธีทำ / PROCESS", process),
            ("มาตราส่วน / SCALE", f"{scale}   หน่วย mm   ห้ามวัดขนาดจากกระดาษ"),
            ("วันที่ / REV", f"{DATE}   Rev {REV}")]
    rh = 6.0
    for i, (k, v) in enumerate(rows):
        y = y0 + (len(rows) - 1 - i) * rh
        rect(m, (0, 0), x0, y, x0 + tw, y + rh, "BORDER")
        ln(m, (0, 0), (x0 + 34, y), (x0 + 34, y + rh), "BORDER")
        txt(m, (x0 + 1.5, y + 1.8), k, 2.2)
        txt(m, (x0 + 35.5, y + 1.8), v, 2.5)
    return x0, y0 + len(rows) * rh


def notes(m, p, lines, h=2.5, title="หมายเหตุ / NOTES"):
    txt(m, p, title, 3.0)
    for i, s in enumerate(lines):
        txt(m, (p[0], p[1] - 5 - i * 4.2), s, h)


def save(doc, name):
    auditor = doc.audit()
    assert not auditor.has_errors, auditor.errors
    doc.saveas(OUT / name)
    print("saved", name)


GEN_TOL = "ค่าเผื่อทั่วไป ±0.2 (ชิ้นตัดเลเซอร์)"

# ---------------- P01 front body ----------------
def p01():
    doc, m = new_doc()
    W, H = 297, 210
    sheet(m, W, H, "P01", "FRONT BODY / บอดี้หน้า", "Al 5052-H32  หนา 2.0 mm", "1",
          "ตัดเลเซอร์ + พับ 90° 3 ครั้ง")
    o = (65, 115)
    pl(m, o, g.front_body_outline(), "CUT")
    circ(m, o, 0, 0, g.APERTURE / 2, "CUT")
    for sx in (-1, 1):
        ln(m, o, (sx * g.BEND_X, g.NOTCH_Y), (sx * g.BEND_X, g.HB), "BEND")
    ln(m, o, (-g.NOTCH_X, g.BEND_Y), (g.NOTCH_X, g.BEND_Y), "BEND")
    cross(m, o, 0, 0, 27)
    XF, HB, YF = g.XF, g.HB, g.YF
    dlin(m, o, (-XF, HB), (XF, HB), (0, HB + 14))
    dlin(m, o, (-g.BEND_X, HB), (g.BEND_X, HB), (0, HB + 7))
    dlin(m, o, (XF, HB), (g.NOTCH_X, YF), (XF + 16, 0), angle=90)
    dlin(m, o, (XF, HB), (XF, g.BEND_Y), (XF + 8, 0), angle=90)
    dlin(m, o, (-XF, g.NOTCH_Y), (-g.NOTCH_X, YF), (-XF - 8, 0), angle=90)
    dlin(m, o, (-XF, g.NOTCH_Y), (-g.NOTCH_X, g.NOTCH_Y), (0, YF - 8))
    dlin(m, o, (-g.NOTCH_X, YF), (g.NOTCH_X, YF), (0, YF - 14))
    dlin(m, o, (0, 0), (0, HB), (-XF - 16, 0), angle=90)
    ddia(m, o, (0, 0), g.APERTURE / 2, 35)
    txt(m, at(o, (-XF, HB + 22)), "แผ่นคลี่ (FLAT PATTERN)  1:1", 3.5)
    txt(m, at(o, (-XF, YF - 24)), "- - - เส้นพับ: พับขึ้น 90° R ใน 2 (3 เส้น)", 2.5, layer="BEND")

    # formed U profile seen from top (X = width, Z = flange)
    o2 = (205, 160)
    w, t, R, F = g.BODY_W / 2, g.T_SHEET, g.R_IN, g.FLANGE
    xb = w - R - t
    pts = [(-w, F, 0), (-w, R + t, B90), (-xb, 0, 0), (xb, 0, B90), (w, R + t, 0), (w, F, 0),
           (w - t, F, 0), (w - t, R + t, -B90), (xb, t, 0), (-xb, t, -B90), (-(w - t), R + t, 0),
           (-(w - t), F, 0)]
    pl(m, o2, pts, "VISIBLE", fmt="xyb")
    dlin(m, o2, (-w, 0), (w, 0), (0, -8))
    dlin(m, o2, (w, 0), (w, F), (w + 7, 0), angle=90)
    dlin(m, o2, (w - t, F), (-w + t, F), (0, F + 6), text="<> (ใน)")
    drad(m, o2, (xb, R + t), R, 225, text="R2 (ใน)")
    txt(m, at(o2, (-w, F + 16)), "รูปหลังพับ (มองจากด้านบน)  1:1", 3.0)
    txt(m, at(o2, (-w, -17)), "ปีก 3 ด้าน (ซ้าย ขวา ล่าง) สูง 8 จากผิวนอก", 2.5)
    txt(m, at(o2, (-w, -21.5)), "พับไปทางด้านท่อ B -> ร่องกว้าง 6", 2.5)

    notes(m, (150, 108), [
        "1. " + GEN_TOL + ", มุมพับ 90° ±0.5°",
        f"2. คำนวณแผ่นคลี่ K=0.4: BA={g.BA:.2f} BD={g.BD:.2f}",
        "   ตรวจกับตารางพับของโรงงาน ปรับได้ แต่ต้องได้",
        "   ขนาดหลังพับ 71 x 70 ปีกสูง 8 (ช่องใน 67 x 6)",
        "3. มุมล่างทั้ง 2 มีบากมุม (relief) ไว้ -> เชื่อมปิดภายหลัง",
        "4. ลบคมทุกด้าน ไม่มีครีบ",
        "5. ไฟล์ตัดเลเซอร์: ใช้ layer CUT, BEND เท่านั้น",
    ])
    save(doc, "P01_front_body.dxf")


# ---------------- P02 back plate ----------------
def p02():
    doc, m = new_doc()
    W, H = 297, 210
    sheet(m, W, H, "P02", "BACK PLATE / แผ่นหลัง", "Al 5052-H32  หนา 2.0 mm", "1", "ตัดเลเซอร์")
    o = (80, 110)
    w, HB = g.BODY_W / 2, g.HB
    rect(m, o, -w, -HB, w, HB, "CUT")
    circ(m, o, 0, 0, g.APERTURE / 2, "CUT")
    cross(m, o, 0, 0, w + 4, HB + 4)
    dlin(m, o, (-w, -HB), (w, -HB), (0, -HB - 10))
    dlin(m, o, (w, -HB), (w, HB), (w + 10, 0), angle=90)
    dlin(m, o, (-w, 0), (0, 0), (0, HB + 8))
    dlin(m, o, (-w, -HB), (-w, 0), (-w - 10, 0), angle=90)
    ddia(m, o, (0, 0), g.APERTURE / 2, 40)
    txt(m, at(o, (-w, HB + 18)), "P02  1:1", 3.5)
    notes(m, (150, 150), ["1. " + GEN_TOL, "2. ลบคมทุกด้าน", "3. ไฟล์ตัดเลเซอร์: ใช้ layer CUT"])
    save(doc, "P02_back_plate.dxf")


# ---------------- P03 / P04 tubes ----------------
def tube(no, od, fname):
    doc, m = new_doc()
    W, H = 297, 210
    wall, L = 2.0, 40.0
    sheet(m, W, H, no, f"TUBE / ท่อ OD{od}", "Al 6061-T6 (ท่อหรือแท่งกลึง)", "1",
          "ตัด + กลึง OD หลังเชื่อม")
    r, ri = od / 2, od / 2 - wall
    o = (60, 120)  # side view, axis horizontal, x = 0..L
    c = 0.5
    pl(m, o, [(0, -r), (L - c, -r), (L, -r + c), (L, r - c), (L - c, r), (0, r)], "VISIBLE")
    ln(m, o, (L - c, -r), (L - c, r), "VISIBLE")
    for s in (1, -1):
        ln(m, o, (0, s * ri), (L, s * ri), "HIDDEN")
    ln(m, o, (-5, 0), (L + 5, 0), "CENTER")
    dlin(m, o, (0, r), (L, r), (L / 2, r + 10))
    dlin(m, o, (0, -r), (0, r), (-12, 0), angle=90, text=f"%%c{od} 0/-0.07 (h9)")
    dlin(m, o, (L, -ri), (L, ri), (L + 12, 0), angle=90, text=f"%%c{od - 2 * wall:g} (ID)")
    leader(m, o, (L - 0.2, r - 0.2), (L + 6, r + 8), "C0.5")
    txt(m, at(o, (-20, r + 20)), "ภาพด้านข้าง  1:1", 3.0)
    txt(m, at(o, (-20, -r - 12)), "ปลายด้านนี้เชื่อมกับบอดี้ (x=0)", 2.5)
    o2 = (175, 120)  # end view
    circ(m, o2, 0, 0, r, "VISIBLE")
    circ(m, o2, 0, 0, ri, "VISIBLE")
    cross(m, o2, 0, 0, r + 4)
    ddia(m, o2, (0, 0), r, 45, text=f"%%c{od}")
    ddia(m, o2, (0, 0), ri, 200, text=f"%%c{od - 2 * wall:g}")
    txt(m, at(o2, (-r, r + 14)), "ภาพปลายท่อ  1:1", 3.0)
    notes(m, (20, 58), [
        f"1. OD {od} พิกัด 0/-0.07 (h9) สวมเข้าช่องเครื่อง",
        "   กลึงผิว OD หลังเชื่อมเข้ากับบอดี้แล้ว",
        "   (ถ้าไม่มีเครื่องกลึง: ใช้ท่อขนาดใกล้เคียง แล้วปรับฟิตด้วยโอริง/เทป)",
        "2. สต๊อกแนะนำ: ท่อ Al Ø60 หนา 4-5 หรือแท่งกลึงคว้านใน, ความยาว 40 ±0.2",
        "3. หน้าตัดปลายเชื่อมตั้งฉากกับแกน ≤0.1, ลบคมใน-นอก, ลบมุม C0.5 ด้านปลายสวม",
        "4. ร่วมศูนย์กับท่ออีกด้าน ≤0.3 (ดูแบบประกอบ ASSY)",
    ], h=2.4)
    save(doc, fname)


# ---------------- P05 carrier ----------------
def p05():
    doc, m = new_doc()
    W, H = 297, 210
    sheet(m, W, H, "P05", "FILTER CARRIER / ถาดใส่ฟิลเตอร์", "Al 6061-T6  หนา 3.0 mm", "1",
          "ตัดเลเซอร์ + ต๊าปเกลียว M2 x4")
    o = (75, 100)
    pts = g.carrier_outline()
    # rebuild as lwpolyline with bulges for the two R5 handle corners
    h, r, w, c = g.HANDLE_W / 2, 5.0, g.CARR_W / 2, 2.0
    outline = [(-w + c, g.CARR_BOT, 0), (w - c, g.CARR_BOT, 0), (w, g.CARR_BOT + c, 0), (w, g.CARR_TOP, 0),
               (h, g.CARR_TOP, 0), (h, g.HANDLE_TOP - r, B90), (h - r, g.HANDLE_TOP, 0),
               (-h + r, g.HANDLE_TOP, B90), (-h, g.HANDLE_TOP - r, 0), (-h, g.CARR_TOP, 0),
               (-w, g.CARR_TOP, 0), (-w, g.CARR_BOT + c, 0)]
    pl(m, o, outline, "CUT", fmt="xyb")
    p = g.POCKET / 2
    rect(m, o, -p, -p, p, p, "CUT")
    circ(m, o, 0, g.FINGER_Y, g.FINGER_D / 2, "CUT")
    sx_, sy_ = g.SCREW_XY
    for sx in (-1, 1):
        for sy in (-1, 1):
            circ(m, o, sx * sx_, sy * sy_, 0.8, "CUT")
            circ(m, o, sx * sx_, sy * sy_, 1.0, "HIDDEN")  # M2 thread major dia (after tapping)
    cross(m, o, 0, 0, w + 5, 0)
    ln(m, o, (0, g.CARR_BOT - 5), (0, g.HANDLE_TOP + 5), "CENTER")
    cross(m, o, 0, g.FINGER_Y, g.FINGER_D / 2 + 2)
    dlin(m, o, (-w, g.CARR_BOT), (w, g.CARR_BOT), (0, g.CARR_BOT - 16))
    dlin(m, o, (-p, -p), (p, -p), (0, g.CARR_BOT - 8))
    dlin(m, o, (-sx_, -sy_), (sx_, -sy_), (0, g.CARR_BOT - 24))
    dlin(m, o, (-h, g.HANDLE_TOP), (h, g.HANDLE_TOP), (0, g.HANDLE_TOP + 7))
    dlin(m, o, (w, g.CARR_BOT), (h, g.HANDLE_TOP), (w + 18, 0), angle=90)
    dlin(m, o, (w, g.CARR_BOT), (w, g.CARR_TOP), (w + 10, 0), angle=90)
    dlin(m, o, (p, -p), (p, p), (w + 4, 0), angle=90)
    dlin(m, o, (-w, g.CARR_BOT), (-w, 0), (-w - 10, 0), angle=90)
    dlin(m, o, (-w, 0), (-g.FINGER_D / 2, g.FINGER_Y), (-w - 18, 0), angle=90)
    dlin(m, o, (-sx_, -sy_), (-sx_, sy_), (-w - 4, 0), angle=90)
    ddia(m, o, (0, g.FINGER_Y), g.FINGER_D / 2, 30)
    drad(m, o, (-h + r, g.HANDLE_TOP - r), r, 135)
    leader(m, o, (sx_ + 0.6, -sy_ - 0.6), (w + 6, g.CARR_BOT - 6), "4x %%c1.6 ต๊าป M2")
    leader(m, o, (w - 1, g.CARR_BOT + 1), (w + 22, g.CARR_BOT + 10), "ลบมุม 2x45° (2 มุม)")
    txt(m, at(o, (-w, g.HANDLE_TOP + 16)), "P05  1:1", 3.5)
    notes(m, (165, 150), [
        "1. " + GEN_TOL + ", ช่อง 50.5x50.5 พิกัด +0.2/0",
        "2. รู Ø1.6 ตัดเลเซอร์ (หรือเจาะ) แล้วต๊าป M2x0.4 ทะลุ",
        "3. ลบคม ผิวต้องเรียบ เลื่อนเข้าร่องกว้าง 6 ได้ลื่น",
        "4. ประกอบกับ P06 ด้วยสกรูหัวจม M2x4 จำนวน 4 ตัว",
        "5. ฟิลเตอร์ 50x50 หนา 2 วางในช่อง บนบ่า P06",
        "   ยึดด้วยซิลิโคน RTV ที่มุม",
        "6. ไฟล์ตัดเลเซอร์: ใช้ layer CUT",
    ])
    save(doc, "P05_filter_carrier.dxf")


# ---------------- P06 ledge plate ----------------
def p06():
    doc, m = new_doc()
    W, H = 297, 210
    sheet(m, W, H, "P06", "LEDGE PLATE / แผ่นบ่ารองฟิลเตอร์", "Al 5052-H32  หนา 2.0 mm", "1",
          "ตัดเลเซอร์ + เจาะผาย 90°")
    o = (80, 115)
    w, q = g.CARR_W / 2, g.LEDGE / 2
    pl(m, o, g.ledge_outline(), "CUT")
    rect(m, o, -q, -q, q, q, "CUT")
    sx_, sy_ = g.SCREW_XY
    for sx in (-1, 1):
        for sy in (-1, 1):
            circ(m, o, sx * sx_, sy * sy_, 1.2, "CUT")
            circ(m, o, sx * sx_, sy * sy_, 2.0, "VISIBLE")  # countersink outer dia
    p = g.POCKET / 2
    rect(m, o, -p, -p, p, p, "HIDDEN")
    cross(m, o, 0, 0, w + 5, -g.CARR_BOT + 5)
    dlin(m, o, (-w, g.CARR_BOT), (w, g.CARR_BOT), (0, g.CARR_BOT - 14))
    dlin(m, o, (-q, -q), (q, -q), (0, g.CARR_BOT - 7))
    dlin(m, o, (-sx_, sy_), (sx_, sy_), (0, g.CARR_TOP + 7))
    dlin(m, o, (w, g.CARR_BOT), (w, g.CARR_TOP), (w + 10, 0), angle=90)
    dlin(m, o, (q, -q), (q, q), (w + 4, 0), angle=90)
    dlin(m, o, (-w, g.CARR_BOT), (-w, 0), (-w - 10, 0), angle=90)
    dlin(m, o, (-sx_, -sy_), (-sx_, sy_), (-w - 4, 0), angle=90)
    leader(m, o, (sx_ + 0.9, sy_ + 0.9), (w + 6, g.CARR_TOP + 8), "4x %%c2.4 ผาย 90° x %%c4.0 (ด้านนอก)")
    leader(m, o, (w - 1, g.CARR_BOT + 1), (w + 20, g.CARR_BOT + 8), "ลบมุม 2x45°")
    txt(m, at(o, (-w, g.CARR_TOP + 18)), "P06  1:1", 3.5)
    txt(m, at(o, (-w, g.CARR_BOT - 24)), "เส้นประ = ขอบช่องฟิลเตอร์ของ P05 (บ่ากว้าง 2.25)", 2.5)
    notes(m, (160, 150), [
        "1. " + GEN_TOL + ", ช่อง 46x46 พิกัด ±0.1",
        "2. รู Ø2.4 ผาย 90° ด้านนอก (ด้านไม่ติด P05)",
        "   ให้หัวสกรู M2 จมเรียบหรือต่ำกว่าผิว",
        "3. ลบคม ไม่มีครีบ",
        "4. ไฟล์ตัดเลเซอร์: ใช้ layer CUT",
    ])
    save(doc, "P06_ledge_plate.dxf")


# ---------------- assembly ----------------
def assy():
    doc, m = new_doc()
    W, H = 420, 297
    tb_x, tb_top = sheet(m, W, H, "ASSY", "แบบประกอบ / ASSEMBLY", "อลูมิเนียม (ดู BOM)", "1 ชุด",
                         "ตัด-พับ-เลเซอร์-เชื่อม TIG")
    # front view (from tube A side)
    o = (90, 170)
    w, HB = g.BODY_W / 2, g.HB
    rect(m, o, -w, -HB, w, HB, "VISIBLE")
    h, r = g.HANDLE_W / 2, 5.0
    pl(m, o, [(-h, HB, 0), (-h, g.HANDLE_TOP - r, -B90), (-h + r, g.HANDLE_TOP, 0),
              (h - r, g.HANDLE_TOP, -B90), (h, g.HANDLE_TOP - r, 0), (h, HB, 0)], "VISIBLE", close=False,
       fmt="xyb")
    circ(m, o, 0, g.FINGER_Y, g.FINGER_D / 2, "VISIBLE")
    circ(m, o, 0, 0, g.TUBE_A[0] / 2, "VISIBLE")
    circ(m, o, 0, 0, g.TUBE_A[0] / 2 - 2, "VISIBLE")
    circ(m, o, 0, 0, g.APERTURE / 2, "VISIBLE")
    rect(m, o, -25, -25, 25, 25, "HIDDEN")
    cross(m, o, 0, 0, w + 6, HB + 6)
    dlin(m, o, (-w, -HB), (w, -HB), (0, -HB - 10))
    dlin(m, o, (-w, -HB), (-w, HB), (-w - 10, 0), angle=90)
    dlin(m, o, (w, -HB), (h, g.HANDLE_TOP), (w + 12, 0), angle=90)
    ddia(m, o, (0, 0), g.TUBE_A[0] / 2, 40)
    txt(m, at(o, (-w, g.HANDLE_TOP + 12)), "VIEW A: มองจากด้านท่อ A  1:1", 3.5)

    # section through axis
    o = (215, 170)
    ra, rai = g.TUBE_A[0] / 2, g.TUBE_A[0] / 2 - 2
    rb, rbi = g.TUBE_B[0] / 2, g.TUBE_B[0] / 2 - 2
    z2, z3, z4 = g.T_SHEET, g.T_SHEET + g.GAP, 2 * g.T_SHEET + g.GAP
    zb, za = z4 + g.TUBE_B[2], -g.TUBE_A[2]
    ap = g.APERTURE / 2
    regions = []
    for s in (1, -1):
        regions += [(za, s * rai, 0, s * ra), (z4, s * rbi, zb, s * rb), (0, s * ap, z2, s * HB),
                    (z3, s * ap, z4, s * HB)]
    regions.append((z2, -HB, z3, -HB + g.T_SHEET))
    cz1 = z2 + (g.GAP - g.CARR_T) / 2
    cm, cz2 = cz1 + g.CARR_A, cz1 + g.CARR_T
    p, q = g.POCKET / 2, g.LEDGE / 2
    regions += [(cz1, g.CARR_BOT, cm, -p), (cz1, p, cm, g.FINGER_Y - g.FINGER_D / 2),
                (cz1, g.FINGER_Y + g.FINGER_D / 2, cm, g.HANDLE_TOP),
                (cm, g.CARR_BOT, cz2, -q), (cm, q, cz2, g.CARR_TOP)]
    for (x1, y1, x2, y2) in regions:
        x1, x2 = sorted((x1, x2)); y1, y2 = sorted((y1, y2))
        rect(m, o, x1, y1, x2, y2, "VISIBLE")
        hatch = m.add_hatch(dxfattribs={"layer": "HATCH"})
        hatch.set_pattern_fill("ANSI31", scale=0.25)
        hatch.paths.add_polyline_path([at(o, (x1, y1)), at(o, (x2, y1)), at(o, (x2, y2)), at(o, (x1, y2))])
    rect(m, o, cm - g.FILTER_T, -25, cm, 25, "VISIBLE")  # filter glass
    ln(m, o, (za - 6, 0), (zb + 6, 0), "CENTER")
    for (zz, rr, sgn) in ((0, ra, -1), (z4, rb, 1)):
        for s in (1, -1):
            pl(m, o, [(zz, s * rr), (zz + sgn * 3, s * rr), (zz, s * (rr + 3))], "WELD")
    dlin(m, o, (za, -ra), (0, -ra), (-20, -HB - 10))
    dlin(m, o, (z4, -rb), (zb, -rb), (30, -HB - 10))
    dlin(m, o, (0, -HB), (z4, -HB), (5, -HB - 10))
    dlin(m, o, (za, -ra), (zb, -rb), (5, -HB - 20))
    dlin(m, o, (z2, HB), (z3, HB), (5, HB + 8), text="6 (ร่อง)")
    dlin(m, o, (za, -ra), (za, ra), (za - 12, 0), angle=90, text=f"%%c{g.TUBE_A[0]} h9")
    dlin(m, o, (zb, -rb), (zb, rb), (zb + 12, 0), angle=90, text=f"%%c{g.TUBE_B[0]:.1f} h9")
    leader(m, o, (-1.5, ra + 1.5), (-30, HB + 14), "เชื่อม TIG รอบวง a3 (2 จุด)", left=False)
    leader(m, o, (cm - 1, 15), (zb - 5, HB + 14), "ฟิลเตอร์ 50x50 หนา 2")
    leader(m, o, (z4, -38), (zb - 2, -HB + 2), "P02")
    leader(m, o, (0.5, -38), (za + 4, -HB + 2), "P01", left=True)
    leader(m, o, (cz1 + 1, 40), (z4 + 18, g.HANDLE_TOP - 2), "P05 + P06")
    txt(m, at(o, (za - 10, g.HANDLE_TOP + 12)), "SECTION B-B: ตัดผ่านแกน  1:1", 3.5)

    # BOM
    bx, by = 290, 270
    cols = [("No.", 10), ("ชิ้นส่วน", 26), ("วัสดุ / ขนาด", 44), ("วิธีทำ", 22), ("Qty", 8), ("ไฟล์", 0)]
    rows = [("P01", "บอดี้หน้า", "Al5052-H32 t2", "เลเซอร์+พับ", "1"),
            ("P02", "แผ่นหลัง", "Al5052-H32 t2", "เลเซอร์", "1"),
            ("P03", "ท่อ A", f"Al6061 OD{g.TUBE_A[0]} x t2 x 40", "ตัด+กลึง", "1"),
            ("P04", "ท่อ B", f"Al6061 OD{g.TUBE_B[0]:.1f} x t2 x 40", "ตัด+กลึง", "1"),
            ("P05", "ถาดฟิลเตอร์", "Al6061-T6 t3", "เลเซอร์+ต๊าป", "1"),
            ("P06", "แผ่นบ่ารอง", "Al5052-H32 t2", "เลเซอร์", "1"),
            ("-", "สกรูหัวจม", "M2x4 สแตนเลส", "ซื้อ", "4")]
    txt(m, (bx, by + 3), "รายการชิ้นส่วน / BOM", 3.0)
    tw = sum(c[1] for c in cols[:-1])
    for i, row in enumerate([tuple(c[0] for c in cols[:-1])] + rows):
        y = by - (i + 1) * 6
        rect(m, (0, 0), bx, y, bx + tw, y + 6, "BORDER")
        x = bx
        for val, (_, cw) in zip(row, cols):
            txt(m, (x + 1.2, y + 1.8), val, 2.4)
            x += cw
    x = bx
    for _, cw in cols[:-2]:
        x += cw
        ln(m, (0, 0), (x, by), (x, by - 6 * (len(rows) + 1)), "BORDER")

    notes(m, (290, 205), [
        "ลำดับการผลิต:",
        "1. ตัดเลเซอร์ P01 P02 P05 P06, ต๊าป M2 ที่ P05",
        "2. พับ P01 ปีก 3 ด้าน 90° (ร่องใน 67 x 6)",
        "3. วาง P02 บนปลายปีก P01 เชื่อม TIG 3 ด้าน (บนเปิด)",
        "4. เชื่อมท่อ A ที่ P01, ท่อ B ที่ P02 รอบวง a3",
        "   ใช้จิ๊กจับร่วมศูนย์ ≤0.3, เชื่อมสลับจุดกันบิด",
        "5. กลึงผิว OD ท่อทั้ง 2 ให้ได้ Ø55.8 / Ø56.0 h9",
        "6. ขัดเม็ดเชื่อมในร่อง ลองเสียบ P05+P06 ต้องลื่น",
        "7. ลวดเชื่อม ER5356, ชุบอโนไดซ์ดำด้าน (แนะนำ)",
        "8. ประกอบ P06 กับ P05 ด้วย M2x4, ใส่ฟิลเตอร์",
        "   ยึดซิลิโคนที่มุม",
    ], h=2.5)
    save(doc, "ASSY_filter_adapter.dxf")


# ---------------- laser-only files (contours, true size) ----------------
def laser_only():
    import shutil
    lo = OUT / "laser_only"
    lo.mkdir(exist_ok=True)
    for f in ("P01_front_body_flat_t2.dxf", "P02_back_plate_t2.dxf", "P05_filter_carrier_t3.dxf",
              "P06_ledge_plate_t2.dxf"):
        src = Path(__file__).parent / f
        doc = ezdxf.readfile(src)
        new, m = new_doc()
        for e in doc.modelspace():
            if e.dxf.layer in ("CUT", "BEND"):
                m.add_foreign_entity(e.copy()) if hasattr(m, "add_foreign_entity") else m.add_entity(e.copy())
        save(new, f"laser_only/{f}")


if __name__ == "__main__":
    g.write_dxfs()
    p01(); p02()
    tube("P03", g.TUBE_A[0], "P03_tube_A_OD55.8.dxf")
    tube("P04", g.TUBE_B[0], "P04_tube_B_OD56.0.dxf")
    p05(); p06(); assy(); laser_only()
