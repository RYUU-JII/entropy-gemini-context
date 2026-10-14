# platform/rendering

Canonical home for theme-neutral scheduling, resource envelopes, resolution
calculation, and render-health observations.

## Ownership

- shared render-loop scheduling and diagnostic frame metrics
- validated target-FPS, DPR-cap, and viewport-pixel budget contracts
- a renderer-neutral sample of frame interval and measured update/render work
- `devicePixelRatio.js` reads and observes raw browser DPR; subscriptions are
  owned and disposed by each host. `ui-kit/hooks/useDevicePixelRatio.js` adapts
  it to React. Geometry observation remains with the existing resize owner.

`renderBudgetContract.js` accepts cap choices `1`, `1.25`, `1.5`, and `2`.
`resolveRenderResolution` and its static-canvas primitive `resolveRasterResolution`
use the same calculation: minimum of raw DPR, surface cap and the square-root
viewport pixel bound. Effective ratios stay continuous, may be below one, and
must survive worker transport/backing allocation unchanged. A raw DPR change
alone is not renderer identity; compare effective resolution and CSS/backing
geometry before reallocating resources.

## Boundaries

- No pressure taxonomy, tier transition, or device-class policy.
- No React, Zustand, storage, or Chrome messaging ownership.
- No theme-specific counts, materials, or optional-pass decisions.
- No worker admission or worker-failure degradation policy.
- No semantic actor counts, simulation cadence, interaction, or progression.

An adaptive surface consumes the shared observation and resource primitives,
then owns its governor and effect profiles in its domain. Fixed surfaces consume
only the resource contract they need.
