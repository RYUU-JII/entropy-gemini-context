# Feed Landing

- Status: Active
- Owner: standalone feed landing app
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: finite social-feed introduction, session interactions, authored friction journey and standalone build isolation

## Product scope

The feed landing is a separate public-site prototype, alongside the existing
[Zen reading journey](./zen-landing.md). It starts from attractive authored
content and lets visual/reading costs accumulate until the feed ends. The content remains worth seeing at every depth; low-quality
late posts are not the mechanism.

The page has one message: **끝없는 피드에, 끝을.** (an end for the endless
feed). Its four beats are: the feed is worth reading; the feed cools; the feed
ends; this is Entropy. Cooling follows the manifesto's "value of one more":
effects soften rewards (colour, reaction emphasis) and make checking costlier
(blur, text shuffle) until little difference remains to scroll for. The Horizon
is then a declarative boundary conveying that nothing exists beyond it; it asks
no question (the Torii category in `AGENTS.md`, not a decision ritual). The
site does not claim to separate genuine interest from inertia. The page must
never end in "so what": the afterword answers what happened, where it applies,
and one action.

The product philosophy remains owned by [the manifesto](../entropy-manifesto.md)
and current capabilities by [the project introduction](../project-introduction.md).
The website neither measures attention/emotion nor promises reduced desire.
Its shortened authored timeline must not be presented as production admission
cadence. Runtime Horizon/Gate semantics remain owned by the
[feed-flow contract](../../architecture/runtime/feed-flow-runtime-target-architecture.md);
this website's declarative endpoints are a presentation, not that contract.
Neither experience offers a Gate choice; the previous website Gate demo was
retired on 2026-10-13.

## Ownership

| Concern | Owner | Contract |
| --- | --- | --- |
| Composition and public navigation | `src/apps/feed-landing/FeedLandingApp.jsx`, `layout/`, `app/` | Real destinations and semantic controls; no fake navigation |
| Authored posts, accounts and serial | `src/apps/feed-landing/content/posts.js` | Seventeen finite original posts from five authored accounts, including the fictional five-part 「하늘 한 장」 serial and the afterword comparison media; no invented popularity counts |
| Post rendering | `src/apps/feed-landing/feed` | Visual, gallery, interactive, text and quote formats |
| Artwork | `src/apps/feed-landing/media` | Code-native originals, including the serial's sky photographs (`artworks/SkyArtwork.jsx`); no remote images or continuous rendering loop |
| Opening viewpoint puzzle | `src/apps/feed-landing/media/artworks/AlignmentArtwork.jsx`, `media/alignmentGeometry.js` | Deterministic depth-offset point sculpture, native range input, local viewpoint only; no score, timer or autonomous loop |
| Likes and comments | `src/apps/feed-landing/data/createSessionFeedRepository.js` | Stable immutable subscribed snapshots, validated commands, memory only |
| Short-form content and playback | `src/apps/feed-landing/content/shortFormPosts.js`, `src/apps/feed-landing/shortform` | One local original clip, repeated through reel/clip/story layouts; one current video owns playback |
| Short-form navigation | `src/apps/feed-landing/model/shortFormNavigation.js`, `src/apps/feed-landing/shortform/useShortFormNavigation.js` | One wheel decision per burst, native touch snap, keyboard/button paging and retained highest reached slot |
| Original motion recipe | `scripts/dev/feed-landing/generate-shortform-video.mjs` | Explicit offline Canvas/FFmpeg generation of checked-in media; no runtime encoder or external media source |
| Endings | `FEED_ENDING` in `content/posts.js`, `SHORT_FORM_ENDING` in `content/shortFormPosts.js`; `experience/FeedTerminus.jsx`, `experience/FeedAfterword.jsx` | Content owns Horizon/afterword copy, staged-effect list and comparison; both experiences share one declarative terminus and afterword |
| Intensity and text projection | `src/apps/feed-landing/model` | Pure, deterministic and bounded; highest reached feed depth retained |
| DOM measurement and choice | `src/apps/feed-landing/experience` | Native scroll; explicit or renewed forward interaction; accessible equivalent controls |
| Website privacy notice | `src/apps/feed-landing/privacy/index.html` | Website session scope separated from extension records |
| Build | `vite.feed-landing.config.js` | Separate root and `dist-feed-landing/`; no CRX plugin or root public assets |
| Dependency/storage guard | `scripts/ci/check-feed-landing-boundary.mjs` | App-local import closure plus declared React/font packages; no runtime, storage or network owner |

