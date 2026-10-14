# Zen Pond Visual Polish Plan

- Status: Draft
- Owner: Zen pond visual runtime
- Last validated against code: 2026-04-29
- Last updated: 2026-04-29
- Path policy: planning-allowed
- Canonical for: near-term Zen pond visual polish direction

## Goal

Bring the Zen pond from "feature-complete water effects" to a more unified,
premium water surface.

The pond keeps the full visual set enabled by default, with each effect made
better shaped, shared and less wasteful. The explicitly approved 2026-09-06
Home presets also offer user-selected balanced/power-saving budgets; see the
Active worker spec. No automatic performance-based downgrade is introduced.

## Visual Target

The pond should read as a single calm material:

- sky and clouds reflected on the surface
- sun glints moving with the water, not pasted above it
- shallow bottom detail visible through the water
- koi, lilies, and leaves sitting in or on water rather than floating over a flat layer
- lighting effects appearing where the scene gives them a reason to exist

## Priority 1. Cloud Reflection

Current risk:

- Cloud reflection can read as pale mist or diffuse fog rather than reflected sky.
- Soft screen-blended patches may lack cloud body, edge hierarchy, and surface distortion.
- Too many low-contrast sprites can make the whole pond look washed rather than mirrored.

Expected effect:

- Fewer, clearer reflected cloud bodies with soft but legible silhouettes.
- Flattened shapes that feel compressed by the water plane.
- Subtle broken edges and internal holes so clouds have mass instead of uniform haze.
- Slow drift with slight water shear, so the reflection belongs to the surface.

Implementation direction:

- Rework baked cloud reflection variants toward puff clusters with stronger alpha contrast.
- Add subtle luminance shaping inside the texture instead of relying only on flat white alpha.
- Reduce fog-like accumulation by tightening active counts and alpha ceilings.
- Add small wave-driven skew or stretch on cloud sprites where Pixi supports it.
- Keep texture and sprite counts inside the current hybrid budget.

Acceptance checks:

- In cloudy daylight, reflection reads as sky/cloud reflection before it reads as mist.
- In clear daylight, reflection stays restrained and does not bleach the pond.
- Cloud layer remains visually useful with the existing `cloudReflectionEnabled` debug toggle.

## Priority 2. Yoonseul Integration

Current risk:

- Yoonseul itself is attractive, but long-running interference can produce beat patterns.
- If it is too independent from water direction, depth, and reflected sky, it can read as a decorative overlay.

Expected effect:

- Glints keep the current attractive identity.
- Long-running time phases avoid obvious beat loops.
- Glints feel modulated by wave direction, sun angle, and surface visibility.

Implementation direction:

- Preserve the current yoonseul core as the baseline.
- Stabilize temporal domains before changing visual style.
- Prefer phase decorrelation, beat damping, and slow drift normalization over replacing the shader.
- Only replace the core if a side-by-side capture is clearly better.

Acceptance checks:

- Ten-minute runtime does not develop obvious repetitive beating.
- The effect still looks like the current yoonseul, just calmer and better attached to the water.

## Priority 3. Depth And Water Body

Current risk:

- Benthic and caustic layers can still read as independent filters if depth cues are too uniform.
- The pond can feel flat when bottom visibility, edge darkness, and object shadows are not coordinated.

Expected effect:

- A shallow pond with visible bottom detail, not just a tinted plane.
- Edges and covered regions feel deeper.
- Koi and decor shadows sit in the same depth language as benthic detail.

Implementation direction:

- Strengthen depth-gradient and edge attenuation where it supports composition.
- Couple benthic visibility, cloud reflection, and caustic strength through the existing frame contract.
- Keep bottom detail selective under high reflection or low transmittance.

Acceptance checks:

- The pond has a readable surface and readable shallow bottom without either layer dominating.
- Benthic texture remains visible only where the water conditions make sense.

## Priority 4. Contact Detail

Current risk:

- Lilies, leaves, petals, and koi may look placed over the pond if contact shadows and ripples are too generic.

Expected effect:

- Small local cues around objects: contact darkening, tiny ripple response, and slight wet-edge highlights.
- The cues should be quiet; they should sell integration rather than draw attention.

Implementation direction:

- Use existing koi and decor positions to drive small local water responses.
- Prefer shared low-resolution masks or already available spatial grids over per-object expensive passes.
- Avoid new always-on full-screen passes unless they replace more expensive work.

Acceptance checks:

- Static screenshots show objects attached to the water plane.
- Motion remains calm and does not add noisy local shimmer.

## Priority 5. Selective Light Effects

Current risk:

- Caustics, god rays, and highlights can look like global filters if they are too evenly distributed.

Expected effect:

- Caustics gather in brighter, shallower, clearer regions.
- God rays appear as atmospheric water-light accents, not a constant overlay.
- Highlights reinforce the same sun and water direction as yoonseul.

Implementation direction:

- Use water clarity, daylight, cloud cover, depth, and occlusion signals to gate intensity.
- Consolidate shared lighting signals rather than adding independent per-effect heuristics.
- Keep expensive effects enabled, but make their visible contribution more selective.

Acceptance checks:

- Turning an effect on makes the pond richer, not busier.
- Effects remain coherent across clear/cloudy, noon/sunset, and high/low activity scenes.

## Work Order

1. Cloud reflection visual pass.
2. Yoonseul long-run stability and attachment pass.
3. Depth/body coordination pass.
4. Contact detail pass.
5. Selective lighting pass.
6. Final capture-based QA across clear/cloudy, noon/sunset, and long-run scenes.

## Non-Goals

- Do not introduce automatic performance-based quality transitions for the pond; the explicit user presets are owned by the render worker spec.
- Do not hide expensive effects behind automatic low-end fallbacks.
- Do not replace yoonseul casually; preserve the current effect unless the replacement is clearly better.
- Do not add broad cross-theme fallback paths.
