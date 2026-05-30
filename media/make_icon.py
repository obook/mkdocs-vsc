#!/usr/bin/env python3
"""
make_icon.py
Generates the Marketplace icon (media/icon.png), an original 256x256 PNG.

Rendered at 4x and downsampled for clean anti-aliased edges. The design is an
indigo rounded square (matching the MkDocs Material palette) holding a white
documentation page, with a green "play" badge that evokes the live server. It
does not reuse the MkDocs logo, which belongs to the MkDocs project.
"""

from PIL import Image, ImageDraw

SCALE = 4
OUT = 256
S = OUT * SCALE  # working canvas size


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        color = lerp(top, bottom, y / (size - 1))
        for x in range(size):
            px[x, y] = color
    return img


# Indigo background with a rounded-square mask.
bg = vertical_gradient(S, (61, 77, 183), (40, 50, 138)).convert("RGBA")
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=52 * SCALE, fill=255)
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(bg, (0, 0), mask)

draw = ImageDraw.Draw(icon)

# White documentation page (with a soft drop shadow).
page = [74 * SCALE, 60 * SCALE, 182 * SCALE, 196 * SCALE]
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(
    [page[0] + 3 * SCALE, page[1] + 5 * SCALE, page[2] + 3 * SCALE, page[3] + 5 * SCALE],
    radius=12 * SCALE, fill=(20, 26, 70, 90),
)
icon.alpha_composite(shadow)
draw.rounded_rectangle(page, radius=12 * SCALE, fill=(255, 255, 255, 255))

# Title bar plus text lines, suggesting a rendered Markdown page.
INDIGO = (61, 77, 183, 255)
GREY = (196, 201, 217, 255)
left = 90 * SCALE
draw.rounded_rectangle(
    [left, 80 * SCALE, 150 * SCALE, 95 * SCALE], radius=5 * SCALE, fill=INDIGO
)
for y, right in ((110, 166), (126, 158), (142, 168), (158, 140)):
    draw.rounded_rectangle(
        [left, y * SCALE, right * SCALE, (y + 8) * SCALE], radius=4 * SCALE, fill=GREY
    )

# Green "live server" badge with a white play triangle, lower-right of the page.
cx, cy, r = 176 * SCALE, 188 * SCALE, 30 * SCALE
draw.ellipse([cx - r - 5 * SCALE, cy - r - 5 * SCALE, cx + r + 5 * SCALE, cy + r + 5 * SCALE],
             fill=(255, 255, 255, 255))  # white ring
draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(46, 160, 67, 255))
t = 12 * SCALE
draw.polygon(
    [(cx - t // 2, cy - t), (cx - t // 2, cy + t), (cx + t, cy)],
    fill=(255, 255, 255, 255),
)

icon.resize((OUT, OUT), Image.LANCZOS).save("media/icon.png")
print("Wrote media/icon.png", OUT, "x", OUT)
