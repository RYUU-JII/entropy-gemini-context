# apps

Canonical home for runtime entrypoints, boot wiring, listener registration, and page composition.

- `background`, `content`, `dashboard`, `gate`, `popup`, and the other extension surfaces own production entrypoint composition.
- `landing` owns the public, static Entropy introduction journey. It builds through
  `vite.landing.config.js` into `dist-landing/` and must not import Chrome runtime,
  extension storage, dashboard stores, or retained Zen runtime renderers.
- `feed-landing` owns the independent finite social-feed introduction prototype.
  Its authored content, session reactions and presentation journey build through
  `vite.feed-landing.config.js` into `dist-feed-landing/`, without extension data
  or runtime owners. See `docs/product/landing/feed-landing.md`.
- `boot` owns exact cross-entry boot business contracts shared by background producers and page consumers; it does not own transport, storage, or a generic app-wide shared layer.
- `room-478` owns the standalone post-Sentinel decompression surface: the handed-off
  rift geometry, one guided 4-7-8 breath, unbounded stillness, and semantic exit
  controls. It reuses the production crack plan and does not extend the worker renderer.
- `visual-harness` owns the development-only visual scene composition used by the one-shot capture runner. It is not an extension build input and must not become a second implementation of product UI.
