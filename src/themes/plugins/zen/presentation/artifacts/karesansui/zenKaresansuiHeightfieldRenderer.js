import { requireZenKaresansuiHeightfieldRequest } from './zenKaresansuiHeightfieldContract.js';
import { Geometry, Mesh, Shader } from '../../../runtime/worker/zenPixiWorkerRuntime.js';

// Raked sand as a lit heightfield, rendered once per request in the artifact
// worker. Rake marks are not drawn as lines: a ridge/furrow height profile is
// laid out in ground-plane world space (parallel strokes + concentric rings
// around the artifact), its gradient becomes a normal, and the ambient sun
// lights it. Perspective, ring foreshortening and far-field softening all fall
// out of the one pinhole camera the stage declares.
//
// The shader works in "rake units" (one raking period = RAKE_UNIT_PERIOD) so
// every noise frequency below is relative to the tine spacing, not the screen.
const RAKE_UNIT_PERIOD = 0.32;
// Sub-pixel samples per device pixel. The frame is rendered once per request,
// not per animation frame, so it can afford to resolve every edge; displays at
// 1.5x and denser already sample twice as finely and take half as many.
const DENSE_PIXEL_RATIO = 1.5;
const SAMPLE_COUNT = 8;
const DENSE_SAMPLE_COUNT = 4;

const VERTEX_SHADER = `#version 300 es
in vec2 aVertexPosition;
void main() { gl_Position = vec4(aVertexPosition, 0.0, 1.0); }`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uCanvasPx;
uniform float uPixelRatio;
uniform float uHorizonPx;
uniform float uFocalPx;
uniform float uEyeHeight;
uniform float uCenterX;
uniform float uUnit;
uniform float uInnerR;
uniform float uRingCount;
uniform float uRidge;
uniform vec3 uSunDir;
uniform vec3 uSun, uShadeAmbient, uBounce, uHorizon, uSandRear, uSandBase, uSandFront;

const float PERIOD = ${RAKE_UNIT_PERIOD.toFixed(2)};
const float TAU = 6.28318531;
// Rotated-grid sub-pixel offsets (the standard 8x / 4x MSAA patterns, in
// device pixels). Dense displays already halve the pixel, so they take four.
uniform int uSampleCount;
const vec2 SUBPIXEL8[8] = vec2[8](
  vec2(0.0625, -0.1875), vec2(-0.0625, 0.1875), vec2(0.3125, 0.0625), vec2(-0.1875, -0.3125),
  vec2(-0.3125, 0.3125), vec2(-0.4375, -0.0625), vec2(0.1875, 0.4375), vec2(0.4375, -0.4375));
const vec2 SUBPIXEL4[4] = vec2[4](
  vec2(-0.125, -0.375), vec2(0.375, -0.125), vec2(-0.375, 0.125), vec2(0.125, 0.375));
const int SHADOW_TAPS = 6;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// One rake period: 0 in the furrow (integer t), 1 on the crest (t + 0.5).
// Both are rounded (a tine ploughs a trough, it does not cut a crease), so the
// surface turns smoothly from the flank that faces the sun to the one that
// does not. The warp leans the crest so one flank is a little steeper, as sand
// pushed by a pulled rake settles.
float rakeProfile(float t) {
  float p = fract(t);
  float c = 0.5 - 0.5 * cos(TAU * (p + 0.09 * sin(TAU * p)));
  return c * (1.2 - 0.2 * c);
}

vec2 centre() { return vec2(0.0, uUnit); }
float ringR(vec2 w) {
  vec2 d = w - centre();
  float a = atan(d.y, d.x);
  return length(d) + PERIOD * (0.05 * sin(a * 3.0 + 1.7) + 0.035 * sin(a * 5.0 + 0.4));
}
float lineT(vec2 w) {
  // A hand-pulled rake drifts: a slow sway per pass plus a little tremor,
  // continuous in depth so neighbouring strokes never tear apart.
  float pass = w.y / (PERIOD * 6.0);
  float wob = 0.22 * sin(w.x * 0.9 + pass * 1.7) + 0.08 * sin(w.x * 2.6 + 2.1 + pass)
    + 0.30 * (vnoise(vec2(w.x * 0.8, pass)) - 0.5);
  return w.y / PERIOD + wob;
}
float outerR() { return uInnerR + PERIOD * uRingCount; }
// The last ring's crest eases into the strokes over a third of a period; a
// narrower seam is a step too steep to light without a sparkling edge.
float ringWeight(float rr) { return 1.0 - smoothstep(outerR() - 0.1 * PERIOD, outerR() + 0.3 * PERIOD, rr); }

