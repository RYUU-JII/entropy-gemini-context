# Room 478 selected hybrid garden assets

These are generated photorealistic illustrations, not photographs of a real
location. The selected `04` study's three clean garden plates and independent
transparent furin are encoded from the committed, unchanged hybrid-v4 originals.
The complete image generation prompts and original dimensions remain in
`prototypes/room-478/assets/hybrid-v4-prompts.md`; the canonical product asset
ledger is `docs/operations/release-asset-provenance.json`.

Native Windows Python 3.14 / Pillow 12.1.0 encoded the background RGB plates with
`Image.save(path, 'WEBP', quality=92, method=6)`. The furin uses RGBA
`Image.save(path, 'WEBP', lossless=True, method=6, exact=True)` to preserve its
transparent glass, alpha and hidden RGB. Dimensions and the furin's decoded RGBA
are verified against the originals. No crop, scale, generated repair or scene
redesign is applied. Original alpha crop bounds are display metadata owned by
`room478Garden.js`, not a destructive asset edit.

| Asset | Dimensions | Encoded bytes |
| --- | --- | ---: |
| `zen-garden-wide-hybrid-v4.webp` | 1536 × 1024 | 320700 |
| `zen-garden-portrait-hybrid-v4.webp` | 941 × 1672 | 243880 |
| `zen-garden-panorama-hybrid-v4.webp` | 1915 × 821 | 334860 |
| `zen-furin-hybrid-v4.webp` | 1024 × 1536 RGBA | 794224 |

The four product files total 1693664 bytes versus 8054869 source PNG bytes.
This reduces encoded transfer/storage size; it does not claim lower decoded
texture memory or measured browser/GPU cost.
