# Permission Capability Product Structure

- Status: Draft
- Date: 2026-04-10
- Scope: release-facing product structure for permissions, capability ownership, artifact mapping, settings IA, and permission request timing
- Owner: dashboard product / runtime security / protection runtime
- Last validated against code: 2026-06-05
- Path policy: planning-allowed
- Canonical for: user-visible capability model across `protection`, `insights`, `memory`, and artifact capability ownership
- Related:
  - `docs/decisions/security/selective-host-permission-security-decision.md`
  - `docs/product/dashboard/artifact-protocol-runtime-contract.md`
  - `docs/product/dashboard/artifact-six-axis-gate-architecture-spec.md`
  - `docs/architecture/security/security-surface-reduction-plan.md`
- Non-goal:
  - redesigning artifact visuals
  - changing the artifact protocol shape
  - shipping CLSE or content-sensing diagnostics in the public release UI

## 1) One-line decision

Release should present three product capabilities:

1. `Protection`
2. `Insights`
3. `Memory`

Artifacts do not own permissions.
Artifacts are configured by the user and executed only when the owning capability is available.

## 2) User-visible product model

### 2.1 Protection

Meaning:

- apply filters, gates, overlays, and other live interventions on chosen sites
- visibly change the browsing experience on the protected site

Permission family:

- `scripting`
- matching host permission for the selected site

What the user should understand:

- "Entropy can affect this site only after I allow access to this site."

### 2.2 Insights

Meaning:

- reflect browsing patterns
- power the main tab readout, suggestions, and adaptive interpretation

Permission family:

- `basic`: no extra browser prompt beyond baseline runtime permissions
- `precision`: `idle + webNavigation`

What the user should understand:

- "Entropy can analyze my local browsing patterns to give me feedback."
- "More precise insights are optional."

### 2.3 Memory

Meaning:

- remove or conceal traces such as blocked-site history and bookmarks

Permission family:

- `history`
- `bookmarks`

What the user should understand:

- "Entropy can clean up traces only if I explicitly allow history/bookmark access."

## 3) Capability tiers

### Tier A: baseline runtime

Uses baseline manifest permissions only.

Powers:

- tab-based stats
- domain time
- visits
- tab switching
- popup/dashboard state

### Tier B: protection execution

Requires:

- `scripting`
- site host permission for the protected site

Powers:

- filter application
- in-page gates and overlays
- runtime-only DOM inspection for intervention

### Tier C: insights basic

Requires:

- no additional browser permission beyond Tier A

Powers:

- all-site local pattern reflection
- unmanaged-site suggestions
- home read models
- pond / bonsai inputs from browser-level facts

### Tier D: insights precision

Requires:

- `idle`
- `webNavigation`

Powers:

- idle-aware correction
- hopping / quick return / loop-style navigation signals
- higher-confidence insights

### Tier E: memory controls

Requires:

- `history`
- `bookmarks`

Powers:

- blocked history cleanup
- blocked bookmark concealment / restoration support

## 4) Artifact ownership model

### 4.1 Rule

Artifacts must map to capability owners.
Artifacts must not trigger their own standalone permission ladder.

The ownership rule is:

- `Protection` owns live intervention artifacts
- `Insights` may enrich recommendation, copy, timing, or confidence
- `Memory` owns purge-style artifacts

### 4.2 Artifact categories

#### Execution-bound protection artifacts

These artifacts are meaningful because they act on protected sites.

- `lens`
- `veil`
- `barrier`
- `gate`
- `flare`

Rules:

- the user may configure them before any site permission is granted
- toggling them stores intent only
- they execute only on sites where protection access exists

#### Insight-enhanced protection artifacts

These artifacts are still protection artifacts, but insights can make them smarter.

- `gate`
- `flare`

Rules:

- they must have a useful protection-only behavior without insights
- insights may improve timing, explanation, confidence, or suggestions
- insights must not be the only reason the artifact works

#### Memory artifacts

These artifacts are meaningful only when trace access exists.

- `echo.memoryPurge`

Rules:

- if the user enables this artifact, the app may request memory permission immediately
- this request belongs to `Memory`, not to a generic "artifact permission"

## 5) Artifact capability matrix

| Artifact family | Capability owner | Needs protection execution to act? | Benefits from insights? | Needs memory permission? | First permission ask | Recommended badge |
| --- | --- | --- | --- | --- | --- | --- |
| `lens` | `Protection` | Yes | No | No | first protected-site attempt | `Runs on protected sites` |
| `veil` | `Protection` | Yes | Mildly, for explanation only | No | first protected-site attempt | `Runs on protected sites` |
| `barrier` | `Protection` | Yes | No | No | first protected-site attempt | `Runs on protected sites` |
| `gate` | `Protection` | Yes for live intervention, no for runtime reflection | Yes | No | first protected-site attempt | `Runs on protected sites` + `Insights can improve timing` |
| `flare` | `Protection` | Yes for live intervention | Yes | No | first protected-site attempt | `Runs on protected sites` + `Insights can improve timing` |
| `echo.memoryPurge` | `Memory` | No | No | Yes | first memory-purge enable action | `Needs memory access` |