float heightAt(vec2 w, float fadeLine, float fadeRing) {
  float rr = ringR(w);
  float tL = lineT(w);
  float tR = (rr - uInnerR) / PERIOD;
  float strokeVar = 0.82 + 0.18 * vnoise(vec2(w.x * 0.45, floor(tL) * 7.1));
  float hL = rakeProfile(tL) * strokeVar * fadeLine;
  // Rings end on a crest so the strokes butt against a ridge, not a furrow.
  float hR = rakeProfile(min(tR, uRingCount - 0.5)) * fadeRing;
  // The artifact sits on an unraked bed.
  float bed = smoothstep(uInnerR - 0.6 * PERIOD, uInnerR, length(w - centre()));
  float h = mix(hL, hR, uRingCount > 0.0 ? ringWeight(rr) : 0.0) * bed;
  float swell = (vnoise(w * 0.7) - 0.5) * 0.25;
  return (h + swell) * uRidge * PERIOD;
}

// Soft self-shadow: march toward the sun across the ground and ask whether a
// nearer crest rises above the ray. Only a low sun finds any; a high one
// clears every ridge, as on real raked sand.
float sunVisibility(vec2 w, float h0, float fadeL, float fadeR, vec3 L, float jitter) {
  float run = length(L.xz);
  if (run < 1e-3) return 1.0;
  vec2 dir = L.xz / run;
  float rise = L.y / run;
  float soft = 0.12 * uRidge * PERIOD;
  float occlusion = 0.0;
  for (int k = 1; k <= SHADOW_TAPS; k++) {
    float d = PERIOD * 0.1 * (float(k) - jitter);
    float above = heightAt(w + dir * d, fadeL, fadeR) - (h0 + d * rise);
    occlusion = max(occlusion, smoothstep(0.0, soft, above));
  }
  return 1.0 - occlusion;
}

vec2 groundAt(vec2 s) {
  float drop = max(s.y - uHorizonPx, 0.001);
  float z = uFocalPx * uEyeHeight / drop;
  return vec2((s.x - uCenterX) * z / uFocalPx, z) * uUnit;
}

