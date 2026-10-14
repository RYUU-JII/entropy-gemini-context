# Filter Tab Boundary Map

- Status: Active
- Owner: dashboard Filter tab, filter settings editor, preview scenario model, protection artifact runtime model, protocol settings store
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: filter settings editing surface, preview-only protection scenarios, artifact-family navigation, runtime status sidebar, and filter-settings persistence handoff
- Companion to:
  - `docs/architecture/repository/settings-command-boundary-map.md`
  - `docs/architecture/repository/protection-content-runtime-boundary-map.md`
  - `docs/architecture/repository/tools-artifact-support-boundary-map.md`
  - `docs/architecture/repository/theme-engine-boundary-map.md`

## Purpose

The public Settings Protection section owns the single `coolingCurve.preset`
selector (부드럽게 / 표준 / 가파르게), committed through the named protocol
settings command. This development-only Filter surface displays the current
preset and a link to Settings, with no duplicate preset setter. Selecting a
preset in Settings clears `advanced` atomically; there is no advanced editor yet.
The four family modes live in their Tools docks. Runtime
state reads the background `coolingCurve` projection (active/no_budget/no_basis)
and existing goal-end summary; it never computes usage progress or effective
strength from the settings preview.

The Filter tab is a dashboard control surface for protection filter settings.
It can maintain local draft state for responsive controls and can build preview
scenarios, but it must not invent canonical filter keys, persist preview-only
settings, or derive runtime truth from mock preview lanes.

The practical reading question is:

```text
Can a Filter tab edit be traced from a visible control to the canonical
filterSettings setter without preview defaults or unknown keys becoming
business state?
```

## System Flow

Filter shell:

```text
development-profile Filter entry
  -> FilterTab
  -> useDashboardTabReadiness(tabId="filter")
  -> useProtocolStore(filterSettings setter, coolingCurve read-only projection)
  -> useFilterSettingsEditor()
  -> useFilterRuntimeModel()
  -> ArtifactFamilyNavigator / PreviewMockupTop / SettingsPreviewSection / ProtectionControlSidebar
```

Settings edit path:

```text
SettingRow
  -> FilterSettingsSidebar
  -> useFilterSettingsEditor handlers
  -> known SETTING_METADATA key assertion
  -> useProtocolStore.setFilterSettings()
  -> normalizeFilterSettings()
  -> settings command/persistence pipeline
  -> protection broadcast
```

Text Rhythm edit path:

```text
SettingRow(Text Rhythm On/Off)
  -> useFilterSettingsEditor.handleToggle()
  -> buildTextRhythmFilterPatch(enabled)
  -> persist only { textRhythm: { isActive, value: true } }
  -> useProtocolStore.setFilterSettings()
  -> filterSettings commit and protection broadcast
  -> EnvelopeAdapter / frictionModifierResolver
  -> relaxed | normal | reinforced runtime profile materialization
```

Social metric edit path:

```text
SettingRow(Veil scope + Time Signals)
  -> useFilterSettingsEditor.handleCompoundChange()
  -> Off | reactions | reactions_and_views | all_comparison
  -> buildSocialMetricOptionsForScope()
  -> explicit boolean option payload for runtime adapters
  -> useProtocolStore.setFilterSettings()
```

Preview path:

```text
useFilterSettingsEditor.localSettings
  -> buildProtectionPreviewSettings()
  -> summarizeProtectionPreviewLanes()
  -> SettingsPreviewSection
  -> ProtectionControlSidebar lane cards
```

Runtime status path:

