#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  ZEN_POND_STATIC_BENTHIC_ASSET_FILES,
  ZEN_POND_STATIC_BENTHIC_ASSET_SCHEMA_VERSION,
  ZEN_POND_STATIC_BENTHIC_BUILD_ENGINE,
  ZEN_POND_STATIC_BENTHIC_CONTRACT_SIGNATURE,
  ZEN_POND_STATIC_BENTHIC_MATERIAL_ID,
  ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES,
  ZEN_POND_STATIC_BENTHIC_RUNTIME_CHANNEL_COUNT,
  ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING,
  ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT,
  ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
} from '../../src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/zenPondStaticBenthicAssetContract.js';

const ROOT_DIR = process.cwd();
const CHECK_PREFIX = '[zen-pond-static-assets]';
const GENERATED_RELATIVE_DIR = (
  'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/assets/generated'
);
const GENERATOR_SOURCE_PATHS = Object.freeze([
  'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/zenPondBenthicMaterial.js',
  'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/textureBake/canvas2d.js',
  'src/themes/plugins/zen/shared/zenSeededRandom.js',
  'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/zenPondStaticBenthicAssetContract.js',
]);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const readSourceDigest = async () => {
  const parts = [];
  for (const relativePath of GENERATOR_SOURCE_PATHS) {
    parts.push(relativePath, await fs.readFile(path.resolve(ROOT_DIR, relativePath)));
  }
  return sha256(Buffer.concat(parts.map((part) => Buffer.from(part))));
};

const requireIncludes = (source, fragments, label) => {
  fragments.forEach((fragment) => {
    if (!source.includes(fragment)) {
      throw new Error(`${label} missing required fragment: ${fragment}`);
    }
  });
};

const requireExcludes = (source, fragments, label) => {
  fragments.forEach((fragment) => {
    if (source.includes(fragment)) {
      throw new Error(`${label} contains forbidden fragment: ${fragment}`);
    }
  });
};

const main = async () => {
  const generatedDir = path.resolve(ROOT_DIR, GENERATED_RELATIVE_DIR);
  const expectedNames = [
    ...Object.values(ZEN_POND_STATIC_BENTHIC_ASSET_FILES),
    ...Object.values(ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES),
  ].sort();
  const entries = await fs.readdir(generatedDir, { withFileTypes: true });
  const actualNames = entries.map((entry) => entry.name).sort();
  if (entries.some((entry) => !entry.isFile())) {
    throw new Error('generated asset directory may contain files only');
  }
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `generated asset inventory mismatch expected=${expectedNames.join(',')}`
      + ` actual=${actualNames.join(',')}`,
    );
  }

  const manifest = await readJson(path.join(
    generatedDir,
    ZEN_POND_STATIC_BENTHIC_ASSET_FILES.manifest,
  ));
  if (
    manifest.schemaVersion !== ZEN_POND_STATIC_BENTHIC_ASSET_SCHEMA_VERSION
    || manifest.contractSignature !== ZEN_POND_STATIC_BENTHIC_CONTRACT_SIGNATURE
    || manifest.materialId !== ZEN_POND_STATIC_BENTHIC_MATERIAL_ID
    || manifest.textureSize !== ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE
    || manifest.buildEngine !== ZEN_POND_STATIC_BENTHIC_BUILD_ENGINE
  ) {
    throw new Error('generated manifest contract mismatch');
  }
  const sourceDigest = await readSourceDigest();
  if (manifest.sourceDigest !== sourceDigest) {
    throw new Error('generated manifest source digest is stale');
  }
  for (const style of ['primary', 'detail']) {
    const descriptor = manifest.assets?.[style];
    const fileName = ZEN_POND_STATIC_BENTHIC_ASSET_FILES[style];
    if (descriptor?.file !== fileName) {
      throw new Error(`generated manifest file mismatch: ${style}`);
    }
    const bytes = await fs.readFile(path.join(generatedDir, fileName));
    if (descriptor.bytes !== bytes.byteLength || descriptor.sha256 !== sha256(bytes)) {
      throw new Error(`generated asset digest mismatch: ${style}`);
    }
    const runtimeFileName = ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES[style];
    if (
      descriptor.runtimeFile !== runtimeFileName
      || descriptor.runtimePixelFormat
        !== ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT
      || descriptor.runtimeEncoding !== ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING
    ) {
      throw new Error(`generated runtime manifest mismatch: ${style}`);
    }
    const runtimeBytes = await fs.readFile(path.join(generatedDir, runtimeFileName));
    const expectedDecodedBytes = (
      ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE
      * ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE
      * ZEN_POND_STATIC_BENTHIC_RUNTIME_CHANNEL_COUNT
    );
    if (
      descriptor.runtimeBytes !== runtimeBytes.byteLength
      || descriptor.runtimeSha256 !== sha256(runtimeBytes)
    ) {
      throw new Error(`generated runtime asset digest mismatch: ${style}`);
    }
    const decodedBytes = zlib.gunzipSync(runtimeBytes);
    if (
      decodedBytes.byteLength !== expectedDecodedBytes
      || descriptor.runtimeDecodedBytes !== decodedBytes.byteLength
      || descriptor.runtimeDecodedSha256 !== sha256(decodedBytes)
    ) {
      throw new Error(`generated decoded runtime asset mismatch: ${style}`);
    }
  }

  const packageJson = await readJson(path.resolve(ROOT_DIR, 'package.json'));
  if (packageJson.devDependencies?.['@napi-rs/canvas'] !== '1.0.2') {
    throw new Error('build canvas dependency must remain exact @napi-rs/canvas@1.0.2');
  }
  requireIncludes(
    packageJson.scripts?.['prebuild:release'] || '',
    ['generate:zen:pond-static-assets'],
    'prebuild:release script',
  );
  requireIncludes(
    packageJson.scripts?.['build:bundle'] || '',
    ['generate:zen:pond-static-assets'],
    'build:bundle script',
  );

  const renderPlanSource = await fs.readFile(path.resolve(
    ROOT_DIR,
    'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/compileZenPondVisualRenderPlan.js',
  ), 'utf8');
  requireIncludes(renderPlanSource, [
    'requirePreparedZenPondStaticBenthicSource',
    'ZEN_POND_FLOOR_PROFILES.NEUTRAL_DEPTH',
  ], 'Zen Pond visual render plan');
  const textureBundleSource = await fs.readFile(path.resolve(
    ROOT_DIR,
    'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/layer/textureBundle.js',
  ), 'utf8');
  requireExcludes(textureBundleSource, [
    'texture_build_failed',
    'failed: true',
    'failed: false',
  ], 'Zen Pond water texture bundle');
  requireIncludes(textureBundleSource, [
    "source.kind === 'rgba8'",
    'BaseTexture.fromBuffer',
    'ZEN_POND_WATER_TEXTURE_RGBA8_SOURCE_INVALID',
  ], 'Zen Pond water texture bundle');

  console.log(
    `${CHECK_PREFIX} PASS: files=${expectedNames.length}`
    + ` pngBytes=${manifest.assets.primary.bytes + manifest.assets.detail.bytes}`
    + ` runtimeBytes=${manifest.assets.primary.runtimeBytes + manifest.assets.detail.runtimeBytes}`
    + ` decodedBytes=${manifest.assets.primary.runtimeDecodedBytes + manifest.assets.detail.runtimeDecodedBytes}`
    + ` sourceDigest=${sourceDigest}`,
  );
};

main().catch((error) => {
  console.error(`${CHECK_PREFIX} FAIL: ${error?.message || error}`);
  process.exit(1);
});