vec3 shadeSample(vec2 s, float fadeL, float fadeR, float fade, float foot, float depthT, float jitter) {
  vec2 w = groundAt(s);
  vec3 L = normalize(uSunDir);

  float e = PERIOD * 0.035;
  float h0 = heightAt(w, fadeL, fadeR);
  float hx = heightAt(w + vec2(e, 0.0), fadeL, fadeR);
  float hz = heightAt(w + vec2(0.0, e), fadeL, fadeR);
  vec3 n = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e));
  float hn = h0 / max(uRidge * PERIOD, 1e-4);

  vec3 albedo = mix(uSandRear, uSandBase, smoothstep(0.0, 0.45, depthT));
  albedo = mix(albedo, uSandFront, smoothstep(0.45, 1.0, depthT));
  float grainFade = 1.0 - smoothstep(0.02, 0.09, foot * 0.25);
  float g = vnoise(w * 85.0) * 0.6 + vnoise(w * 210.0) * 0.4;
  albedo *= 1.0 + (g - 0.5) * 0.16 * grainFade;

  // Two faces, not lines: the flank turned to the sun takes its warm light,
  // the flank turned away (or a furrow a crest shadows) keeps only the cool
  // sky. Little wrap and a modest sky fill keep the faces apart.
  float wrap = 0.12;
  float sunVisible = sunVisibility(w, h0, fadeL, fadeR, L, jitter);
  float diff = clamp((dot(n, L) + wrap) / (1.0 + wrap), 0.0, 1.0) * sunVisible;
  vec3 amb = mix(uBounce, uShadeAmbient, n.y * 0.5 + 0.5);
  // A whisper of occlusion in the furrow floor; the faces carry the form.
  float ao = mix(0.93, 1.0, smoothstep(0.0, 0.6, hn * fade + (1.0 - fade) * 0.6));
  float contact = length((w - centre()) / vec2(1.0, 0.8));
  ao *= mix(0.72, 1.0, smoothstep(uInnerR * 0.35, uInnerR * 1.25, contact));

  // Normalised against an unraked bed: flat sand reads as the palette colour
  // and relief only moves light around it. Shade takes the sky's ambient tint,
  // lit flanks the sun's; that temperature split is most of the softness.
  float flatDiff = clamp((L.y + wrap) / (1.0 + wrap), 0.0, 1.0);
  vec3 flatLight = uSun * flatDiff * 0.80 + uShadeAmbient * 0.32;
  vec3 lightIn = uSun * diff * 0.80 + amb * 0.32;
  vec3 col = albedo * (lightIn / max(flatLight, vec3(0.05))) * ao;
  col = mix(col, col * (uShadeAmbient / max(dot(uShadeAmbient, vec3(0.333)), 0.05)), (1.0 - diff) * 0.28);

  // Sparse quartz glints on lit crests.
  vec3 V = normalize(vec3(0.0, uEyeHeight * uUnit, -w.y));
  float spec = pow(max(dot(reflect(-L, n), V), 0.0), 28.0);
  col += uSun * step(0.992, hash(floor(w * 160.0))) * spec * grainFade * smoothstep(0.55, 0.95, hn) * sunVisible * 0.6;

  // Atmospheric perspective toward the horizon.
  float fog = 1.0 - exp(-max(w.y - uUnit * 0.6, 0.0) * 0.045);
  return mix(col, uHorizon, clamp(fog, 0.0, 0.85));
}