Interpretation notes:

- `gate` and `flare` may still contribute to dashboard reflection without site execution, but their main value remains under `Protection`.
- `echo.memoryPurge` should not be shown as blocked or broken when memory permission is absent; it should be shown as configured-but-inactive until access is granted.

## 6) UX and IA model

### 6.1 Settings IA

Release settings should group controls by capability, not by raw browser permission.

Recommended top-level grouping:

1. `Protection`
2. `Insights`
3. `Memory`
4. `Advanced`

Recommended content:

- `Protection`
  - site access mode: selective / auto-apply
  - protected site coverage
  - artifact families that execute on sites
- `Insights`
  - personalized insights: on / off
  - precision insights: optional advanced enhancer
  - explanation of unmanaged-site suggestions and home readout
- `Memory`
  - blocked history cleanup
  - blocked bookmark concealment
- `Advanced`
  - diagnostics, reset, hidden labs gates, support tools

### 6.2 Artifact tab rules

The artifact tab should not present permission bundles as artifact-specific switches.

Instead, each artifact card may show capability badges such as:

- `Runs on protected sites`
- `Insights can improve timing`
- `Needs memory access`

The artifact tab should allow configuration even when capability access is absent.

State model:

- `configured`
- `active`
- `inactive until protection access`
- `inactive until memory access`

This keeps the toolset coherent without turning every artifact toggle into a browser-permission negotiation.

### 6.3 Home and popup rules

The popup should stay capability-first:

- protecting the current site may request site access
- enabling insights should not request site access
- enabling memory actions should not be mixed into popup protection success flows

The home surface should stay capability-honest:

- if insights are off, do not imply all-site recommendation intelligence
- if protection exists only on some sites, do not imply all configured artifacts are active everywhere

## 7) Permission request timing table

| User action | Product capability | Browser prompt? | Ask now? | Why |
| --- | --- | --- | --- | --- |
| install / first open | none | none | No | the user should see product intent first |
| enable `Protection` mode in settings | `Protection` | none | No | capability selection alone is not execution |
| toggle `lens`, `veil`, `barrier`, `gate`, or `flare` | `Protection` | none | No | artifact toggles should store intent, not force access |
| protect current site in popup | `Protection` | `scripting + site host` | Yes | execution is needed now |
| connect missing protected sites | `Protection` | `scripting + missing site hosts` | Yes | execution is needed on those protected sites |
| enable `Insights` basic | `Insights` | none | No | basic insights must remain lightweight |
| enable `Insights` precision | `Insights` | `idle + webNavigation` | Yes | only when the user asks for more accurate readouts |
| toggle `memoryPurge` or related memory action | `Memory` | `history + bookmarks` | Yes | the feature has no meaning without trace access |

## 8) User-facing copy principles

### 8.1 Protection

Preferred language:

- `Protect this site`
- `Allow access so Entropy can apply filters and gates here`
- `Only for this site`
- `Auto-apply to protected sites later`

Avoid:

- `Grant tracking access`
- `Grant behavioral monitoring`

### 8.2 Insights

Preferred language:

- `Personalized insights`
- `See daily flow, weekly recovery, and site suggestions`
- `Kept on this device`
- `Precision insights improve idle and navigation accuracy`

Avoid:

- `Mind reading`
- `Page-level surveillance`
- `Required for Entropy to work`

### 8.3 Memory

Preferred language:

- `Memory controls`
- `Remove blocked-site traces`
- `Hide blocked bookmarks`

Avoid:

- `Advanced analytics`
- `Required for protection`

## 9) Product rules that must remain true

1. `Protection`, `Insights`, and `Memory` must remain separate promises in release copy.
2. Artifacts must never be the primary owner of a permission request.
3. Protection artifacts may inspect DOM ephemerally for live intervention, but release insights must not be marketed as page-internal sensing.
4. Basic insights must stay useful without optional browser permissions.
5. Memory controls must stay isolated from insights enablement and from first-site protection success.
6. If capability access is missing, the product should show configured-but-inactive state rather than silently pretending the artifact is active.

## 10) Implementation consequences

### 10.1 Required near-term cleanup

To make this model true in runtime behavior:

1. decouple site-control execution from page-internal behavior collection in the public release path
2. keep `BehaviorHub` and CLSE-derived sensing behind labs or explicit non-release gates
3. add capability badges and inactive-state labels to artifact cards
4. keep memory-purge permission requests inside memory actions only

### 10.2 Settings and popup consequences

1. settings should foreground the three capability groups, not the raw permission list
2. popup should remain focused on site protection only
3. precision insights belongs in settings or the first dashboard local-analysis choice, not in the popup success flow
4. memory controls belong in tools/settings flows, not in protection onboarding

## 11) Final recommendation

Release should be explained to users like this:

- `Protection` changes chosen sites.
- `Insights` helps Entropy understand patterns on this device.
- `Memory` removes traces only when you ask it to.

Artifacts then become understandable:

- most artifacts are ways `Protection` manifests
- some artifacts get smarter when `Insights` is on
- one family, `Memory`, is about traces rather than intervention

That is the cleanest model for trust, onboarding, and long-term feature growth.
