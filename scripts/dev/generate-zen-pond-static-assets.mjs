#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { createCanvas } from '@napi-rs/canvas';
import {
  ZEN_POND_STATIC_BENTHIC_ASSET_FILES,
  ZEN_POND_STATIC_BENTHIC_ASSET_SCHEMA_VERSION,
  ZEN_POND_STATIC_BENTHIC_BUILD_ENGINE,
  ZEN_POND_STATIC_BENTHIC_CONTRACT_SIGNATURE,
  ZEN_POND_STATIC_BENTHIC_MATERIAL_ID,
  ZEN_POND_STATIC_BENTHIC_MATERIAL_PROFILE,
  ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES,
  ZEN_POND_STATIC_BENTHIC_RUNTIME_CHANNEL_COUNT,
  ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING,
  ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT,
  ZEN_POND_STATIC_BENTHIC_STYLES,
  ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
} from '../../src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/zenPondStaticBenthicAssetContract.js';

const ROOT_DIR = process.cwd();
const GENERATED_DIR = path.resolve(
  ROOT_DIR,
  'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/assets/generated',
);
const GENERATOR_SOURCE_PATHS = Object.freeze([
  'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/zenPondBenthicMaterial.js',
  'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/textureBake/canvas2d.js',
  'src/themes/plugins/zen/shared/zenSeededRandom.js',
  'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/zenPondStaticBenthicAssetContract.js',
]);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const assertRepositoryRoot = async () => {
  const packagePath = path.join(ROOT_DIR, 'package.json');
  const packageSource = await fs.readFile(packagePath, 'utf8');
  const packageJson = JSON.parse(packageSource);
  if (packageJson?.name !== 'entropy-starter') {
    throw new Error(`ZEN_POND_STATIC_ASSET_REPOSITORY_ROOT_INVALID:${ROOT_DIR}`);
  }
};

const readGeneratorSourceDigest = async () => {
  const sourceParts = [];
  for (const relativePath of GENERATOR_SOURCE_PATHS) {
    const absolutePath = path.resolve(ROOT_DIR, relativePath);
    sourceParts.push(relativePath, await fs.readFile(absolutePath));
  }
  return sha256(Buffer.concat(sourceParts.map((part) => Buffer.from(part))));
};