```text
useProtectionRuntimeSubscription()
  -> shared artifactRuntimeSnapshot only
  -> useFilterRuntimeModel()
  -> canonical artifact telemetry selectors
  -> status/insight cards
```

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Filter build-profile entry | dashboard build entry | `src/apps/dashboard/tabEntries/filterEntry.dev.js`, `filterEntry.public.js` | development-only registry entry; `null` in public builds | retaining a disabled Filter dynamic import in the public chunk graph |
| Filter tab shell | dashboard Filter tab | `src/apps/dashboard/tabs/filter/FilterTab.jsx` | composed editor/preview/runtime UI | direct storage writes or sibling tab controllers |
| Settings draft/editor | Filter settings editor hook | `src/apps/dashboard/tabs/filter/useFilterSettingsEditor.js` | local settings draft and known-key patches | unknown filter keys entering `setFilterSettings` |
| Settings metadata | settings config domain | `src/domains/settings/config/settingsConfig.js` | `SETTING_METADATA`, category entries, storage value conversion | UI-local metadata tables |
| Canonical filter normalization | settings config domain | `src/domains/settings/config/index.js` | normalized `filterSettings` document | preview model as persisted settings |
| Enso interval preference | settings config domain + public Tools Veil controller | `ensoIntervalPolicy.js`, `useVeilArtifactSettingsFamily.js`, `buildVeilCard.jsx` | one ON/OFF preference plus 8/12/20 minute interval choices | arbitrary thresholds, separate Horizon switch, or Filter preview acting as public configuration |
| Binary visual/Text Rhythm settings and adaptive profiles | settings config domain | `canonicalBinaryFilterProfiles.js`, `frictionIntensityBands.js`, `visualFrictionProfiles.js`, `adaptiveFrictionProfiles.js`, `textRhythmProfile.js`, `index.js` | ON/OFF storage plus three named runtime profiles; see friction injection architecture §3.4 | persisted/public grayscale/blur/Text Rhythm levels, physical child-setting keys, or a second gate-state document |
| Social metric scope projection | settings config domain | `socialMetricScope.js` | three semantic comparison scopes projected to explicit runtime option booleans | arbitrary public combinations of internal option flags |
| Protocol settings persistence | protocol store/settings command seam | `src/apps/dashboard/stores/useProtocolStore.js`, settings command docs | persisted filter settings and protection broadcast | raw Chrome storage writes from Filter tab |
| Preview scenario model | Filter preview model | `protectionPreviewScenarios.js` | preview-only materialized filter settings and lane summary | treating scenario-inflated settings as runtime truth |
| Runtime status model | Filter runtime model | `useFilterRuntimeModel.js` | runtime status, degree options, insight cards | deriving runtime state from preview lane counts |
| Runtime snapshot read | shared protection runtime subscription | `useProtectionRuntimeSubscription.js` | snapshot-only subscription for Filter runtime cards | importing the full Tools artifact settings/capability/workflow control plane |
| Artifact navigation | Filter artifact navigator | `ArtifactFamilyNavigator.jsx` | selected artifact family/category | importing Tools controller state |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `useFilterSettingsEditor()` | canonical `filterSettings`, setter, theme profile | local draft, preview settings, edit handlers | inactive tab uses preview defaults only for UI silence |
| `requireKnownFilterSettingKey()` | setting key | metadata-known key | unknown/missing keys throw before persistence |
| `requireFilterSettingMetadata()` | setting key and UI-provided metadata | canonical `SETTING_METADATA` entry | stale/copied metadata throws before storage shape conversion |
| `requireFilterSettingControl()` | canonical metadata and expected control kind | handler-specific metadata control | wrong handler/control pairing throws instead of returning no-op |
| `updateSettings()` | known-key patch | `setFilterSettings` update | invalid patch or missing setter throws |
| `handleToggle()` | key/meta/checked | local draft plus persisted patch | Text Rhythm emits only its semantic binary entry; mutual exclusion between `temporal` and `saturation` stays explicit |
| `handleCompoundChange()` | social metric scope or time-signal action | one canonical scope payload plus independent time-signal state | unknown actions and invalid scopes throw before persistence |
| `handleValueInput()` | key/meta/value | local draft only | does not persist until commit |
| `handleValueCommit()` | key/meta/value | local draft plus persisted patch | unknown keys cannot enter canonical settings |
| `buildProtectionPreviewSettings()` | filter settings and scenario id | preview-only materialized settings | scenario defaults never persist directly |
| `summarizeProtectionPreviewLanes()` | preview settings | lane counts | lane counts are UI guidance, not runtime telemetry |
| `useFilterRuntimeModel()` | artifact runtime snapshot and preview lane summary | status/insights/degree model | runtime status uses canonical artifact telemetry selectors |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Inactive tab preview settings | Yes | inactive tab can use materialized defaults to avoid rendering noise |
| Preview scenario inflation | Yes | scenario changes are preview-only and must not call `setFilterSettings` |
| Unknown filter setting key from editor | No fallback | throw before `setFilterSettings` |
| Stale UI metadata for known key | No fallback | throw `FILTER_SETTINGS_EDITOR_METADATA_MISMATCH` before storage conversion |
| Wrong control-specific handler wiring | No fallback | throw `FILTER_SETTINGS_EDITOR_CONTROL_MISMATCH` instead of returning no-op |
| Composite filter patch child key missing from metadata | No fallback | composite editor patches must use canonical hidden metadata entries instead of bypassing known-key validation |
| Grayscale / blur / Text Rhythm strength | No public level | one semantic toggle owns the feature; runtime policy selects only `relaxed`, `normal`, or `reinforced`, and physical spacing/opacity/blur/shuffle values never persist as sibling settings |
| Social metric combinations | Semantic choices only | comparison metrics expose Off plus three named scopes; time signals remain one independent binary choice |
| Missing settings setter | No fallback | throw `FILTER_SETTINGS_EDITOR_SETTER_REQUIRED` |
| Unknown category selection | UI recovery only | sidebar may recover to the first visible category without persisting anything |
| Metadata-hidden/experimental settings | Bounded | visibility is driven by `SETTING_METADATA` and experimental flag |
| Runtime unavailable | Visible muted state | runtime sidebar can show idle/muted state, not synthetic runtime facts |
| Predecessor filter setting shapes | No | `normalizeFilterSettings` accepts the exact release V1 key and value contracts and rejects unknown or mixed predecessor fields |