These are app-local website concerns, not new canonical extension domains or
storage classes. No Chrome, extension settings, dashboard, theme runtime,
worker, IndexedDB or browser storage is imported. Future remote participation
must acquire an explicit server/identity/moderation/privacy owner and change
the guarded boundary in the same change.

## Experience

The website shell follows Zen's daytime material palette: a warm ivory outer
background (`#f8f6f0`), brighter central paper (`#fdfbf7`), ink text (`#383733`)
and restrained cedar accents (`#5d4037`). App-local semantic tokens own these
colors without importing the extension theme runtime. Symmetric desktop side
columns, fine warm dividers and generous post spacing keep reading central;
navigation has less visual emphasis than post copy. Dialogs and short-form
surroundings share the same materials. Artwork retains its original palette,
and controls over video retain light text against the image. No Zen ornaments
are added to communicate the theme.

1. Desktop uses a narrow navigation column, a central feed and a contextual
   studio column. Mobile uses the same stream with bottom navigation.
   Central reading follows author, post copy, artwork and actions. The shell
   has no promotional intro, format/category badges, repeated slogans or
   decorative artwork captions. The right column retains neutral studio context
   and session disclosure. The header information dialog describes the original
   works and session reactions; product information remains an explicit navigation
   destination. The feed top bar keeps one quiet line, `Entropy 체험 피드 · 끝까지
   내려가 보세요`, so visitors expect something at the bottom without being told
   what. Philosophy and original comparison appear only after the endpoint.
2. Discovery works before explanation: an anamorphic point sculpture opens the
   feed. Moving its native horizontal range control aligns scattered points into
   a ringed planet; keyboard range controls offer the same result. Explicit input
   updates geometry immediately even under reduced motion, without autonomous
   animation or scroll interception. Five accounts follow: studio artwork, lab
   experiments, short unrelated observations, the fictional `@one.sky.daily`
   whose daily sky photos stopped on day 3,128, and `@evening.walk`, whose
   five-part serial investigates why. Sky posts carry a relative age and day
   number so they read as resurfaced past posts, not new ones. Serial parts are paired with the effect
   about to start: part 2 states a vivid red while desaturation begins, the sky
   account's second photo can be recalled against its first, part 3 asks the
   reader to read a note the narrator can read while blur begins, and part 4's
   climax meets text shuffle. Noticing comes from text/image dissonance, not
   effect labels. Part 5, the ending of an account that chose to stop, is the
   feed's last post directly above the Horizon: the story completes, and the feed
   stops with it. Nothing pulls the visitor past the end. No advertising,
   sponsored placeholders or pre-endpoint stopping sermons appear.
3. The stream retains its highest measured depth. Desaturation starts after
   22%, signal emphasis after 42%, blur after 58% and sparse text projection
   after 76%. Each new effect is introduced after the prior effect settles;
   effects plateau before the end. These are initial authored
   values in `model/frictionJourney.js`, not validated efficacy thresholds.
4. Effects apply to content presentation. Navigation, choice controls,
   reaction values and form fields stay usable and truthful. Screen readers
   retain original body text. Reduced motion keeps text unshuffled.
5. The feed's Horizon follows the complete last post and only states the end
   (`이 피드도, 여기서 끝납니다.`). It has no button, Gate or continuation; an empty
   run follows so further scrolling finds nothing. A future hard stop belongs here.
6. Below the empty run the page explicitly stops being a feed. The afterword
   answers three questions in one place: what happened (the staged effects,
   listed by where they were felt, and part 3's window note compared with its
   original, where the note blurred during the journey becomes readable); where
   it applies (chosen sites and times: short-form, infinite feeds, autoplay
   recommendations); and one action (install, plus product information). It
   ends with no open reflective question and distinguishes this staged website
   from the extension's daily-budget cooling curve and configurable fixed family modes. The comparison toggle affects
   only that comparison, never the feed session.
