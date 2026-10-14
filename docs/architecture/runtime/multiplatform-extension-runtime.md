# Multiplatform Extension Runtime

- Status: Active
- Owner: platform runtime
- Last validated against code: 2026-10-08
- Path policy: current-only
- Canonical for: extension build target profiles and browser API boundary ownership

Entropy is Chrome MV3-first today, but extension runtime access must be shaped so Chromium-compatible browsers, Firefox, and Safari can be validated without rewriting product domains.

## Build Targets

`ENTROPY_EXTENSION_TARGET` selects the extension package profile. Chrome also
separates the live development package from public artifacts so a verification
build cannot delete hashed chunks used by an already-open unpacked extension.

- `chrome` development (`npm run dev`, `npm run build`, `npm run build:quick`): validated staging artifact promoted to the publisher's canonical current destination (`dist`, or `latest` while an explicit real-use pin is active)
- `chrome` public (`npm run build:prod`, `npm run build:release`, `npm run build:chrome`): output `dist-prod`
- `whale`: Chromium-compatible Whale package, output `dist-whale`
- `firefox`: Firefox WebExtension package seed, output `dist-firefox`
- `safari`: Safari Web Extension converter seed, output `dist-safari`

`dist` is the stable unpacked-development path. Keep Chrome pointed at that path
to preserve the existing local extension identity and its extension-owned data.
Development builds write only to a unique sibling staging directory under
`.artifacts/dev-extension-builds/staging`. After the full artifact contract
passes against its captured build inputs, the publisher retires the
current directory, promotes the complete staging directory, and preserves the
prior complete version at `.artifacts/dev-extension-builds/previous`. A build
failure leaves `dist` untouched; a failed
publish rename restores the retired directory. `npm run dev` applies the same
transaction on each stable source change instead of exposing CRX/Vite's partial
watch output as the loaded package.

An explicit artifact-only real-use pin keeps the exact loaded `dist` path and
bytes unchanged, preserving ordinary Chrome's extension ID and settings. The
same publisher records the consumer's build/input/tree digest in
`.artifacts/dev-extension-builds/real-use-pin.json`, initializes a complete
`latest` publication, and routes subsequent builds and default QA artifact
readers to `.artifacts/dev-extension-builds/latest`. Release requires the exact
pin ID and promotes latest back to dist through the same rollback transaction.
The persistent pin and released receipt, strict validation, manual reload
handoff and failure semantics are canonical in
`../../operations/qa/entropy-qa-control-plane.md`. No browser profile migration
or hashed-chunk fallback is permitted.

Before bundling, the publisher captures the declared inputs under
`.artifacts/dev-extension-builds/inputs`, verifies their digest against the live
checkout, and builds from that captured directory. The lockfile is captured;
`node_modules` remains the toolchain junction, so concurrent dependency installation
is outside this contract. Editor saves during bundling belong to the next build.
Artifact provenance records the captured input digest, and the input directory is
released on success or failure. CI guards this capture/build/provenance chain.

Public Chrome output must never target `dist`; the Vite build contract fails
loudly with `EXTENSION_BUILD_OUTPUT_PROFILE_COLLISION:public:dist` if a command
tries to cross that boundary. A raw development Vite command targeting `dist`
fails with `EXTENSION_BUILD_ACTIVE_DEV_OUTPUT_MUTATION:dev:dist`; only the
staged publisher owns active development promotion. Explicit temporary output
directories remain allowed for isolated CI and diagnostic builds.

Read-only `vite-node` and Vitest consumers use the aliases and transforms from
`vite.config.js` without constructing the CRX plugin. Static checks therefore
cannot initialize, empty, or watch the active unpacked output as a side effect
of merely loading Vite configuration.

Target manifests are derived from `src/manifest.json` by
`src/platform/build/extensionManifestProfile.js`. The canonical browser floor
owner is `src/platform/extension/chromeCompatibilityContract.js`; the static
manifest literal, Vite JS/CSS targets, security guard, and CWS preflight must
consume or assert that contract rather than declaring another version owner.

