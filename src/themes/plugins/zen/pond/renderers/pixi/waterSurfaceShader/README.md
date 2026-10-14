# Water Surface Shader Sections

This folder owns the GLSL sections for the Pixi water surface filter.

`pixiWaterSurfaceShaderSource.js` is the public assembly seam. Keep imports
there narrow and keep visual math in the section that owns it.

| Section | Owns | Must Not Own |
| --- | --- | --- |
| `pixiWaterSurfaceBaseShader.js` | uniforms, explicit surface optics gates, shared water-domain helpers, `waterHeight()` screen-refraction basis | yoonseul algorithms, final color composition |
| `pixiWaterYoonseulOnlyBaseShader.js` | minimal uniforms for explicit Pond Lab comparison modes, including low-cost sheen/gold-lift inputs | `waterHeight()`, screen-refraction uniforms, surface-reflection uniforms |
| `pixiWaterSurfaceOpticsShader.js` | Fresnel and GGX helpers after a normal is selected | texture sampling, algorithm routing |
| `pixiWaterScreenRefractionShader.js` | screen texture sampling, RGB split, screen refraction, surface reflection mix | surface normal generation, yoonseul masks, yoonseul algorithm routing |
| `pixiWaterSurfaceSheenShader.js` | surface sheen and gold-lift composition | screen texture sampling, yoonseul composition |
| `pixiWaterYoonseulShader.js` | `ys_*` height/normal helpers, reflection algorithm height models, and analytic stochastic slope spectra | `texture2D`, `gl_FragColor`, screen-space composition |
| `pixiWaterYoonseulCompositionShader.js` | yoonseul specular, per-mode visibility ownership, glint events, and final highlight compression | `texture2D`, screen refraction, new height models |
| `pixiWaterSurfaceMainShader.js` | fragment `main`, frame-space setup, surface normal preparation, composition orchestration | texture sampling, final yoonseul math, defining new height models |
| `pixiWaterYoonseulOnlyMainShader.js` | single base sample, low-cost surface sheen/gold-lift, plus explicitly selected yoonseul comparison composition | screen refraction, surface reflection |

`surface_field` is the canonical runtime algorithm. Its dedicated assembly is
owned by `../waterSurfaceField/` and samples one shared slope/height/curvature
texture. It does not assemble any `ys_*` height model, advected patch mask, or
comparison glint lattice. `yoonseul_only` and `optics_experimental` remain
pipeline choices for explicitly selected Pond Lab algorithms.

`surfaceOpticsEnabled` is the current author/debug gate for the combined surface
optics feature. The full optics shader uses explicit internal gates:
`uSurfaceNormalEnabled`,
`uScreenRefractionEnabled`, and `uSurfaceReflectionEnabled`.

When adding a comparison algorithm, add the height/normal helper in
`pixiWaterYoonseulShader.js` first, then route it from
`pixiWaterYoonseulCompositionShader.js`. Keep `main` as orchestration unless
the frame-space setup itself changes.

`stochastic_slope_spectrum` is the independent analytic-slope experiment. Its
six capillary-gravity wave bands turn over one at a time and derive the normal
without finite-difference height samples. For this mode, normal/GGX alignment
owns visible glint positions. The composition path must keep the advected
`patchMask`, advected flicker, and world-pixel glint lattice disabled for this
mode so a shared texture field cannot reintroduce one-direction drift. The
spectrum reference axis comes from the canonical atmosphere `windDirection`;
`sunAngle` remains a lighting-only input.

Do not add another default surface generator here. Default surface geometry,
interaction disturbances, and caustic focus belong to the named
`waterSurfaceField` seam.
