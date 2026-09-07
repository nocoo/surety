#!/usr/bin/env python3
"""Generate Surety UI, browser, touch, and social assets from role-specific masters."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "apps/web/public"


def main() -> None:
    foreground = Image.open(ROOT / "logo.png").convert("RGBA")
    square = Image.open(ROOT / "assets/brand/icon.png").convert("RGB")
    rounded = Image.open(ROOT / "assets/brand/icon-rounded.png").convert("RGBA")
    PUBLIC.mkdir(parents=True, exist_ok=True)

    for size in [24, 80, 256]:
        foreground.resize((size, size), Image.Resampling.LANCZOS).save(
            PUBLIC / f"logo-{size}.png", optimize=True
        )
    foreground.resize((32, 32), Image.Resampling.LANCZOS).save(
        PUBLIC / "favicon.png", optimize=True
    )
    foreground.save(
        PUBLIC / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
    )
    square.resize((180, 180), Image.Resampling.LANCZOS).save(
        PUBLIC / "apple-touch-icon.png", optimize=True
    )
    social = Image.new("RGB", (1200, 630), (15, 15, 15))
    tile = rounded.resize((252, 252), Image.Resampling.LANCZOS)
    social.paste(tile, (474, 189), tile)
    social.save(PUBLIC / "og-image.png", optimize=True)
    print("Generated transparent UI/favicon marks and separate touch/social presentations.")


if __name__ == "__main__":
    main()
