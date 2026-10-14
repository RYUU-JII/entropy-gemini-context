# Selective Host Permission Security Decision

- Status: Active
- Date: July 11, 2026
- Scope: `optional_host_permissions`, site-by-site enforcement permissions, and runtime content-script registration
- Owner: security decisions
- Last validated against code: 2026-10-08
- Path policy: current-only
- Canonical for: selective-only host permission policy and wildcard-host prohibition

## Decision

Entropy release V1 has no Global Mode, global host grant, broad-grant detector,
global revoke flow, or wildcard runtime registration.

The manifest keeps `*://*/*` only as Chrome's declarative optional-host ceiling
so Entropy can later request concrete origins chosen by the user, such as
`*://example.com/*` and `*://*.example.com/*`. That manifest declaration is not
a granted runtime permission and is never submitted to `permissions.request` or
`permissions.remove`.

`web_accessible_resources.matches` may use the same manifest-only reach
declaration. Runtime admission still requires the concrete site grant and the
canonical managed-domain policy.

## Invariants

1. No required `host_permissions` manifest key.
2. `optional_host_permissions` is exactly `['*://*/*']` as the declarative
   ceiling for later selective requests.
3. Runtime permission requests contain only canonical concrete origins built by
   `buildOriginPatternsForDomain()`.
4. Runtime code contains no `<all_urls>` literal and no `*://*/*` request,
   removal, permission-state, or content-script-registration path.
5. Permission snapshots are used to measure concrete managed-domain coverage,
   not to infer a global mode.
6. Managed content scripts are registered only for concrete, granted,
   currently managed origins.
7. Unknown/malformed origin input and permission API failure remain visible;
   they do not widen scope.
8. The permission-domain builder accepts hostnames and exact IP literals only.
   It rejects ports, credentials, paths, query/fragment suffixes, and junk after
   an IPv6 bracket before normalization. Concrete origin snapshots must match
   the complete browser host-pattern grammar rather than rely on truncating
   the authority through the general UI domain normalizer.
   User-facing permission and registration commands preserve HTTP(S) URL paste
   input only after validating its complete authority; credentials and explicit
   ports are rejected rather than broadened to hostname-only access.

## Canonical Flow

```text
user chooses one managed domain
  -> normalizeDomain
  -> buildOriginPatternsForDomain
  -> ensureDomainEnforcementPermission(Strict)
  -> permissions.contains/request for concrete origins
  -> managed-domain permission coverage
  -> concrete managed content-script matches
```

## Manifest Wildcard Boundary

The two reviewed `*://*/*` manifest occurrences are:

- `optional_host_permissions`: declaration ceiling for selective host prompts.
- `web_accessible_resources.matches`: Chrome resource reach declaration.

They do not authorize a runtime wildcard registration. No other active source
file may contain the wildcard host literal.

The public nudge render-host WAR also does not trust its arbitrary website
parent as an activation authority. Parent `origin`/`source` cannot distinguish
page JavaScript from the isolated content world, so production `START` requires
a short-lived, one-time background capability bound to the trusted top-frame
issuer and exact render-host tab/session/nonce. After that bootstrap, the full
command/event data plane is the transferred `MessagePort`; window
`postMessage` has no worker-command fallback.

## CI Contract

`npm run check:security:surface` enforces:

- exact Manifest V3 permission/CSP shape,
- manifest-only wildcard host literals,
- no `<all_urls>` literals,
- no global-host owner/state tokens,
- no wildcard request/remove calls,
- concrete-origin permission helpers and visible failure surfaces,
- reviewed network execution and remote-code boundaries.
- Extension pages allow connections only to their own origin. The prior HTTPS
  favicon exception is retired: optional site permissions authorize page features,
  never icon downloads or telemetry. Favicon observations are source identities;
  their HTTP(S) addresses are never request destinations.
- The exact CSP pins `default-src 'self'`, `connect-src 'self'`, local script,
  style, font, frame and worker sources, and `object-src 'none'`,
  `base-uri 'none'`, `form-action 'none'`. Image data/blob URLs, media blob
  URLs and inline styles serve existing local rendering; they grant no remote
  destination. Extension contexts require exactly `worker-src 'self'`: their
  workers load packaged modules, and [Chrome MV3 rejects blob worker sources](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security#remove-unsupported-content-security-policies).
  The platform worker-CSP contract rejects unsupported sources independently of
  the exact manifest string guard. HTTP(S) content-document blob bootstrap is a
  separate page context and does not authorize wider extension-page sources.
  The source guard covers content's isolated world as well as
  extension pages and permits native fetch only in the own-origin asset adapter.
  AST inspection rejects ordinary primitive aliases, destructuring and static
  computed-property reads, including WebTransport and WebRTC peer connections.
  It is not whole-program taint analysis of dynamically constructed properties
  or arbitrary compromised JavaScript.
- Favicon UI and capture may read the extension-owned Chrome `_favicon/` cache
  endpoint. [Chromium's implementation](https://chromium.googlesource.com/chromium/src/+/e5ab0630f4bf3eae3cc59b2481b49432b7716252/chrome/browser/extensions/api/favicon/favicon_util.cc)
  explicitly disables favicon-server fallback. A cache miss preserves a committed
  local image or the visible monogram. Remote image candidates are never rendered.
- This controls extension resource loading and authored data transport. It does
  not constrain ordinary browser navigation or claim to contain arbitrary trusted
  JavaScript compromise through navigation APIs. A server transport requires a
  separate explicit security decision and matching CSP/guard changes.
- one-time capability admission and MessagePort-only data-plane ownership for
  the public nudge render host.

## Verification

1. `npm run check:security:surface`
2. focused capability-gate, domain-permission, managed-script selective-sync,
   Settings permission, popup, and protection-artifact tests
3. `npm run cws:preflight`
4. `npm run build`

Because Entropy has no released users, release V1 keeps no predecessor broad
grant cleanup or compatibility path. A future product request for broader host
access requires a new explicit security decision and review.
