# Security Surface Reduction Plan

- Status: Draft
- Date: February 23, 2026
- Scope: CSP, host permissions, external asset dependencies, security CI guards

- Owner: platform security
- Last validated against code: 2026-07-29
- Path policy: current-only

## 1) Goal

1. Reduce extension network exposure and external runtime dependencies.
2. Enforce least-privilege policies for permissions and CSP.
3. Prevent regressions via CI checks.

## 2) Current Risks

1. Broad `connect-src`: `src/manifest.json:26`
2. Broad optional host capability (`*://*/*`): `src/manifest.json:21`
3. External font loading:
- `src/pages/dashboard.html:6`
- `src/pages/popup.html:7`
- `src/themes/styles/tokens/typography.css:7`
4. External texture URL usage:
- `src/themes/plugins/zen/widgets/tools/Furin.jsx:505`

## 3) In Scope

1. Tighten `src/manifest.json` CSP and optional host permissions.
2. Localize external font and texture dependencies.
3. Add CI guard scripts and wire them into quality gate.
4. Add focused regression tests for security-sensitive paths.

## 4) Out of Scope

1. Product policy changes.
2. Server-side architecture changes.
3. Theme redesign.

## 5) Delivery Plan (PR Units)

### SEC-01: Security inventory and CI scaffold

1. Add static checks for:
- forbidden external font/CDN URLs
- forbidden texture URLs
- CSP/permission policy constraints
2. Add report output for failed checks.

Done when:

1. New check commands run locally and fail on current violations.

### SEC-02: Font localization

1. Remove Google Fonts/jsDelivr imports in runtime HTML/CSS.
2. Bundle required fonts under local assets and reference local paths.

Done when:

1. No runtime font URL to external domain remains in app HTML/CSS.
2. Dashboard/Popup visual baseline remains acceptable.

### SEC-03: Texture/resource localization

1. Replace external texture URLs with local assets or data URLs.
2. Validate visual parity on affected components.

Done when:

1. No external texture URL remains in runtime UI paths.

### SEC-04: CSP tightening

1. Remove `http:` from extension page `connect-src`.
2. Keep only required origins for production behavior.
3. Verify favicon/network fallback behavior under stricter CSP.

Done when:

1. CSP is stricter and build/runtime checks pass.

### SEC-05: Permission control and justification

Release V1 decision:

1. There is no user-facing Global Mode or one-click all-sites connection path.
2. Keep `*://*/*` only as an optional host manifest pattern for runtime site-by-site requests.
3. Enforce site-specific request flows, concrete-origin runtime gating, and CI invariants; release V1 has no global grant read/revoke path.
4. Track controls in `docs/decisions/security/selective-host-permission-security-decision.md`.

Release permission surface:

1. Chrome `offscreen`, `tabCapture`, and `activeTab` are absent from public required permissions. The explicit Chromium dev profile adds them only for the human Suikinkutsu QA target.
2. Keep the audio dulling runtime development-only; public Rollup inputs,
   content, background dispatcher/runtime bindings, sender-policy paths, and
   emitted artifacts must not contain its capture path without a fresh
   UX/security review. Dev QA separately authenticates harness, exact content
   tab invitation senders, and the exact `action.onClicked` tab event; it never
   fabricates the browser invocation.
3. Non-Chromium and public manifest profiles remove `activeTab`, `offscreen`,
   and `tabCapture` through `src/platform/build/extensionManifestProfile.js`.
4. `scripts/ci/check-security-surface.mjs` is the exact manifest permission contract for the Chrome build: `storage`, `tabs`, `alarms`, `favicon`; optional `notifications`, `scripting`, `history`, `bookmarks`, `idle`, `webNavigation`; optional host `*://*/*`.
5. `scripts/ci/check-public-build-debug-surface.mjs` is the exact public
   artifact contract for development-only audio capture. It rejects the
   offscreen page, resolution graph, dev QA contracts/routes, background
   capture method surfaces, and tab-capture/getUserMedia signatures
   even when manifest permissions remain absent.

Done when:

1. The manifest wildcard ceiling and selective-only runtime are justified with enforced guardrails and verification checks.
2. Audio dulling permissions are justified in this plan and `docs/architecture/runtime/audio-dulling-runtime-architecture.md`, and CI rejects further undeclared permission drift.

### SEC-06: CI enforcement and tests

1. Add security checks into `gate:ci`.
2. Add security checks into the default build check phase.
3. Add regression tests around sender auth and destructive action guard paths.

Done when:

1. `npm run gate:ci` includes security guard checks.
2. `npm run build` includes `npm run check:security:surface`.
3. Regression tests pass.

## 6) Validation Checklist

1. `npm run build` passes.
2. `npm run test` passes.
3. `npm run gate:ci` passes with security checks included.
4. No forbidden external runtime URL remains in scoped files.
5. CSP/permission checks pass.

## 7) Risks and Mitigations

1. CSP tightening may break runtime fetch flows.
- Mitigation: add targeted smoke tests and fallback checks in same PR.
2. Permission minimization may impact specific workflows.
- Mitigation: staged rollout with explicit monitoring checklist.

## 8) Timeline

1. Week 1: SEC-01, SEC-02, SEC-03
2. Week 2: SEC-04, SEC-05, SEC-06

## 9) Definition of Done

1. External runtime dependencies are removed or explicitly justified.
2. CSP and permissions follow least privilege.
3. Security checks are CI-enforced.
4. No functional regressions in build/test/gate workflows.
