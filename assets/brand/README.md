# Surety brand assets

A watchful amber lion pauses beside one small multicolored butterfly. Connected honey and umber facets replace the historical tiger; a complete natural mane stays clear of the rounded frame.

## Use by surface

| Surface | Asset | Treatment |
| --- | --- | --- |
| README header / large gallery | `assets/brand/icon-rounded.png` | Selected rounded presentation, shown at 128 px in README |
| Expanded and collapsed sidebar | `apps/web/public/logo-24.png` | Transparent 24 px foreground; existing sidebar has no mask. |
| Loading screen | `apps/web/public/logo-256.png` | Transparent foreground displayed at 112 px, with sufficient resolution for a 2× screen; the surrounding orbital spinner is larger than the image and does not crop it. |
| Browser | `apps/web/public/favicon.png`, `favicon.ico` | Transparent 32 px PNG and complete 16/32/48 px ICO; declared in `apps/web/index.html`. |
| Apple touch | `apps/web/public/apple-touch-icon.png` | Opaque square presentation at 180 px. |
| Social | `apps/web/public/og-image.png` | Rounded tile on the 1200 × 630 dark canvas; declared Open Graph image. |
| Worker asset mirror | `apps/worker/static/logo-{24,80}.png`, `favicon.ico` | Build copies the selected web assets. The three historically tracked mirrors are synchronized. |

Root `logo.png` is the canonical 2048 × 2048 transparent foreground. `assets/brand/icon.png` and `icon-rounded.png` are separate square and rounded presentation masters. Small application and browser marks use the transparent foreground without a baked-in background, glow, color filter, or extra circular mask. Larger README, native-install, and social surfaces may use the designed background according to their platform contract.

## Rebuild and provenance

```sh
uv run --with pillow python scripts/resize-logos.py
```

One native image request. Azure Foundry `gpt-image-2`, native 2048 × 2048; selected study `2026-09-07-01`, finishing `01`. The owner delegated intermediate acceptance for this named five-project batch. The recorded agent inspection is not a claim that the owner reviewed the returned image bytes.

The smallest protected-feature clearance is **145.5 px** against the actual 23% rounded outline. Intentional lower neck/shoulder intersections are recorded separately; no expressive feature or accessory is clipped. The selected extraction preserves every fully opaque native RGB pixel. All artwork, background, grain, and shadow layers remain separate in the Hexly study.

The presentation uses **Amber fan relief**, with base `#9b865c`, light `#d1c49b`, shade `#625235`, and motif `#43351e`. Product UI colors remain independent. [source.json](source.json) records exact master hashes and the prior source identity.

- [Individual before/after page](https://hexly.ai/logos/surety)
- [Complete generation and finishing archive](https://github.com/nocoo/hexly.ai/tree/main/artwork/logo-family/surety/2026-09-07-01)
- [Local static review](https://index.dev.hexly.ai/artwork/logo-family/surety/2026-09-07-01/review.html)
- [Shared usage SOP](https://github.com/nocoo/hexly.ai/blob/main/docs/07-logo-usage-sop.md)
