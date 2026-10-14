# Home Scan / Reflect Structure

- Status: Active
- Date: 2026-03-08
- Scope: `HOME` tab information architecture and layout contract
- Related:

- Owner: dashboard product
- Last validated against code: 2026-08-14
- Path policy: planning-allowed
- Canonical for: current dashboard information architecture baseline

  - `docs/product/popup/popup-overview-garden-experience-prd.md`
  - `docs/product/dashboard/information-architecture-basic-pro-tabs-prd.md`

## 1) Fixed decision

`Garden` is not a standalone top-level tab in the current dashboard structure.

The current home surface is a single `HOME` tab with two internal pages:

- `Scan`
- `Reflect`

The intent is to keep the Zen world assets inside the main daily workflow instead of isolating them into an ambiguous decorative tab.

## 2) Home / Scan

First registration:
- The empty Zen pond keeps one unnamed white invitation koi in the exposed
  left-hand water. Near a pointer it slows and its glow strengthens; actual hit
  feedback supplies a pointer cursor and a compact invitation. A native button
  opens the same registration sheet for keyboard and touch access.
- The sheet offers six fixed, non-personalized site choices, a visible editable
  daily goal, and a custom address option. A candidate from the popup appears
  first. One choice uses the canonical permission/registration command and
  commits that site's goal; cancellation or permission denial leaves it unregistered.
- A fresh popup directs first registration into Main before it can queue a
  rule. The persistent progression owner records actual Dashboard entry, after
  which quick popup registration is available. Existing used profiles receive
  a one-shot continuity admission. Final-site removal does not repeat onboarding.
- The URL carries only an uncommitted candidate. Main opens the sheet through
  the invitation; arrival alone never registers a site or skips the garden.

Role:
- Read recent browsing pressure through the pond
- Select a koi or pressure segment to keep one shared site context
- Read the present time and the selected site's recent temporal pressure trace without turning Home into an analytics page

Fixed layout:
- One restrained architectural field owns the composition, with a neutral top frame and a measured rear garden plane
- Left visible aperture: `pond / koi scanner`, flush to the composition's left edge; its landscape measurement slot spans both columns beneath the bonsai anchor
- One shared vertical aperture at 68% of stage width defines the water/garden boundary for paint and interaction; branches may cross it, without separate widget card frames
- Right: passive rhythm inscription in upper-right transparent negative space, absolutely positioned above the `CoreStatus` / bonsai field without consuming its height
- Bottom stratum: one compact recent-pressure rail continues the ivory frame from the left edge to the integrated garden bed; its current favicon opens the matching domain notebook. The bed supplies the lower-right visual weight instead of extending the graph under the tree.
- There is no full-width always-on 24-hour waveform