const writeFileIfChanged = async (targetPath, content) => {
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const current = await fs.readFile(targetPath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (current && current.equals(next)) return false;
  const tempPath = `${targetPath}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, next);
  await fs.rename(tempPath, targetPath);
  return true;
};

const pruneUnexpectedGeneratedFiles = async (expectedNames) => {
  const entries = await fs.readdir(GENERATED_DIR, { withFileTypes: true });
  const removed = [];
  for (const entry of entries) {
    if (expectedNames.has(entry.name)) continue;
    if (!entry.isFile()) {
      throw new Error(`ZEN_POND_STATIC_ASSET_GENERATED_ENTRY_INVALID:${entry.name}`);
    }
    await fs.unlink(path.join(GENERATED_DIR, entry.name));
    removed.push(entry.name);
  }
  return removed;
};

const installBuildCanvas = () => {
  globalThis.OffscreenCanvas = class ZenPondBuildOffscreenCanvas {
    constructor(width, height) {
      return createCanvas(width, height);
    }
  };
};

const encodeTexture = async (generateTexture, style) => {
  const canvas = generateTexture(ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE, { style });
  if (!canvas || typeof canvas.encode !== 'function') {
    throw new Error(`ZEN_POND_STATIC_ASSET_CANVAS_INVALID:${style}`);
  }
  const encoded = await canvas.encode('png');
  if (!encoded || encoded.byteLength <= 0) {
    throw new Error(`ZEN_POND_STATIC_ASSET_ENCODE_EMPTY:${style}`);
  }
  const context = canvas.getContext('2d');
  if (!context || typeof context.getImageData !== 'function') {
    throw new Error(`ZEN_POND_STATIC_ASSET_CONTEXT_INVALID:${style}`);
  }
  const imageData = context.getImageData(
    0,
    0,
    ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
    ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
  );
  const rgba = Buffer.from(imageData.data);
  const expectedRgbaBytes = (
    ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE
    * ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE
    * ZEN_POND_STATIC_BENTHIC_RUNTIME_CHANNEL_COUNT
  );
  if (rgba.byteLength !== expectedRgbaBytes) {
    throw new Error(`ZEN_POND_STATIC_ASSET_RGBA_LENGTH_INVALID:${style}`);
  }
  const runtime = zlib.gzipSync(rgba, { level: 9 });
  return Object.freeze({
    png: Buffer.from(encoded),
    rgba,
    runtime,
  });
};

const main = async () => {
  await assertRepositoryRoot();
  installBuildCanvas();
  const { createBenthicMaterialTextureGenerator } = await import(
    '../../src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/zenPondBenthicMaterial.js'
  );
  const generateTexture = createBenthicMaterialTextureGenerator({
    descriptor: { id: ZEN_POND_STATIC_BENTHIC_MATERIAL_ID },
    profile: ZEN_POND_STATIC_BENTHIC_MATERIAL_PROFILE,
  });
  const [primary, detail, sourceDigest] = await Promise.all([
    encodeTexture(generateTexture, ZEN_POND_STATIC_BENTHIC_STYLES.PRIMARY),
    encodeTexture(generateTexture, ZEN_POND_STATIC_BENTHIC_STYLES.DETAIL),
    readGeneratorSourceDigest(),
  ]);
  const assets = Object.freeze({
    [ZEN_POND_STATIC_BENTHIC_STYLES.PRIMARY]: Object.freeze({
      file: ZEN_POND_STATIC_BENTHIC_ASSET_FILES.primary,
      bytes: primary.png.byteLength,
      sha256: sha256(primary.png),
      runtimeFile: ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES.primary,
      runtimeBytes: primary.runtime.byteLength,
      runtimeSha256: sha256(primary.runtime),
      runtimeDecodedBytes: primary.rgba.byteLength,
      runtimeDecodedSha256: sha256(primary.rgba),
      runtimePixelFormat: ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT,
      runtimeEncoding: ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING,
    }),
    [ZEN_POND_STATIC_BENTHIC_STYLES.DETAIL]: Object.freeze({
      file: ZEN_POND_STATIC_BENTHIC_ASSET_FILES.detail,
      bytes: detail.png.byteLength,
      sha256: sha256(detail.png),
      runtimeFile: ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES.detail,
      runtimeBytes: detail.runtime.byteLength,
      runtimeSha256: sha256(detail.runtime),
      runtimeDecodedBytes: detail.rgba.byteLength,
      runtimeDecodedSha256: sha256(detail.rgba),
      runtimePixelFormat: ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT,
      runtimeEncoding: ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING,
    }),
  });
  const manifest = Object.freeze({
    schemaVersion: ZEN_POND_STATIC_BENTHIC_ASSET_SCHEMA_VERSION,
    contractSignature: ZEN_POND_STATIC_BENTHIC_CONTRACT_SIGNATURE,
    materialId: ZEN_POND_STATIC_BENTHIC_MATERIAL_ID,
    textureSize: ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
    buildEngine: ZEN_POND_STATIC_BENTHIC_BUILD_ENGINE,
    sourceDigest,
    assets,
  });
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  const writes = await Promise.all([
    writeFileIfChanged(
      path.join(GENERATED_DIR, ZEN_POND_STATIC_BENTHIC_ASSET_FILES.primary),
      primary.png,
    ),
    writeFileIfChanged(
      path.join(GENERATED_DIR, ZEN_POND_STATIC_BENTHIC_ASSET_FILES.detail),
      detail.png,
    ),
    writeFileIfChanged(
      path.join(GENERATED_DIR, ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES.primary),
      primary.runtime,
    ),
    writeFileIfChanged(
      path.join(GENERATED_DIR, ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES.detail),
      detail.runtime,
    ),
    writeFileIfChanged(
      path.join(GENERATED_DIR, ZEN_POND_STATIC_BENTHIC_ASSET_FILES.manifest),
      `${JSON.stringify(manifest, null, 2)}\n`,
    ),
  ]);
  const expectedNames = new Set([
    ...Object.values(ZEN_POND_STATIC_BENTHIC_ASSET_FILES),
    ...Object.values(ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES),
  ]);
  const removed = await pruneUnexpectedGeneratedFiles(expectedNames);
  console.log(JSON.stringify({
    event: 'ZEN_POND_STATIC_ASSETS_GENERATED',
    changedFileCount: writes.filter(Boolean).length,
    removedFiles: removed,
    textureSize: ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
    totalPngBytes: primary.png.byteLength + detail.png.byteLength,
    totalRuntimeBytes: primary.runtime.byteLength + detail.runtime.byteLength,
    totalDecodedBytes: primary.rgba.byteLength + detail.rgba.byteLength,
    sourceDigest,
  }));
};

main().catch((error) => {
  console.error(`[zen-pond-static-assets] ${error?.stack || error}`);
  process.exit(1);
});
