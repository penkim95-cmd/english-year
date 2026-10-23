#!/usr/bin/env python3
"""Regenerates the home-screen icons in public/icons/.

Usage: python3 scripts/make-icons.py   (requires Pillow: pip install pillow)

The icons are committed, so this only needs to run when the design changes.
The maskable variant keeps its artwork inside the central safe zone.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int) -> ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def icon(size: int, maskable: bool = False) -> Image.Image:
    im = Image.new("RGB", (size, size), "#0F9D8A")
    d = ImageDraw.Draw(im)
    for y in range(size):  # teal gradient, top to bottom
        t = y / size
        d.line([(0, y), (size, y)], fill=(int(15 + 30 * t), int(157 - 40 * t), int(138 - 10 * t)))
    s = 0.78 if maskable else 1.0
    big, small = load_font(int(size * 0.34 * s)), load_font(int(size * 0.13 * s))
    sun = [size * (0.5 + 0.2 * s), size * (0.5 - 0.36 * s), size * (0.5 + 0.32 * s), size * (0.5 - 0.24 * s)]
    d.ellipse(sun, fill="#FFB547")
    d.text((size / 2, size * (0.5 - 0.02 * s)), "En", font=big, fill="white", anchor="mm")
    d.text((size / 2, size * (0.5 + 0.24 * s)), "1 YEAR", font=small, fill="white", anchor="mm")
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for n in (180, 192, 512):
        icon(n).save(OUT / f"icon-{n}.png")
    icon(512, maskable=True).save(OUT / "icon-512-maskable.png")
    print(f"wrote icons to {OUT}")


if __name__ == "__main__":
    main()