Layout rules:
- The pond is the main surface, not a card inside another card
- Do not add extra overlay copy or decorative badges on top of the pond by default
- Individual Zen Home surfaces do not render separate rounded card frames or floating shadows
- The frame is composition-owned neutral background space, not a stone texture, four-sided slab, inset outline, or per-widget card
- The pond and pressure rail have no left mat, and the pressure rail replaces a separate bottom frame
- Pond and bonsai do not own a divider border; the app-owned composition frame supplies the shared rear aperture and foreground seam geometry
- No extra frame gap sits between the pond and the pressure rail; the landscape rail remains attached to the pond and extends across the lower frame
- Pond and bonsai keep direct material and motion contrast inside the three-sided frame instead of receiving individual aperture outlines
- The Home bonsai uses a presentation-only `frame-garden-bed` style on one expanded transparent canvas spanning the bonsai aperture, widened left/right frame tracks, and lower front-wall datum. Home measures the actual stage, pond, bonsai, and pressure-rail rectangles and supplies one CSS-pixel layout frame; the renderer converts it through DPR once and never infers the app grid from theme code
- Landscape uses the shared `frame-seam` geometry for its rear paper edge, foreground lip, and planting anchor; portrait keeps local `planter` support. The detailed projection is owned by [the Zen product engine](../../architecture/themes/zen/zen-g15-product-engine.md#home-pond-facing-canopy-and-frame-seam--2026-09-28)
- The bonsai camera stays scene-local and maps the world trunk base to the mesh planting anchor; only the compositor applies the scene viewport offset. Canvas2D static layers and the Pixi branch rig therefore share the same root position
- The Home stage paints the rear plane and contact shadow; the transparent tree canvas and its foreground seam share the measured aperture. The pressure graph stays above the foreground, and the inline favicon action remains inside its quantitative graph cell
- The expanded tree canvas remains `pointer-events: none`; garden paint must not own or block rail interaction
- The garden-bed override must not alter bonsai genetics, topology, cultivation state, or other bonsai surfaces
- The pressure rail stays subordinate to the scene as part of the ivory frame. Its 34px hit face contains a 9px allocation using the existing pressure shares and 32px icon minimum. At rest all segments share the frame color; hover, touch exploration or keyboard focus reveals the current domain's existing policy color against ivory. Readiness uses straight tallies on the same datum. `Other` dissipates at the right edge, and the current hover/focus favicon is the direct notebook action. No dark bank, inset channel, extra hover line, rising segment or enclosing block border appears; interaction does not change width. Reduced motion disables these transitions and reveals immediately
- The rhythm marker occupies transparent negative space as glanceable context, not a separate time-picker card. In landscape its hour, separator, and minute cross the pond/frame/bonsai boundary respectively; a dissolving ambient line and one phase-toned celestial point intentionally hold the remaining upper-right air without adding another label or panel
- Controlled asymmetry keeps the right inscription/bonsai stack from becoming two equal dashboard cards

Portrait-desktop layout:
- `data-ui-layout="portrait-desktop"` is a dedicated desktop composition, not the compact/mobile drawer layout
- The same mounted Home widget DOM is reassigned by app-owned grid areas; viewport changes must not duplicate or remount the pond, bonsai, rhythm, or pressure widgets
- Zen orders one bounded stage as full-width pond, a left-anchored partial-width pressure stratum, then a lower row with bonsai at roughly 68% and the passive rhythm inscription at roughly 32%
- The landscape-only top, seam, and right frame tracks do not become a new horizontal separator between the pressure stratum and the lower row in portrait-desktop; the portrait garden-bed front body stays inside the bonsai slot
- Pond and lower-row block sizes are clamped by the short edge and viewport height, so the long portrait edge cannot stretch either live canvas indefinitely
- The portrait stage is optically centered within the available panel and keeps fixed geometry when evidence, selection, or First Vision paint state changes
- The rhythm slot keeps its full reserved geometry with or without a selected-site trace; selection only changes its internal ink marks and annotation
- Compact portrait keeps the safe single-column stack without forced landscape frame tracks. Its lower garden is one rectangular paper field with the existing local planter and paper material; the rhythm inscription and top breathing room stay inside the measured row height, so the full-height bonsai slot never extends beyond the stage. Portrait-desktop uses the same rectangular paper material in the lower row, while landscape retains the canonical left-pond / right-bonsai composition and vertical aperture
- Non-Zen Home uses the same portrait-desktop principle as a bounded scanner/core vertical stack with a 220–280px brief region; it must not reactivate the width-only landscape columns on a rotated monitor

Koi interaction contract:
- Clicking a koi selects one site
- Clicking a pressure-rail segment uses the same selection seam
- Pond and pressure rail update selection/hover emphasis together
- The rhythm marker may respond to the selected site, but it has no click, expansion, or hour-selection state

Time-meaning contract:
- Live Home does not claim that "today's peak" is meaningful before the day is complete
- The marker always shows current local time and a broad day phase
- The marker consumes the dashboard's canonical Zen ambient snapshot, derived from the same solar-environment authority as the pond and bonsai; it owns no private timer, fixed-hour phase palette, or hard-coded substitute
- A soft phase wash places the current time on the same day arc used by the configured Zen environment; it is orientation, not a claim about the user's current mental state
- With no selected site, the marker shows no aggregate pressure interpretation
- With a selected site, its aligned rolling-pressure profile may paint the actual hourly `targetPressureMs` distribution as ink traces on the day arc
- Sparse evidence stays sparse. The marker does not turn the trace into a typical window, prediction, safe period, current-pressure judgment, or recommendation
- Visible selection copy is limited to the domain name; rolling-window and empty-trace explanations remain accessibility context rather than persistent dashboard labels
- If the selected site and pressure-profile domain are not aligned, the marker suppresses the trace rather than displaying another site's or aggregate data
- Today's distribution is not relabeled as a completed-period share on the live Scan surface

Presentation-scene contract:
- `Home / Scan` is a presentation surface, not the source of truth for the active day.
- Current Scan reads current-cycle/rhythm-day projections.
- First vision arrives through the main presentation scene contract in `docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md`.
- Do not mutate the main status controller or Scan view model to impersonate another period.
- `Home / Scan` may receive the presentation decision for diagnostics/accessibility context, but behavior should come from scene projections.
- Pond, bonsai, pressure rail, rhythm marker, and overlay should receive scene projections rather than decide scene state locally.

Live Scan should answer only what is useful mid-day:
- `Which sites carry the most recent pressure?`
- `Which site is selected now?`
- `What time is it in the configured environment?`
- `At what parts of the day has the selected site's recent pressure appeared?`

Completed-period peak, future-window inference, and retrospective explanations
remain outside the release V1 ambient live composition. The selected-site day
arc is a passive visual projection of the existing rolling-pressure profile,
not a second analytics or policy surface.

## 3) Home / Reflect

Role:
- Review the day in a calmer numeric surface
- Read weekly change and protected progress
- Keep the theme's existing core status surface visible on the right

Fixed layout:
- Left: headline, summary metrics, site rows, weekly arc, protection read, next actions
- Right: existing theme `CoreStatus`

Zen rule:
- Zen must use the existing `ZenCoreStatus` surface
- For Home, Zen uses the direct classic workspace surface instead of a new custom bonsai scaffold

Guardrails:
- Do not replace the right-side Zen surface with a separate Home-only bonsai widget
- Do not duplicate the same meaning with both a fake bonsai and the existing core status
- The right side should stay visually strong but structurally simple

## 4) Why this split

`Scan` and `Reflect` represent two different time scales.

- `Scan` = live daily risk read
- `Reflect` = slower review and adjustment

This is stronger than a separate `Garden` tab because the pond and bonsai/core assets stay tied to the user's actual daily workflow.

## 5) Routing contract

`garden` is not a dashboard tab ID or release V1 route alias. Dashboard route
requests use the exact tab registry; unknown IDs enter the registry-owned
default-tab resolution without a predecessor-specific redirect.
