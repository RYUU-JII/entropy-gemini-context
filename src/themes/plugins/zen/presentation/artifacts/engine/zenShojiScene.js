import { Container, Geometry, Mesh, Shader, Sprite } from '../../../runtime/worker/zenPixiWorkerRuntime.js';
import {
  CUBE_ROTATION, FACE_EDGE_OVERLAP_PX, CUBE_SIZE, FRAME_THICKNESS,
  buildZenShojiPalette, buildFaceMaterials, buildFrameBarBackground,
  buildFrameBarShadow, buildKumikoBackground, buildKumikoShadow,
  buildFaceFinishBackground, getFaceFinishOpacity, withAlpha,
} from '../shoji/zenShojiRecipe.js';
import { createZenRaster, paintZenBackground, paintZenBoxShadows } from './zenMaterialRaster.js';
import { zenEaseInOut } from './zenArtifactTiming.js';
import { resolveZenPixiOwnedShaderSources } from '../../../runtime/pixi/zenPixiOwnedShaderDialect.js';

const FACE_SIZE = CUBE_SIZE + FACE_EDGE_OVERLAP_PX * 2;
const CAMERA_DISTANCE = 1200;
const FLOAT_KEYS = [0, -5, -1.5, 3.5, -3, 1.75, 4.25, -2.25, 0];
const SHADOW_ALPHA_KEYS = [0.58, 0.5, 0.62, 0.53, 0.6, 0.56, 0.58];
const SHADOW_SCALE_KEYS = [1, 0.94, 1.05, 0.97, 1.03, 0.99, 1];

function sampleKeys(keys, timeMs) {
  const position = ((timeMs % 15000) / 15000) * (keys.length - 1);
  const index = Math.floor(position);
  const weight = zenEaseInOut(position - index);
  return keys[index] + (keys[index + 1] - keys[index]) * weight;
}

export function rotateZenShojiPoint([x, y, z]) {
  const rx = CUBE_ROTATION.x * Math.PI / 180;
  const ry = CUBE_ROTATION.y * Math.PI / 180;
  const rotatedX = Math.cos(ry) * x + Math.sin(ry) * z;
  const rotatedZ = -Math.sin(ry) * x + Math.cos(ry) * z;
  return [rotatedX, Math.cos(rx) * y - Math.sin(rx) * rotatedZ, Math.sin(rx) * y + Math.cos(rx) * rotatedZ];
}

export function projectZenShojiPoint(point, floatY) {
  const [x, y, z] = rotateZenShojiPoint(point);
  const q = 1 / (1 - z / CAMERA_DISTANCE);
  return [x * q, (y - 20 + floatY) * q, q];
}

function bakeFace(faceType, nightDepth, resolution) {
  const palette = buildZenShojiPalette(nightDepth);
  const material = buildFaceMaterials({ palette, nightDepth })[faceType];
  const paperSize = FACE_SIZE - FRAME_THICKNESS * 2;
  return createZenRaster(FACE_SIZE, FACE_SIZE, resolution, (context) => {
    paintZenBackground(context, material.paper, 8, 8, paperSize, paperSize);
    paintZenBoxShadows(context, `inset 0 0 22px ${withAlpha(palette.woodShadow, 0.34)}, inset 0 0 0 1px ${withAlpha(palette.woodShadow, 0.28)}`, 8, 8, paperSize, paperSize, resolution);
    paintZenBackground(context, material.paperShade, 8, 8, paperSize, paperSize);
    context.save();
    context.beginPath();
    context.rect(8, 8, paperSize, paperSize);
    context.clip();
    for (const [id, x, y, width, height] of [
      ['v1', 8 + paperSize * 0.3333, 8, 4, paperSize],
      ['v2', 8 + paperSize * 0.6666, 8, 4, paperSize],
      ['h1', 8, 8 + paperSize * 0.3333, paperSize, 4],
      ['h2', 8, 8 + paperSize * 0.6666, paperSize, 4],
    ]) {
      paintZenBoxShadows(context, buildKumikoShadow(palette, faceType), x, y, width, height, resolution);
      paintZenBackground(context, buildKumikoBackground(id, palette, material.woodBase, faceType), x, y, width, height);
    }
    context.restore();
    const finish = createZenRaster(FACE_SIZE, FACE_SIZE, resolution, (target) => {
      paintZenBackground(target, buildFaceFinishBackground(faceType, palette), 0, 0, FACE_SIZE, FACE_SIZE);
    });
    for (const [operation, weight] of [['soft-light', 1 - nightDepth], ['screen', nightDepth]]) {
      context.save();
      context.globalCompositeOperation = operation;
      context.globalAlpha = getFaceFinishOpacity(faceType, nightDepth) * weight;
      context.drawImage(finish, 0, 0, FACE_SIZE, FACE_SIZE);
      context.restore();
    }
    for (const [id, x, y, width, height] of [
      ['top', 0, 0, FACE_SIZE, 8], ['bottom', 0, FACE_SIZE - 8, FACE_SIZE, 8],
      ['left', 0, 0, 8, FACE_SIZE], ['right', FACE_SIZE - 8, 0, 8, FACE_SIZE],
    ]) {
      paintZenBackground(context, buildFrameBarBackground(id, palette, material.woodBase, faceType), x, y, width, height);
      paintZenBoxShadows(context, buildFrameBarShadow(id, palette, faceType), x, y, width, height, resolution);
    }
  });
}