7. Short-form ends the same way inside its final snap slot: a declarative
   Horizon (`이 숏폼도, 여기서 끝납니다.`), an empty run, then the same afterword
   comparing a still from its clip. No Gate, outcome state or victory state
   exists in either experience. Product information remains available from
   navigation throughout.
8. Navigation offers Feed and Short-form as the two primary experiences, with
   product introduction, GitHub and a truthful sponsorship-preparation dialog
   below. No saved-post feature or fake sponsorship destination remains.
9. Short-form repeats one six-second original video across twelve slots and
   three social presentation formats, without explanatory satire copy. It ends
   at its declarative Horizon. Each experience owns its own highest reached
   depth for the page lifetime; scrolling
   backward or switching views never removes accumulated effects. Original
   comparison is a separate endpoint presentation and never bypasses stream effects.
10. Only the current video plays; sources remain stable to avoid cancellation
    and reload churn. Unvisited videos use `preload=none`; once admitted, a
    video's preload policy remains stable even while paused. Departure, hidden documents
    and open dialogs pause it. User pause/resume preserves playback time.
    Reduced motion begins with a still poster and explicit play; unavailable
    autoplay exposes a play control, while load/decode failures remain visible.
    Touch uses native vertical snap. Wheel paging is scoped to the short-form
    viewport and rejects momentum/early bursts during settlement. Keyboard and
    previous/next buttons provide equivalent navigation. All three formats
    retain real likes, comments and sharing; no invented music or popularity.

Public product copy explains that the extension's enabled effects ramp with the
chosen site's daily budget under P1-C. This website compresses that experience
into scroll depth; its final declaration-only feed Horizon is a website
presentation until P2. The extension currently ends through Site Furin after
the required safe boundary on supported feeds. This is not universal site support
or a claim that further use is blocked.

This deliberately finite page is not infinite supply, a ranking/recommendation
service, an extension runtime test or an efficacy experiment.

## Participation and sharing

Likes start at zero and toggle between zero and one for this visitor. Comments
are plain text, limited to 500 characters, removable and never seeded.
All reactions reset on refresh and the UI says
so. There are no visitor accounts, analytics, cookies or backend requests.

Share links point to stable `#post-<id>` anchors. Clipboard/native sharing is
invoked only after a visitor action. Unavailable/denied capabilities show a
diagnostic message and a selectable URL; they never claim success. External
destinations are GitHub and a validated Store URL when configured. The absence
of a Store destination is an explicit prototype state with a real project
installation link, not an invented listing.

## Build and verification

`npm run build:feed-landing` runs its source boundary guard and the isolated
Vite build. It emits website HTML, local fonts/art code and font licensing.
No deployment is performed. `npm run dev:feed-landing` and
`npm run preview:feed-landing` are explicit loopback-only operator commands.

The model/repository and actual app user flows are covered by
`tests/feedLandingModel.test.js`, `tests/feedLandingExperience.test.jsx` and
`tests/feedLandingShortFormExperience.test.jsx`.
`visual/feed/landing-desktop`, `visual/feed/landing-mobile`,
and `visual/feed/landing-horizon` use the existing
[visual capture owner](../../operations/qa/visual-capture-harness.md), actual
app composition and headless run-owned browsers. The endpoint fixture requires
actual accumulated visual state and a Horizon without controls, using bounded
synthetic scene preparation. Captures do not certify trusted pointer gestures or
standalone release hosting.

`visual/feed/landing-aligned` additionally operates the actual range input and
requires its aligned accessible image/status. `visual/feed/landing-reflection`
scrolls through the endpoint to the afterword and requires the window-note
comparison, no interactive viewpoint and the install action. These fixture actions are synthetic,
not native touch-drag or perceptual-efficacy proof.

`visual/feed/shortform-desktop`, `visual/feed/shortform-mobile`,
`visual/feed/shortform-clip` and `visual/feed/shortform-dulled` additionally
require the real local video to decode, every inactive video to be paused and
the vertical surface to fit. Desktop requires actual muted playback advancement.
The dulled scene advances and reverses through the real viewport to verify
retained friction. These are synthetic scene actions, not trusted gesture proof.