## Current Findings

### F0. Text Rhythm is one current-only binary setting with bounded runtime profiles

Status: fixed in the 2026-07-21 artifact-control simplification pass.

The public Text Rhythm control writes only
`{ textRhythm: { isActive, value: true } }`. Runtime materialization owns three
non-persisted profiles: `relaxed` reduces spacing/opacity disturbance and
micro-blur while disabling shuffle; `normal` applies the default visual rhythm
and moderate sentence-boundary shuffle; `reinforced` increases the visual
rhythm and uses the stronger bounded shuffle profile.

Policy chooses at most one hidden intensity adjustment (`-1`, `0`, or `+1`).
Schedule relaxation outranks routine policy strengthening, exceptional Furin
overrun outranks schedule relaxation, suspension deactivates the feature, and a
user OFF state is never activated by policy. The old Lv3 acknowledgement UI,
admission state, physical child settings, and separate shuffle keys were deleted
rather than retained as compatibility paths.

### F1. Filter tab no longer depends on Tools-owned runtime seams

Status: keep.

Existing ownership tests guard that the Filter tab uses the shared protection
artifact control plane and does not import Tools tab runtime helpers.

### F2. Preview scenarios are local and non-persistent

Status: keep.

`buildProtectionPreviewSettings()` starts from current settings and returns
materialized preview settings for mockups and lane summaries. Scenario selection
does not call the canonical settings setter.

### F3. Editor patches now reject unknown filter keys and wrong value controls

Status: fixed in the 2026-06-29 Filter tab pass; tightened in the 2026-07-01
Filter editor control-contract pass.

`useFilterSettingsEditor` now validates patch keys, UI-provided metadata, and
control-specific handler pairing against `SETTING_METADATA` before calling
`setFilterSettings`. Unknown keys, stale/copied metadata, wrong control-handler
pairings, invalid patches, and missing setters fail loudly at the UI edit
boundary instead of flowing into `filterSettings`.

Range value handlers now require `control:"range"` metadata, so toggle-only or
compound settings cannot be mutated through the value commit path. Text Rhythm
has no composite child patch: the editor validates and persists the one
`textRhythm` metadata key, while runtime materialization expands it after the
settings boundary.

The social-metrics row no longer exposes four independent internal flags. It
projects Off plus three semantic comparison scopes through
`buildSocialMetricOptionsForScope()`, while Time Signals remains a separate
binary action.

### F4. Runtime status remains separate from preview lanes

Status: fixed in the 2026-07-01 Filter runtime truth pass.

`useFilterRuntimeModel` uses canonical artifact telemetry selectors for runtime
availability, artifact state, and the runtime status filter count. When runtime
is unavailable, the status card stays muted with a zero active-filter count
instead of borrowing preview scenario counts. Preview lane counts are still used
for sidebar guidance only.

### F5. Disabled Filter code is excluded from public builds

Status: fixed in the 2026-08-08 dashboard entry-cost pass.

The loading-policy descriptor remains available as pure architecture metadata,
but the registry entry is selected through a build-profile alias. Development
builds may retain the disabled Filter implementation for local work; public
builds resolve the entry factory to `null`, so `FilterTab` and Filter preview
widgets do not remain as unreachable dynamic chunks in the extension package.

## Re-Audit Checklist

Enso's public choice control lives in Tools, because Filter has no public build
entry. The development Filter toggle preserves the selected `ensoGate.value`
and its metadata points to Tools for interval selection. The stored value is
`frequent | standard | spacious`; it is not a binary marker or runtime config.

- Run `npm run test:file -- tests/useFilterSettingsEditor.test.jsx tests/useFilterRuntimeModel.test.jsx` after Filter editor/runtime-model behavior changes.
- Run `npm run check:dashboard:owner-architecture` after Filter ownership or runtime-subscription import changes. This structural owner supersedes the retired source-string ownership tests.
- Run `npm run test:file -- tests/adaptiveFrictionProfiles.test.js tests/settingsUpdateKeys.test.js` after settings metadata or filter normalization changes.
- Run `npm run check:theme-seam-role-architecture` after theme/profile handoff changes in Filter preview surfaces.
- Run the public build surface check after changing the Filter build-profile entry and confirm the manifest contains no `FilterTab` entry.
- Confirm new Filter controls add `SETTING_METADATA` and storage normalization before wiring UI handlers.
