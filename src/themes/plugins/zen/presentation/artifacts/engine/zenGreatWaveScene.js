import { Container, Filter, Rectangle, Sprite, Texture } from '../../../runtime/worker/zenPixiWorkerRuntime.js';
import { ZEN_ARTIFACT_SURFACE_POLICY } from '../zenArtifactSurfacePolicy.js';
import { createZenGreatWaveGrid, withAlpha } from './zenGreatWaveRecipe.js';
import { createZenRaster, paintZenBackground, paintZenBoxShadows } from './zenMaterialRaster.js';
import { zenEaseInOut } from './zenArtifactTiming.js';
import { resolveZenPixiOwnedShaderSources } from '../../../runtime/pixi/zenPixiOwnedShaderDialect.js';

const FRAGMENT = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uMaterial;
uniform sampler2D uShade;
uniform vec4 inputSize;
uniform vec4 outputFrame;
uniform float uMaterialOpacity;
vec3 softLight(vec3 b, vec3 s) {
  vec3 d = mix(((16.0*b-12.0)*b+4.0)*b, sqrt(b), step(vec3(0.25),b));
  return mix(b-(1.0-2.0*s)*b*(1.0-b), b+(2.0*s-1.0)*(d-b), step(vec3(0.5),s));
}
void main() {
  vec4 base = texture2D(uSampler, vTextureCoord);
  vec2 uv = vTextureCoord * inputSize.xy / outputFrame.zw;
  vec4 material = texture2D(uMaterial, uv);
  vec3 color = base.rgb / max(base.a, 0.00001);
  vec3 source = material.rgb / max(material.a, 0.00001);
  color = mix(color, softLight(color, source), material.a * uMaterialOpacity);
  color *= texture2D(uShade, uv).rgb;
  float screen = 0.08 * max(0.0, 1.0-uv.y*4.0);
  color = color + (1.0-color)*screen;
  gl_FragColor = vec4(color*base.a, base.a);
}`;

function bakeFrame(color, isActive, resolution, profile) {
  return createZenRaster(440, 370, resolution, (context) => {
    context.translate(220, 166);
    context.save();
    context.filter = `blur(${24 * resolution}px)`;
    context.fillStyle = 'rgba(2,6,23,0.4)';
    context.beginPath();
    context.roundRect(-138, 78, 276, 32, 16);
    context.fill();
    context.restore();
    const glow = isActive ? withAlpha(color, 0.14) : 'rgba(15,23,42,0.18)';
    paintZenBoxShadows(context, `0 26px 46px rgba(2,6,23,0.44), 0 8px 16px rgba(2,6,23,0.28), 0 0 22px ${glow}`, -166, -136, 332, 232, resolution);
    paintZenBackground(context, 'linear-gradient(145deg, #111827 0%, #05070c 48%, #020617 100%)', -166, -136, 332, 232);
    paintZenBoxShadows(context, 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.08)', -166, -136, 332, 232, resolution);
    paintZenBackground(context, '#fdfcf8', -160, -130, 320, 220);
    paintZenBackground(context, profile.backgroundStyle.backgroundImage, -160, -130, 320, 220);
    paintZenBoxShadows(context, `${profile.backgroundStyle.boxShadow}, inset 0 0 46px rgba(2,6,23,0.5)`, -160, -130, 320, 220, resolution);
    context.strokeStyle = 'rgba(255,255,255,0.07)';
    context.strokeRect(-163.5, -133.5, 327, 227);
    context.strokeStyle = 'rgba(2,6,23,0.9)';
    context.strokeRect(-159.5, -129.5, 319, 219);
  });
}

export function createZenGreatWaveScene({ assets, color, isActive, resolution, webGLVersion }) {
  const shaderSources = resolveZenPixiOwnedShaderSources({ programId: 'great_wave', webGLVersion, vertexSrc: null, defaultVertexSrc: Filter.defaultVertexSrc, fragmentSrc: FRAGMENT });
  const root = new Container();
  const profile = {
    backgroundStyle: ZEN_ARTIFACT_SURFACE_POLICY.buildBackgroundStyle({ signatureColor: color, isActive }),
    materialOverlayStyle: ZEN_ARTIFACT_SURFACE_POLICY.buildMaterialOverlayStyle({ isActive }),
  };
  const frame = new Sprite(assets.texture(bakeFrame(color, isActive, resolution, profile)));
  frame.position.set(-220, -166);
  root.addChild(frame);
  const grid = createZenGreatWaveGrid({ color, isActive });
  // A single atlas, with a two-pixel gutter around each row's semi-ellipse.
  const tileWidth = 80;
  const tileHeight = 30;
  const atlasResolution = Math.max(2, resolution);
  const atlas = assets.texture(createZenRaster(tileWidth * 5, tileHeight * 4, atlasResolution, (context) => {
    for (let row = 0; row < 20; row += 1) {
      const wave = grid[row * 7];
      context.save();
      context.translate((row % 5) * tileWidth + 40, Math.floor(row / 5) * tileHeight + 26);
      context.fillStyle = '#fdfcf8';
      context.beginPath();
      context.ellipse(0, 0, 37.7, 23.2, 0, Math.PI, Math.PI * 2);
      context.closePath();
      context.fill();
      context.lineCap = 'round';
      context.strokeStyle = wave.strokeColor;
      context.lineWidth = wave.strokeWidth;
      for (let ring = 0; ring < 4; ring += 1) {
        const factor = 1 - ring / 4;
        context.beginPath();
        context.ellipse(0, 0, 36 * factor, 22 * factor, 0, Math.PI, Math.PI * 2);
        context.stroke();
      }
      context.restore();
    }
  }), atlasResolution);
  const tileTextures = Array.from({ length: 20 }, (_, row) => new Texture(atlas.baseTexture,
    new Rectangle((row % 5) * tileWidth, Math.floor(row / 5) * tileHeight, tileWidth, tileHeight)));
  const content = new Container();
  const svgScale = 218 / 220;
  const insetX = -159 + (318 - 320 * svgScale) / 2;
  content.position.set(insetX, -129);
  content.scale.set(svgScale);
  const backdrop = new Sprite(assets.texture(createZenRaster(320, 220, resolution, (context) => {
    paintZenBackground(context, '#fdfcf8', 0, 0, 320, 220);
    paintZenBackground(context, profile.backgroundStyle.backgroundImage, 0, 0, 320, 220);
    paintZenBoxShadows(context, `${profile.backgroundStyle.boxShadow}, inset 0 0 46px rgba(2,6,23,0.5)`, 0, 0, 320, 220, resolution);
  })));
  content.addChild(backdrop);
  const waves = grid.map((wave, index) => {
    const sprite = new Sprite(tileTextures[Math.floor(index / 7)]);
    sprite.position.set(wave.x - 40, wave.y - 26);
    content.addChild(sprite);
    return { sprite, y: wave.y - 26, delayMs: wave.delay * 1000 };
  });
  const material = assets.texture(createZenRaster(320, 220, resolution, (context) => {
    paintZenBackground(context, profile.materialOverlayStyle.backgroundImage, 0, 0, 320, 220);
  }));
  const shade = assets.texture(createZenRaster(320, 220, resolution, (context) => {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 320, 220);
    context.globalCompositeOperation = 'multiply';
    paintZenBackground(context, 'linear-gradient(180deg, rgba(2,6,23,0.58) 0%, rgba(15,23,42,0.28) 42%, rgba(15,23,42,0.08) 100%)', 0, 0, 320, 220);
    paintZenBackground(context, 'radial-gradient(ellipse at 50% 72%, transparent 18%, rgba(2,6,23,0.26) 67%, rgba(2,6,23,0.62) 100%)', 0, 0, 320, 220);
  }));
  const filter = new Filter(shaderSources.vertex, shaderSources.fragment, {
    uMaterial: material, uShade: shade, uMaterialOpacity: profile.materialOverlayStyle.opacity,
  });
  filter.resolution = Math.max(2, resolution);
  filter.padding = 0;
  content.filters = [filter];
  content.filterArea = new Rectangle(0, 0, 320 * svgScale, 218);
  root.addChild(content);
  const duration = isActive ? 3600 : 6800;
  const distance = isActive ? 3 : 1.1;
  return {
    root,
    place(x, y) {
      content.filterArea.x = x + insetX;
      content.filterArea.y = y - 129;
    },
    update(timeMs) {
      for (const wave of waves) {
        const elapsed = Math.max(0, timeMs - wave.delayMs);
        const phase = (elapsed % duration) / duration;
        const progress = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
        wave.sprite.y = wave.y - zenEaseInOut(progress) * distance;
      }
    },
    dispose() {
      tileTextures.forEach((texture) => texture.destroy(false));
      filter.destroy();
    },
    geometry: { sprites: 142, atlasTiles: 20, atlasResolution, materialPasses: 1 },
  };
}
