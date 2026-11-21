"""Subset the self-hosted fonts to the characters the site uses (Latin + a few symbols).

Sources (full Latin, variable weight) live in assets/fonts/ and are not published.
Output: public/fonts/*-sub.woff2. Run after adding text in a new script or symbol:
    pip install fonttools brotli && python tools/subset-fonts.py
"""
from pathlib import Path
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
# Basic Latin, Latin-1, general punctuation (dashes, quotes, ellipsis), arrows, ⋮, ™, €.
UNICODES = "U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-203A,U+2190-2199,U+22EE,U+2122,U+20AC"

for name in ("inter-latin-wght-normal", "montserrat-latin-wght-normal"):
    src = ROOT / "assets" / "fonts" / f"{name}.woff2"
    out = ROOT / "public" / "fonts" / f"{name.replace('-latin-wght-normal', '')}-sub.woff2"
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "tnum", "case"]
    opts.name_IDs = ["*"]
    font = subset.load_font(str(src), opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(UNICODES))
    s.subset(font)
    subset.save_font(font, str(out), opts)
    print(f"{out.name}: {src.stat().st_size // 1024} KB -> {out.stat().st_size // 1024} KB")
