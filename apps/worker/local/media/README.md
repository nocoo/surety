# Original fixture media

`family-protection.png` and `family-protection.pdf` are original synthetic artwork
rendered from the inline SVG in `apps/web/local/generate-media.ts`. No production
export, private record, stock image, or external font is used.

Regenerate from the repository root with `bun run fixtures:media` (installed
Playwright Chromium required). The catalog uploads both through the normal
attachment API into the instance's native local R2 binding.
