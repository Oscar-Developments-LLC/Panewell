"""Generate Panewell app icons.

The uploaded logo is a wordmark: text plus the rounded-pane symbol. Text is
unreadable at 16-32px, which is where app icons actually live (taskbar, dock,
tab strip). So this builds an icon from the pane symbol alone, using the same
brand gradient sampled from the logo (teal #048298 to orange #B45F06).

Renders at 4x then downsamples, which gives clean antialiased edges.
"""

from PIL import Image, ImageDraw

SIZE = 1024
SS = 4  # supersample factor
S = SIZE * SS

TEAL = (4, 130, 152)
ORANGE = (180, 95, 6)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, c1, c2):
    """Diagonal gradient, matching the logo's top-left to bottom-right feel."""
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for i in range(size * 2):
        t = i / (size * 2 - 1)
        d.line([(i, 0), (0, i)], fill=lerp(c1, c2, t))
    return img


def rounded_mask(size, box, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


# Outer tile: the full rounded square, filled with the brand gradient.
outer_inset = int(S * 0.06)
outer_box = (outer_inset, outer_inset, S - outer_inset, S - outer_inset)
outer_radius = int(S * 0.22)

grad = gradient(S, TEAL, ORANGE)
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(grad, (0, 0), rounded_mask(S, outer_box, outer_radius))

# Inner pane: a white window sitting inside, the "pane" in Panewell. Slightly
# wider than tall so it reads as a browser window, not a plain square.
pane_w = int(S * 0.54)
pane_h = int(S * 0.40)
pane_x = (S - pane_w) // 2
pane_y = (S - pane_h) // 2
pane_box = (pane_x, pane_y, pane_x + pane_w, pane_y + pane_h)
pane_radius = int(S * 0.055)

draw = ImageDraw.Draw(icon)
draw.rounded_rectangle(pane_box, radius=pane_radius, fill=(255, 255, 255, 255))

# Title-bar hint: a thin bar across the top of the pane, tinted so the icon
# reads as a browser window even at very small sizes.
bar_h = int(pane_h * 0.17)
bar_mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(bar_mask).rounded_rectangle(pane_box, radius=pane_radius, fill=255)
bar_clip = Image.new("L", (S, S), 0)
ImageDraw.Draw(bar_clip).rectangle(
    (pane_x, pane_y, pane_x + pane_w, pane_y + bar_h), fill=255
)
bar_mask = Image.composite(bar_mask, Image.new("L", (S, S), 0), bar_clip)

bar_layer = Image.new("RGBA", (S, S), (233, 236, 239, 255))
icon = Image.alpha_composite(icon, Image.composite(
    bar_layer, Image.new("RGBA", (S, S), (0, 0, 0, 0)), bar_mask
))

icon = icon.resize((SIZE, SIZE), Image.LANCZOS)
icon.save("build/icon.png")

# Windows .ico needs the small sizes baked in; Windows picks the best match
# rather than downscaling the 1024 itself.
icon.save(
    "build/icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

# Linux wants a size-named set.
import os
os.makedirs("build/icons", exist_ok=True)
for s in (16, 32, 48, 64, 128, 256, 512, 1024):
    icon.resize((s, s), Image.LANCZOS).save(f"build/icons/{s}x{s}.png")

print("wrote build/icon.png, build/icon.ico, build/icons/*")
