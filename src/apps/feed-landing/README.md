# Feed landing

Standalone public feed experiment. Existing `../landing` remains the Zen reading journey.
This app neither mounts the extension nor reads its data.

## Start here

- `FeedLandingApp.jsx`: composition, navigation and modal routing.
- `content/posts.js`: authored posts, authors and typed media descriptors.
- `feed/`: post formats, gallery, reaction controls, comments and sharing.
- `data/`: session interaction repository; the only owner of likes and comments.
- `shortform/`: vertical video lifecycle, slot navigation and three presentation formats.
- `model/`: pure journey intensity and deterministic text projection.
- `experience/`: DOM measurement and the declarative terminus and afterword shared by feed and short-form.
- `media/`: original procedural artwork and direct interaction; no external assets.
- `layout/`: desktop navigation/context and app shell.
- `app/`: public destinations and product explanation.
- `ui/`: local reusable icons and native dialog.
- `styles/`: tokens, layout, posts, dialogs and journey styling.
- `privacy/`: independent public notice for this website.

## Run

```powershell
npm.cmd run dev:feed-landing
npm.cmd run build:feed-landing
npm.cmd run preview:feed-landing
```

Dev/preview bind to loopback and never start automatically. Build writes only
`dist-feed-landing/`; it does not publish the site or modify extension output.
The two HTML entries are `/` and `/privacy/`.

Optional Store CTA: set `VITE_FEED_CHROME_STORE_URL` and the exact frozen
`ENTROPY_CWS_EXTENSION_ID`. The existing release URL validator rejects a malformed
or mismatched destination. Without a configured Store destination, the product
invitation explicitly links to the real project's installation instructions.

## Extend

Add a post to the content catalog and choose a declared format. Add a genuinely
new format in the post renderer; add its media renderer inside `media/`.
The current repository is synchronous and memory-only. A server-backed version
must define asynchronous commands, pending/error states, identity, moderation
and privacy before replacing it. Do not bolt fetches or browser persistence onto
post components or silently keep a local mirror as a second source of truth.

The friction snapshot is an authored presentation, not extension cadence or
an inference about a visitor. Original comparison changes presentation only;
reaction counts and accessible content retain their actual values.

## Verification

```powershell
npm.cmd run check:feed-landing:boundary
npm.cmd run test:file -- tests/feedLandingModel.test.js tests/feedLandingExperience.test.jsx
npm.cmd run test:file -- tests/feedLandingShortForm.test.js
npm.cmd run test:file -- tests/feedLandingShortFormExperience.test.jsx
npm.cmd run qa -- run visual/feed/landing-desktop
npm.cmd run qa -- run visual/feed/landing-mobile
npm.cmd run qa -- run visual/feed/landing-horizon
npm.cmd run qa -- run visual/feed/landing-reflection
npm.cmd run qa -- run visual/feed/shortform-desktop
npm.cmd run qa -- run visual/feed/shortform-mobile
npm.cmd run qa -- run visual/feed/shortform-clip
npm.cmd run qa -- run visual/feed/shortform-dulled
```

The source boundary guard rejects extension/runtime imports, network APIs and
browser persistence. Headless visual scenes render the actual app, not copied
markup. Unit/integration flows verify actions; scene captures verify layout.
Neither certifies the extension's real-site interventions or a psychological effect.
