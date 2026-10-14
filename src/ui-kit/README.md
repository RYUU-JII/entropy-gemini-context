# ui-kit

Canonical home for theme-neutral reusable UI primitives.

## Icons

`Icons.jsx` is the icon seam. Each Entropy domain concept has exactly one
glyph, exported under the concept's name:

| Concept | Export | Glyph |
| --- | --- | --- |
| Site protection (protected site, protected time) | `SiteProtectionIcon` | lucide `Shield` |
| Protection release | `ProtectionReleaseIcon` | lucide `ShieldOff` |
| Friction lane ("Add drag") | `FrictionIcon` | custom: block on rough ground |
| Barrier artifact | `BarrierIcon` | lucide `Construction` |
| Kekkai (isolation session) | `KekkaiIcon` | custom: shimenawa with two shide |
| Clinical settings tab ("Protocols") | `ProtocolsIcon` | lucide `ScrollText` |

Rules:

- Feature code imports lucide directly only for generic UI verbs and objects
  (arrows, close, chevrons, undo, clock, ...). A domain concept comes from
  `Icons.jsx`; add a named export there before giving a concept a glyph.
- One glyph, one concept. Do not reuse a concept's glyph for another concept,
  and do not give one concept two glyphs.
- Custom glyphs use lucide's 24px grid, round caps and joins, `currentColor`,
  and lucide-compatible props (`size`, `strokeWidth`, `className`).
- The shield family is reserved for site protection.
  `npm run check:ui-kit:concept-icons` rejects lucide `Shield*` imports outside
  `Icons.jsx`.
