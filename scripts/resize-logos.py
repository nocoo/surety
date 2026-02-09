#!/usr/bin/env python3
"""
Resize logo images for different use cases in the Surety app.

Generates:
- Sidebar logos (24px height)
- Login page logos (40px height)
- Favicons (16x16, 32x32, apple-touch-icon 180x180)
"""

from PIL import Image
from pathlib import Path


def resize_maintaining_aspect(img: Image.Image, height: int) -> Image.Image:
    """Resize image to specified height while maintaining aspect ratio."""
    aspect_ratio = img.width / img.height
    new_width = int(height * aspect_ratio)
    return img.resize((new_width, height), Image.Resampling.LANCZOS)


def resize_to_square(img: Image.Image, size: int) -> Image.Image:
    """Resize image to square, centering on transparent background."""
    # First resize maintaining aspect ratio to fit within square
    aspect_ratio = img.width / img.height
    if aspect_ratio > 1:
        new_width = size
        new_height = int(size / aspect_ratio)
    else:
        new_height = size
        new_width = int(size * aspect_ratio)

    resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Create square canvas with transparent background
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Paste centered
    x = (size - new_width) // 2
    y = (size - new_height) // 2
    square.paste(resized, (x, y), resized if resized.mode == "RGBA" else None)

    return square


def main():
    root = Path(__file__).parent.parent
    public = root / "public"

    # Load source images
    light = Image.open(root / "logo-light.png").convert("RGBA")
    dark = Image.open(root / "logo-dark.png").convert("RGBA")

    print(f"Light logo: {light.size}")
    print(f"Dark logo: {dark.size}")

    # Generate sidebar logos (24px height)
    sidebar_light = resize_maintaining_aspect(light, 24)
    sidebar_dark = resize_maintaining_aspect(dark, 24)
    sidebar_light.save(public / "logo-light-24.png", "PNG", optimize=True)
    sidebar_dark.save(public / "logo-dark-24.png", "PNG", optimize=True)
    print(f"Sidebar logos: {sidebar_light.size}")

    # Generate login page logos (40px height)
    login_light = resize_maintaining_aspect(light, 40)
    login_dark = resize_maintaining_aspect(dark, 40)
    login_light.save(public / "logo-light-40.png", "PNG", optimize=True)
    login_dark.save(public / "logo-dark-40.png", "PNG", optimize=True)
    print(f"Login logos: {login_light.size}")

    # Generate favicons (use light version)
    favicon_16 = resize_to_square(light, 16)
    favicon_32 = resize_to_square(light, 32)
    apple_touch = resize_to_square(light, 180)

    favicon_16.save(public / "favicon-16.png", "PNG", optimize=True)
    favicon_32.save(public / "favicon-32.png", "PNG", optimize=True)
    apple_touch.save(public / "apple-touch-icon.png", "PNG", optimize=True)

    # Generate .ico file with multiple sizes
    favicon_16.save(public / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])

    print("Favicons generated: 16x16, 32x32, 180x180, .ico")
    print("Done!")


if __name__ == "__main__":
    main()
