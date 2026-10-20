"""Render the per-part DXF drawings in cad/ to one multi-page PDF (true 1:1 on A4/A3).

Run:  python3 cad_to_pdf.py   (needs: pip install ezdxf matplotlib, and a Thai font e.g. Loma)
"""
from pathlib import Path

import ezdxf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.config import BackgroundPolicy, ColorPolicy, Configuration, LineweightPolicy
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

HERE = Path(__file__).parent
ORDER = ["ASSY_filter_adapter", "P01_front_body", "P02_back_plate", "P03_tube_A_OD55.8",
         "P04_tube_B_OD56.0", "P05_filter_carrier", "P06_ledge_plate"]
PREVIEW_FONT = "Loma.otf"  # Tahoma is not available on Linux; Loma has Thai glyphs

cfg = Configuration(background_policy=BackgroundPolicy.WHITE, color_policy=ColorPolicy.COLOR,
                    lineweight_policy=LineweightPolicy.RELATIVE, lineweight_scaling=0.6)

with PdfPages(HERE / "xenon_filter_adapter_parts.pdf") as pdf:
    for name in ORDER:
        doc = ezdxf.readfile(HERE / "cad" / f"{name}.dxf")
        doc.styles.get("THAI").dxf.font = PREVIEW_FONT
        for layer, color in (("NOTE", 7), ("WELD", 7), ("HATCH", 8)):  # readable on white paper
            doc.layers.get(layer).color = color
        W, H = (420, 297) if name.startswith("ASSY") else (297, 210)
        fig = plt.figure(figsize=(W / 25.4, H / 25.4))
        ax = fig.add_axes([0, 0, 1, 1])
        Frontend(RenderContext(doc), MatplotlibBackend(ax), config=cfg).draw_layout(doc.modelspace(), finalize=False)
        ax.set_xlim(0, W); ax.set_ylim(0, H); ax.set_aspect("equal"); ax.axis("off")
        pdf.savefig(fig)
        plt.close(fig)
        print("page", name)
