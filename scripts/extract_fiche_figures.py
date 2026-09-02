"""Crop circuit/axis diagrams from Rigaut fiches (skip full-width colored boxes)."""
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "physique-chimie_MPstar_2026-2027" / "Cours"
if not SRC.exists():
    SRC = ROOT / "Physique Chimie MP star" / "Cours"
OUT = ROOT / "decks" / "Physique" / "Physique Chimie MP star" / "media"
OUT.mkdir(parents=True, exist_ok=True)

ZOOM = 2.4


def merge_rects(rects, gap=12):
    if not rects:
        return []
    rects = sorted(rects, key=lambda r: (r.y0, r.x0))
    merged = [pymupdf.Rect(rects[0])]
    for r in rects[1:]:
        last = merged[-1]
        grow = pymupdf.Rect(last)
        grow.x0 -= gap
        grow.y0 -= gap
        grow.x1 += gap
        grow.y1 += gap
        if grow.intersects(r):
            last.include_rect(r)
        else:
            merged.append(pymupdf.Rect(r))
    return merged


def is_diagram(rect, page_rect, n_drawings):
    w, h = rect.width, rect.height
    if w < 55 or h < 28:
        return False
    # Full-width colored boxes (À SAVOIR, etc.)
    if w > 0.70 * page_rect.width:
        return False
    if w * h > 0.45 * page_rect.width * page_rect.height:
        return False
    if n_drawings < 6:
        return False
    aspect = w / max(h, 1)
    if aspect > 7.5 or aspect < 0.14:
        return False
    return True


def main():
    n = 0
    for pdf in sorted(SRC.rglob("*fiche*.pdf")):
        doc = pymupdf.open(pdf)
        stem = pdf.stem.split("_")[0]
        for pi, page in enumerate(doc):
            drawings = page.get_drawings()
            rects = []
            for d in drawings:
                r = d.get("rect")
                if not r:
                    continue
                rr = pymupdf.Rect(r)
                if rr.width > 0.70 * page.rect.width:
                    continue
                rects.append(rr)
            merged = merge_rects(rects, gap=16)
            fig_i = 0
            for rect in merged:
                count = sum(1 for r in rects if pymupdf.Rect(r).intersects(rect))
                if not is_diagram(rect, page.rect, count):
                    continue
                clip = pymupdf.Rect(rect)
                clip.x0 = max(0, clip.x0 - 6)
                clip.y0 = max(0, clip.y0 - 6)
                clip.x1 = min(page.rect.x1, clip.x1 + 6)
                clip.y1 = min(page.rect.y1, clip.y1 + 6)
                pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=clip, alpha=False)
                fig_i += 1
                name = f"{stem}_p{pi+1}_fig{fig_i}.png"
                pix.save(str(OUT / name))
                n += 1
                print(name, pix.width, pix.height, "draws", count)
    print("total figures", n)


if __name__ == "__main__":
    main()