Extension-page worker policy is separately owned by
`src/platform/extension/extensionPageWorkerCspContract.js`. Each source and
finalized profile must declare exactly one `worker-src 'self'` directive.
Extension-context workers execute packaged modules; `blob:` is not a supported
Chrome MV3 worker source. Image/media blob allowances remain independent.
[Chrome's unsupported-policy contract](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security#remove-unsupported-content-security-policies)
also governs the install-time restriction. Existing HTTP(S) content-document
module-blob bootstrap is a separate page context and cannot widen this policy.

Reviewed and adopted public-Chromium capability floors:

| Capability owned by the public compatibility contract | Minimum Chrome major |
| --- | ---: |
| `chrome.storage.session` | 102 |
| CSS `:has()` selectors | 105 |
| CSS dynamic viewport units (`dvh`, `svh`, `lvh`) | 108 |
| CSS `color-mix()` | 111 |
| Prioritized Task Scheduling `scheduler.yield()` | 129 |

The public minimum is the maximum reviewed floor, Chrome 129. Chromium Vite
builds and the landing build use `chrome129` for both JavaScript and CSS. The
manifest remains static JSON for browser tooling, so build and release checks
fail loudly if its literal differs from the canonical contract.

Current target behavior:

- Chromium targets keep `background.service_worker`, Chrome-compatible permissions,
  and `minimum_chrome_version: "129"`. The higher functional artifact floor
  owns the public package; the runtime does not substitute another backend or
  visual implementation below it. Whale retains the same Chromium floor.
- Firefox adds `background.scripts`, `preferred_environment`, and
  `browser_specific_settings.gecko`, while removing Chrome-only `favicon`,
  `minimum_chrome_version`, and any future Chrome-only `offscreen` / `tabCapture`
  permissions plus Chromium-only web-accessible-resource keys.
- Safari adds `background.scripts` and `preferred_environment`, while removing
  Chrome-only `favicon`, `minimum_chrome_version`, and any future Chrome-only
  `offscreen` / `tabCapture` permissions plus Chromium-only
  web-accessible-resource keys. The output is a web extension seed, not a
  complete Xcode/App Store package.

## Runtime API Boundary

Raw extension namespace probing is owned by:

- `src/platform/extension/extensionApi.js`

Promise/callback normalization is owned by:

- `src/platform/extension/extensionApiCall.js`

Feature code must not probe `chrome`, `browser`, or browser-specific extension globals directly. App/domain code must use platform ports such as:

- `src/platform/chrome/ChromeService.js`
- `src/platform/messaging/runtime/runtimeMessaging.js`
- `src/apps/background/services/runtime/*BrowserPort.js`
- `src/platform/storage/internal/chrome-storage/*`

The `chrome` names still present in these paths are compatibility names. They are not a signal that feature code may depend on Chrome-only runtime semantics.

## Capability Policy

Missing cross-browser capability is not a fallback source of truth. If a target lacks an API such as `favicon`, `idle`, `webNavigation`, `history`, `bookmarks`, or `storage.session`, the target profile or platform port must expose a diagnosable unavailable state.

Do not silently replace a missing browser API with unrelated storage, theme, or business defaults.

The Chrome 129 floor admits `scheduler.yield()` for Chromium and Whale artifacts.
`src/platform/scheduling/mainThreadCooperativeScheduler.js` owns that capability,
the canonical 3ms slice deadline, and the named fail-loud unavailable error.
Protection effect sequencing, Visual initial/media-mutation reconciliation,
Text Shuffle mutation ingress, and Social Metrics candidate collection are its
current consumers. Shared-observer consumers coalesce mutation identity before
entering the continuation; the hub callback does not retain their DOM traversal
or write work. Social Metrics preserves selector/semantic union order and exact
node identity while yielding between root, semantic-scope cursor-step, and
candidate-batch units. The YouTube cursor keeps its former facet order while
splitting watch-link discovery and link/text work into eight-node batches;
selector hits are filtered in 64-node batches, while an individual browser
selector query remains atomic. Feature code must not read
`globalThis.scheduler` directly,
substitute a timer/idle callback/microtask fallback, or yield inside the scroll
physics `requestAnimationFrame` loop. Firefox and Safari seeds remain unsupported
for this content runtime until their target contract is explicitly adopted.

## Guardrail

`npm run check:extension-api-boundaries` rejects new direct extension namespace probing in active app/platform runtime code. The only raw global boundary is `src/platform/extension/extensionApi.js`; the classic content loader is allowed because it is a self-contained non-module bootstrap artifact.