const VERTEX = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec3 aProjectiveUV;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
uniform float uFloat;
varying vec3 vProjectiveUV;
void main() {
  vec2 vertex = aVertexPosition + vec2(0.0, uFloat * aProjectiveUV.z);
  vec3 p = projectionMatrix * translationMatrix * vec3(vertex, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
  vProjectiveUV = aProjectiveUV;
}`;
const FRAGMENT = `
precision highp float;
varying vec3 vProjectiveUV;
uniform sampler2D uSampler;
void main() { gl_FragColor = texture2D(uSampler, vProjectiveUV.xy / vProjectiveUV.z); }
`;

export function createZenShojiScene({ assets, nightDepth, resolution, webGLVersion }) {
  const shaderSources = resolveZenPixiOwnedShaderSources({ programId: 'shoji', webGLVersion, vertexSrc: VERTEX, fragmentSrc: FRAGMENT });
  const root = new Container();
  const palette = buildZenShojiPalette(nightDepth);
  const shadowTexture = assets.texture(createZenRaster(340, 140, resolution, (context) => {
    context.filter = `blur(${15 * resolution}px)`;
    paintZenBackground(context, `radial-gradient(ellipse at center, ${withAlpha(palette.woodShadow, 0.42)} 0%, rgba(0,0,0,0) 70%)`, 60, 50, 220, 40);
  }));
  const shadow = new Sprite(shadowTexture);
  shadow.anchor.set(0.5);
  shadow.position.set(0, 120);
  root.addChild(shadow);
  const h = FACE_SIZE / 2;
  const z = CUBE_SIZE / 2;
  // These are the three front-facing planes under the canonical fixed camera.
  const definitions = [
    { type: 'front', corners: [[-h, -h, z], [h, -h, z], [h, h, z], [-h, h, z]] },
    { type: 'side', corners: [[z, -h, h], [z, -h, -h], [z, h, -h], [z, h, h]] },
    { type: 'bottom', corners: [[-h, z, h], [h, z, h], [h, z, -h], [-h, z, -h]] },
  ];
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const faces = definitions.map(({ type, corners }) => {
    const texture = assets.texture(bakeFace(type, nightDepth, resolution));
    const positions = new Float32Array(8);
    const uvs = new Float32Array(12);
    for (let i = 0; i < 4; i += 1) {
      const [x, y, q] = projectZenShojiPoint(corners[i], 0);
      positions[i * 2] = x;
      positions[i * 2 + 1] = y;
      uvs[i * 3] = uv[i][0] * q;
      uvs[i * 3 + 1] = uv[i][1] * q;
      uvs[i * 3 + 2] = q;
    }
    const geometry = new Geometry()
      .addAttribute('aVertexPosition', positions, 2)
      .addAttribute('aProjectiveUV', uvs, 3)
      .addIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new Mesh(geometry, Shader.from(shaderSources.vertex, shaderSources.fragment, { uSampler: texture, uFloat: 0 }));
    root.addChild(mesh);
    return mesh;
  });
  const shaders = faces.map((face) => face.shader);
  return {
    root,
    update(timeMs) {
      const floatY = sampleKeys(FLOAT_KEYS, timeMs);
      shadow.alpha = sampleKeys(SHADOW_ALPHA_KEYS, timeMs);
      shadow.scale.x = sampleKeys(SHADOW_SCALE_KEYS, timeMs);
      for (const face of faces) {
        face.shader.uniforms.uFloat = floatY;
      }
    },
    geometry: { meshes: 3, sprites: 1, triangles: 6 },
    dispose() { shaders.forEach((shader) => shader.destroy()); },
  };
}