void main() {
  vec2 s = vec2(gl_FragCoord.x, uCanvasPx.y - gl_FragCoord.y) / uPixelRatio;
  vec2 w = groundAt(s);

  // Fade relief before a period shrinks to a couple of pixels, per family, so
  // the far field softens instead of shimmering. Measured once per pixel; the
  // sub-pixel samples below resolve everything finer than that.
  float footL = fwidth(lineT(w));
  float footR = fwidth(ringR(w) / PERIOD);
  float fadeL = 1.0 - smoothstep(0.22, 0.6, footL);
  float fadeR = 1.0 - smoothstep(0.22, 0.6, footR);
  float rw = uRingCount > 0.0 ? ringWeight(ringR(w)) : 0.0;
  float fade = mix(fadeL, fadeR, rw);
  float foot = mix(footL, footR, rw);

  float canvasH = uCanvasPx.y / uPixelRatio;
  vec3 col = vec3(0.0);
  for (int i = 0; i < uSampleCount; i++) {
    vec2 ss = s + (uSampleCount == 8 ? SUBPIXEL8[i] : SUBPIXEL4[i]) / uPixelRatio;
    float depthT = clamp((ss.y - uHorizonPx) / max(canvasH - uHorizonPx, 1.0), 0.0, 1.0);
    // Each sub-sample marches from a different start so the shadow edge is
    // resolved, not stepped at the tap spacing.
    col += shadeSample(ss, fadeL, fadeR, fade, foot, depthT, (float(i) + 0.5) / float(uSampleCount));
  }
  col /= float(uSampleCount);

  // Triangular dither of one 8-bit step: the sand's long, gentle gradients
  // otherwise quantise into visible bands.
  vec3 encoded = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
  float dither = (hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 19.19) - 1.0) / 255.0;
  outColor = vec4(encoded + dither, 1.0);
}`;

// Borrow the gallery renderer. Only this mesh/shader belongs to the ground;
// the engine retains sole ownership of its canvas and WebGL context.
export function createZenKaresansuiHeightfieldRenderer({ renderer }) {
  if (!renderer) throw new Error('ZEN_KARESANSUI_ARTIFACT_RENDERER_REQUIRED');
  if (renderer.context.webGLVersion !== 2) throw new Error('ZEN_KARESANSUI_HEIGHTFIELD_WEBGL2_UNAVAILABLE');
  const canvas = renderer.view;
  if (typeof canvas.transferToImageBitmap !== 'function') throw new Error('ZEN_KARESANSUI_BITMAP_TRANSFER_REQUIRED');
  const shader = Shader.from(VERTEX_SHADER, FRAGMENT_SHADER, {
    uCanvasPx: new Float32Array(2), uPixelRatio: 1, uSampleCount: SAMPLE_COUNT,
    uHorizonPx: 0, uFocalPx: 1, uEyeHeight: 1, uCenterX: 0,
    uUnit: 1, uInnerR: 1, uRingCount: 0, uRidge: 0,
    uSunDir: new Float32Array(3), uSun: new Float32Array(3),
    uShadeAmbient: new Float32Array(3), uBounce: new Float32Array(3),
    uHorizon: new Float32Array(3), uSandRear: new Float32Array(3),
    uSandBase: new Float32Array(3), uSandFront: new Float32Array(3),
  });
  const geometry = new Geometry().addAttribute('aVertexPosition', new Float32Array([-1, -1, 3, -1, -1, 3]), 2).addIndex([0, 1, 2]);
  const mesh = new Mesh(geometry, shader);
  mesh.state.blend = false;
  let disposed = false;
  let renderCount = 0;
  let frameWidth = 0, frameHeight = 0;

  return {
    render(request) {
      if (disposed) throw new Error('ZEN_KARESANSUI_HEIGHTFIELD_RENDERER_DISPOSED');
      if (renderer.gl.isContextLost()) throw new Error('ZEN_KARESANSUI_HEIGHTFIELD_CONTEXT_LOST');
      const { width, height, pixelRatio, camera, field, light, colors } = requireZenKaresansuiHeightfieldRequest(request);
      const unit = RAKE_UNIT_PERIOD / field.spacing;
      const uniforms = shader.uniforms;
      uniforms.uCanvasPx.set([width, height]);
      Object.assign(uniforms, {
        uPixelRatio: pixelRatio, uSampleCount: pixelRatio >= DENSE_PIXEL_RATIO ? DENSE_SAMPLE_COUNT : SAMPLE_COUNT,
        uHorizonPx: camera.horizonPx, uFocalPx: camera.focalPx, uEyeHeight: camera.eyeHeight, uCenterX: camera.centerX,
        uUnit: unit, uInnerR: field.innerRadius * unit, uRingCount: field.ringCount, uRidge: field.ridge,
      });
      uniforms.uSunDir.set(light.direction);
      uniforms.uSun.set(colors.sun);
      uniforms.uShadeAmbient.set(colors.shadeAmbient);
      uniforms.uBounce.set(colors.bounce);
      uniforms.uHorizon.set(colors.horizon);
      uniforms.uSandRear.set(colors.sandRear);
      uniforms.uSandBase.set(colors.sandBase);
      uniforms.uSandFront.set(colors.sandFront);
      const previousWidth = renderer.screen.width, previousHeight = renderer.screen.height;
      try {
        // Synchronous draw/transfer: channel messages cannot interleave here.
        // Existing UI bitmaps stay displayed while the shared backbuffer is used.
        renderer.resize(width / renderer.resolution, height / renderer.resolution);
        renderer.render(mesh);
        const bitmap = canvas.transferToImageBitmap();
        renderCount += 1;
        frameWidth = width; frameHeight = height;
        return bitmap;
      } finally {
        renderer.resize(previousWidth, previousHeight);
      }
    },
    snapshot() {
      return { renderCount, width: frameWidth, height: frameHeight, contextLost: renderer.gl.isContextLost(), disposed };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.destroy();
      geometry.destroy();
      shader.destroy();
    },
  };
}
