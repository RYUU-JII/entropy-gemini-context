#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const fail = (message) => {
  console.error(`[zen-pond-worker-runtime-boundary] FAIL: ${message}`);
  process.exit(1);
};

const readUtf8 = async (relativePath) => (
  fs.readFile(path.resolve(rootDir, relativePath), 'utf8')
);

const walkFiles = async (relativePath) => {
  const absolutePath = path.resolve(rootDir, relativePath);
  const stat = await fs.stat(absolutePath);
  if (stat.isFile()) return [relativePath];

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nextPath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(nextPath));
      continue;
    }
    if (!entry.isFile() || !/\.(js|jsx)$/.test(entry.name)) continue;
    files.push(nextPath.replaceAll(path.sep, '/'));
  }
  return files;
};

const forbiddenHoverAnchorTokens = Object.freeze([
  'HOVER_BADGE_ANCHOR_FRAME',
  'hoverBadgeAnchor',
  'HoverBadgeAnchor',
  'hoverLabelRef',
  'hoverLabelDomain',
  'workerHoverBadgeAnchor',
  'lastHoverBadgeAnchor',
  'emitHoverBadgeAnchorFrame',
  'resolveHoverBadgeAnchorPayload',
]);

const retiredEnvironmentOwnerPaths = Object.freeze([
  'src/themes/plugins/zen/pond/runtime/core/zenRealtimeClock.js',
  'src/themes/plugins/zen/pond/runtime/core/zenSceneEnvironmentAuthority.js',
  'src/themes/plugins/zen/pond/runtime/core/zenSceneEnvironmentSnapshot.js',
  'src/themes/plugins/zen/pond/runtime/core/zenSolarEnvironment.js',
  'src/themes/plugins/zen/pond/runtime/core/zenWeatherAuthority.js',
  'src/themes/plugins/zen/pond/runtime/core/zenWeatherEventDirector.js',
  'src/themes/plugins/zen/pond/runtime/timeOfDay.js',
  'src/themes/plugins/zen/presentation/environment/zenAmbientPalette.js',
  'src/themes/plugins/zen/pond/app/hooks/useZenEnvState.js',
]);

const countOccurrences = (source, token) => source.split(token).length - 1;

const main = async () => {
  const pondFiles = await walkFiles('src/themes/plugins/zen/pond');
  const zenRuntimePixiFiles = await walkFiles('src/themes/plugins/zen/runtime/pixi');
  const zenWorkerRuntimeFiles = await walkFiles('src/themes/plugins/zen/runtime/worker');
  const shadowMaterialContract = 'src/themes/plugins/zen/pond/contracts/zenKoiShadowMaterial.js';
  if (/\bimport\s*(?:\(|['"{*]|\w+\s+from)|\bexport\s+(?:\*|\{[^}]*\})\s+from/u.test(await readUtf8(shadowMaterialContract))) {
    fail(`${shadowMaterialContract} must remain a renderer-independent leaf contract.`);
  }
  await Promise.all(pondFiles.filter((file) => file.includes('/koiTextureCache/')).map(async (file) => {
    if ((await readUtf8(file)).includes('ZenKoiMaterialMesh')) {
      fail(`${file} must consume the shadow material contract instead of importing the GPU mesh implementation.`);
    }
  }));
  const scannerViewPath = 'src/themes/plugins/zen/widgets/signals/signalScanner/ui/ZenSignalScannerView.jsx';
  const sourceFiles = [
    ...pondFiles,
    scannerViewPath,
  ];

  await Promise.all(sourceFiles.map(async (relativePath) => {
    const source = await readUtf8(relativePath);
    forbiddenHoverAnchorTokens.forEach((token) => {
      if (source.includes(token)) {
        fail(`${relativePath} must not reintroduce worker-driven hover badge anchor stream token "${token}".`);
      }
    });
  }));

  await Promise.all(retiredEnvironmentOwnerPaths.map(async (relativePath) => {
    try {
      await fs.access(path.resolve(rootDir, relativePath));
      fail(`${relativePath} is a retired environment owner and must not be restored.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }));

  const directPixiPackagePattern = /(?:from\s*|import\s*)['"](?:pixi\.js|@pixi\/)/u;
  const allowedDirectPixiPackageConsumers = new Set([
    'src/themes/plugins/zen/runtime/worker/zenPixiWorkerEnvironment.js',
    'src/themes/plugins/zen/runtime/worker/zenPixiWorkerRuntime.js',
  ]);
  await Promise.all([
    ...pondFiles.filter((relativePath) => relativePath.includes('/renderers/pixi/')),
    ...zenRuntimePixiFiles,
    ...zenWorkerRuntimeFiles,
  ].map(async (relativePath) => {
    const source = await readUtf8(relativePath);
    if (
      directPixiPackagePattern.test(source)
      && !allowedDirectPixiPackageConsumers.has(relativePath)
    ) {
      fail(`${relativePath} must consume Pixi through the canonical Zen worker runtime seam.`);
    }
  }));
  const pixiWorkerRuntimeSource = await readUtf8(
    'src/themes/plugins/zen/runtime/worker/zenPixiWorkerRuntime.js',
  );
  const requiredNarrowPixiPackages = [
    '@pixi/app',
    '@pixi/constants',
    '@pixi/core',
    '@pixi/display',
    '@pixi/graphics',
    '@pixi/math',
    '@pixi/mesh',
    '@pixi/mesh-extras',
    '@pixi/sprite',
    '@pixi/sprite-tiling',
    '@pixi/text',
    '@pixi/unsafe-eval',
  ];
  const forbiddenBroadPixiPackages = [
    'pixi.js',
    '@pixi/accessibility',
    '@pixi/assets',
    '@pixi/compressed-textures',
    '@pixi/text-html',
  ];
  if (
    requiredNarrowPixiPackages.some((specifier) => !pixiWorkerRuntimeSource.includes(specifier))
    || forbiddenBroadPixiPackages.some((specifier) => pixiWorkerRuntimeSource.includes(specifier))
  ) {
    fail('Zen worker Pixi runtime must explicitly expose only its narrow renderer package surface.');
  }

  const programDiagnosticsSource = await readUtf8(
    'src/themes/plugins/zen/runtime/worker/zenPixiProgramDiagnostics.js',
  );
  const pondSceneRendererSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/ZenPixiSceneRenderer.js',
  );
  const pondPixiRuntimeSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js',
  );
  const pondRendererHostSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/createZenPondPixiRendererHost.js',
  );
  if (
    /\bApplication\b/u.test(pondPixiRuntimeSource)
    || !/\bRenderer\b/u.test(pondPixiRuntimeSource)
    || !pixiWorkerRuntimeSource.includes("export { Application } from '@pixi/app'")
    || !pondSceneRendererSource.includes('app = createZenPondPixiRendererHost({')
    || /\bnew\s+Application\s*\(|\bapp\??\.ticker\b/u.test(pondSceneRendererSource)
    || !pondRendererHostSource.includes('new Renderer(rendererOptions)')
    || !/const rendererOptions\s*=\s*\{\s*\.\.\.options,\s*zenPondSpriteBatchDialect:\s*true,\s*zenPondTilingSpriteDialect:\s*true\s*\}/u.test(pondRendererHostSource)
    || !pondRendererHostSource.includes('new Container()')
    || !pondRendererHostSource.includes('contextAttributes?.stencil !== true')
    || !pondRendererHostSource.includes('ZEN_POND_PIXI_STENCIL_REQUIRED')
    || !pondRendererHostSource.includes('ZEN_POND_PIXI_RENDERER_HOST_DISPOSE_FAILED')
    || /\bApplication\b|\bautoDetectRenderer\b|\bisWebGLSupported\b|\bRenderer\.test\s*\(|\.getContext\s*\(/u.test(pondRendererHostSource)
  ) {
    fail('Pond must own one direct WebGL Renderer/Container host, validate its actual stencil context, retain explicit disposal failures and avoid suitability probes or Pixi app tickers. Shared Application remains available to Bonsai comparisons.');
  }
  const pondSpriteBatchShaderSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/zenPondSpriteBatchShader.js',
  );
  const forbiddenSpriteBatchOwnerPattern = /\b(?:GLProgram|Shader|UniformGroup|ShaderSystem|compileShader|linkProgram|bindAttribLocation|getExtension|getParameter|getProgramParameter|getActiveAttrib|getActiveUniform|getUniformLocation|glPrograms|programCache|defaultGroupCache|attributeData|uniformData|_shader|_packedGeometries|defaultMaxTextures|defaultBatchSize|PREFER_ENV)\b|\.prototype|\.getContext\s*\(|\bsettings\s*\.|Program\.(?:from|defaultVertexPrecision|defaultFragmentPrecision)\b|program\.(?:vertexSrc|fragmentSrc)\s*=/u;
  const forbiddenSpriteBatchOverridePattern = /\b(?:contextChange|start|stop|flush|render|drawBatches|buildDrawCalls|buildTexturesAndDrawCalls|packInterleavedGeometry|initFlushBuffers|updateGeometry|destroy)\s*\([^)]*\)\s*\{/u;
  if (
    !pixiWorkerRuntimeSource.includes('zenPondSpriteBatchShader.js')
    || !pixiWorkerRuntimeSource.includes('createZenPondSpriteBatchRendererClass')
    || !/extensions\.add\s*\(/u.test(pixiWorkerRuntimeSource)
    || !/type:\s*ExtensionType\.RendererPlugin/u.test(pixiWorkerRuntimeSource)
    || !/name:\s*['"]batch['"]/u.test(pixiWorkerRuntimeSource)
    || countOccurrences(pixiWorkerRuntimeSource, 'extensions.add(') !== 2
    || countOccurrences(pixiWorkerRuntimeSource, 'extensions.add(ZenPondSpriteBatchRenderer)') !== 1
    || !pondSpriteBatchShaderSource.includes('export const createZenPondSpriteBatchWebGL2Sources')
    || !pondSpriteBatchShaderSource.includes('export const createZenPondSpriteBatchRendererClass')
    || !/extends\s+BatchRenderer\b/u.test(pondSpriteBatchShaderSource)
    || !/extends\s+BatchShaderGenerator\b/u.test(pondSpriteBatchShaderSource)
    || !/setShaderGenerator\s*\(/u.test(pondSpriteBatchShaderSource)
    || !/generateShader\s*\(/u.test(pondSpriteBatchShaderSource)
    || !/generateSampleSrc\s*\(/u.test(pondSpriteBatchShaderSource)
    || !pondSpriteBatchShaderSource.includes('super.setShaderGenerator(options)')
    || !pondSpriteBatchShaderSource.includes('super.generateShader(maxTextures)')
    || !pondSpriteBatchShaderSource.includes('super.generateSampleSrc(maxTextures)')
    || !pondSpriteBatchShaderSource.includes('BatchRenderer.defaultVertexSrc')
    || !pondSpriteBatchShaderSource.includes('BatchRenderer.defaultFragmentTemplate')
    || !/zenPondSpriteBatchDialect\s*(?:===|!==)\s*true/u.test(pondSpriteBatchShaderSource)
    || !pondSpriteBatchShaderSource.includes('renderer.context.webGLVersion')
    || !pondSpriteBatchShaderSource.includes('ZEN_POND_SPRITE_BATCH_WEBGL_VERSION_INVALID')
    || !pondSpriteBatchShaderSource.includes('ZEN_POND_SPRITE_BATCH_ATTRIBUTE_LAYOUT_INVALID')
    || !pondSpriteBatchShaderSource.includes('attributes.length !== 4')
    || !pondSpriteBatchShaderSource.includes('Object.hasOwn(NATIVE_ATTRIBUTE_LOCATIONS, name)')
    || !/aColor:\s*0,\s*aTextureCoord:\s*1,\s*aTextureId:\s*2,\s*aVertexPosition:\s*3/u.test(pondSpriteBatchShaderSource)
    || !pondSpriteBatchShaderSource.includes('layout(location = 0) out vec4')
    || !/#version\s+300\s+es/u.test(pondSpriteBatchShaderSource)
    || !/new\s+Program\s*\(/u.test(pondSpriteBatchShaderSource)
    || countOccurrences(pondSpriteBatchShaderSource, 'new Program(') !== 1
    || /generateZenPondBalancedSamplerSource|zenPondBalancedSpriteBatch/u.test(pondSpriteBatchShaderSource + pondRendererHostSource)
    || /^\s*(?:import|export\s+.*\s+from)\b/mu.test(pondSpriteBatchShaderSource)
    || forbiddenSpriteBatchOwnerPattern.test(pondSpriteBatchShaderSource)
    || forbiddenSpriteBatchOverridePattern.test(pondSpriteBatchShaderSource)
  ) {
    fail('Declared Zen renderer sprite batching may choose only source dialect through public native generator hooks and one canonical extension registration. WebGL1/unflagged renderers and the sampler ladder stay native; one uncompiled native Program may project precision before interface-only GLSL300 conversion. Compiler/reflection/cache handles, capacity, geometry, draw/lifecycle and global settings stay native.');
  }
  const pondTilingSpriteShaderSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/zenPondTilingSpriteShader.js',
  );
  const forbiddenTilingSpriteOwnerPattern = /\b(?:GLProgram|ProgramCache|UniformGroup|ShaderSystem|compileShader|linkProgram|bindAttribLocation|getExtension|getParameter|getProgramParameter|getActiveAttrib|getActiveUniform|getUniformLocation|glPrograms|programCache|attributeData|uniformData|_shader|PREFER_ENV)\b|\bnew\s+Program\b|\bProgram\.(?:from|defaultVertexPrecision|defaultFragmentPrecision)\b|\.prototype|\.getContext\s*\(|\bsettings\s*\.|\bthis\.(?:quad|state|shader)\s*=|program\.(?:vertexSrc|fragmentSrc)\s*=/u;
  const forbiddenTilingSpriteOverridePattern = /\b(?:constructor|start|stop|flush|render|destroy)\s*\([^)]*\)\s*\{/u;
  if (
    !pixiWorkerRuntimeSource.includes('zenPondTilingSpriteShader.js')
    || !pixiWorkerRuntimeSource.includes('createZenPondTilingSpriteRendererClass({ TilingSpriteRenderer, Shader })')
    || !/import\s*\{\s*TilingSpriteRenderer\s*\}\s*from\s*['"]@pixi\/sprite-tiling['"]/u.test(pixiWorkerRuntimeSource)
    || !/ZenPondTilingSpriteRenderer\.extension\s*=\s*\{\s*name:\s*['"]tilingSprite['"],\s*type:\s*ExtensionType\.RendererPlugin\s*\}/u.test(pixiWorkerRuntimeSource)
    || countOccurrences(pixiWorkerRuntimeSource, 'extensions.add(ZenPondTilingSpriteRenderer)') !== 1
    || !pondTilingSpriteShaderSource.includes('export const createZenPondTilingSpriteWebGL2Sources')
    || !pondTilingSpriteShaderSource.includes('export const createZenPondTilingSpriteRendererClass')
    || !/extends\s+TilingSpriteRenderer\b/u.test(pondTilingSpriteShaderSource)
    || !/zenPondTilingSpriteDialect\s*===\s*true/u.test(pondTilingSpriteShaderSource)
    || !pondTilingSpriteShaderSource.includes('renderer.context.webGLVersion')
    || !pondTilingSpriteShaderSource.includes('enabled && version !== 1 && version !== 2')
    || !pondTilingSpriteShaderSource.includes('ZEN_POND_TILING_SPRITE_WEBGL_VERSION_INVALID')
    || pondTilingSpriteShaderSource.indexOf('ZEN_POND_TILING_SPRITE_WEBGL_VERSION_INVALID') > pondTilingSpriteShaderSource.indexOf('super.contextChange()')
    || countOccurrences(pondTilingSpriteShaderSource, 'super.contextChange()') !== 1
    || !pondTilingSpriteShaderSource.includes('if (!enabled || version === 1) return')
    || !pondTilingSpriteShaderSource.includes('createZenPondTilingSpriteWebGL2Sources(previous.program)')
    || !pondTilingSpriteShaderSource.includes('Shader.from(sources.vertex, sources.fragment, previous.uniformGroup)')
    || countOccurrences(pondTilingSpriteShaderSource, 'Shader.from(') !== 1
    || !pondTilingSpriteShaderSource.includes('previous.destroy()')
    || !pondTilingSpriteShaderSource.includes('ZEN_POND_TILING_SPRITE_SOURCE_INVALID')
    || !pondTilingSpriteShaderSource.includes('precision\\s+lowp\\s+float')
    || !pondTilingSpriteShaderSource.includes('attributes.length !== 2')
    || !pondTilingSpriteShaderSource.includes('Object.hasOwn(NATIVE_ATTRIBUTE_LOCATIONS, name)')
    || !/aTextureCoord:\s*0,\s*aVertexPosition:\s*1/u.test(pondTilingSpriteShaderSource)
    || !pondTilingSpriteShaderSource.includes('layout(location = 0) out vec4')
    || !/#version\s+300\s+es/u.test(pondTilingSpriteShaderSource)
    || /^\s*(?:import|export\s+.*\s+from)\b/mu.test(pondTilingSpriteShaderSource)
    || forbiddenTilingSpriteOwnerPattern.test(pondTilingSpriteShaderSource)
    || forbiddenTilingSpriteOverridePattern.test(pondTilingSpriteShaderSource)
  ) {
    fail('Declared Zen renderer tiling may specialize only public contextChange after flagged actual-version validation, with one native setup call. Only WebGL2 simpleShader source interfaces change; original lowp/math, uniformGroup sharing, general shader, render/geometry/wrap/state/lifecycle and native compiler/cache remain unchanged. Exactly one additional named canonical extension registration is allowed; private owners, GL queries and global mutation remain forbidden.');
  }
  const declaredZenDialectHosts = new Set([
    'src/themes/plugins/zen/pond/renderers/pixi/createZenPondPixiRendererHost.js',
    'src/themes/plugins/zen/runtime/pixi/createZenBonsaiPlumePixiRenderer.js',
    'src/themes/plugins/zen/runtime/pixi/createZenBonsaiG15PixiRenderer.js',
    'src/themes/plugins/zen/runtime/pixi/createPixiBonsaiRenderer.js',
    'src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactEngine.js',
  ]);
  const zenArtifactEngineFiles = await walkFiles('src/themes/plugins/zen/presentation/artifacts/engine');
  const observedDialectHosts = new Set();
  await Promise.all([...pondFiles, ...zenRuntimePixiFiles, ...zenArtifactEngineFiles].map(async (relativePath) => {
    const source = await readUtf8(relativePath);
    const spriteFlags = [...source.matchAll(/\bzenPondSpriteBatchDialect\s*:\s*true\b/gu)].length;
    const tilingFlags = [...source.matchAll(/\bzenPondTilingSpriteDialect\s*:\s*true\b/gu)].length;
    if (spriteFlags === 0 && tilingFlags === 0) return;
    if (!declaredZenDialectHosts.has(relativePath) || spriteFlags !== 1 || tilingFlags !== 1) {
      fail(`${relativePath} may not add an undeclared/partial/repeated native shader-dialect opt-in. Only the five named Zen renderer hosts own one pair of existing flags; unflagged renderers and WebGL1 stay native.`);
    }
    observedDialectHosts.add(relativePath);
  }));
  if ([...declaredZenDialectHosts].some(relativePath => !observedDialectHosts.has(relativePath))) {
    fail('All five declared Zen renderer hosts must explicitly opt into both existing public native batch/tiling source hooks, without global defaults or additional plugin registrations.');
  }
  await Promise.all(pondFiles.filter((relativePath) => relativePath.includes('/renderers/pixi/')).map(async (relativePath) => {
    if (/\bGraphics\b/u.test(await readUtf8(relativePath))) {
      fail(`${relativePath} must not introduce Pond Graphics into native batch's shared direct-shader cache without a separately reviewed context/dialect cache boundary.`);
    }
  }));
  if (
    !pixiWorkerRuntimeSource.includes('installZenPixiProgramDiagnostics')
    || !pondSceneRendererSource.includes('let programDiagnostics = null')
    || !pondSceneRendererSource.includes('if (ZEN_PIXI_PROGRAM_DIAGNOSTICS_BUILD_ENABLED && qualityProfile?.telemetry?.enabled === true)')
    || !pondSceneRendererSource.includes('installZenPixiProgramDiagnostics(app.renderer, { enabled: true, nowMs })')
    || !pondSceneRendererSource.includes('if (programDiagnostics) cleanup(() => programDiagnostics.dispose())')
    || !programDiagnosticsSource.includes('const MAX_DIAGNOSTIC_PROGRAMS = 24')
    || !programDiagnosticsSource.includes('const MAX_DIAGNOSTIC_CONTEXTS = 2')
    || !programDiagnosticsSource.includes('originalGenerateProgram.apply(this, args)')
    || !programDiagnosticsSource.includes('finishStartupDiagnostics: () => { restore(); return snapshot(); }')
    || /\bGLProgram\b|\.prototype|\bpreparePrograms\b|\blinkProgram\b|\bgetExtension\b|\bgetParameter\b|\bgetProgramParameter\b|\bgetActive(?:Attrib|Uniform)\b|\bglPrograms\b/u.test(programDiagnosticsSource)
    || /shaderSystem\.bind\s*=/u.test(programDiagnosticsSource)
    || /program\.(?:attributeData|uniformData)\s*=/u.test(programDiagnosticsSource)
    || /\bpreparePrograms\s*:/u.test(pondSceneRendererSource)
  ) {
    fail('Pond program diagnostics must require debug capability and explicit telemetry, observe only the unchanged native ShaderSystem method with bounded total-call evidence, restore it after the first ACK and leave GL, metadata, bind/cache and compilation scheduling owned by Pixi.');
  }

  const canopyResearchSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/telemetry/zenCanopyPreparationResearch.js',
  );
  const canopyResearchPresentationSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/pixiWaterPresentationRuntime.js',
  );
  if (!canopyResearchSource.includes('if (!CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED) return null')
      || !canopyResearchSource.includes('normalizeZenPondCanopyPreparationResearch(canopyPreparation) === undefined')
      || !canopyResearchSource.includes('telemetryEnabled !== true')
      || !canopyResearchSource.includes('if (attempted) throw')
      || !canopyResearchSource.includes('isBeforeFirstDraw() !== true')
      || !canopyResearchSource.includes('attempted = true')
      || countOccurrences(canopyResearchSource, 'renderer.shader.generateProgram(shader)') !== 1
      || !canopyResearchSource.includes("setStartupPhase('canopy_pre_draw_prepare')")
      || !canopyResearchSource.includes('finally')
      || !canopyResearchSource.includes("setStartupPhase('first_frame_assets_prepare')")
      || /\bglPrograms\b|\b(?:GLProgram|Program|Shader)\b|\.prototype|\b(?:getExtension|getParameter|getProgramParameter|compileShader|linkProgram|flush|finish|readPixels|fenceSync|setTimeout|setInterval|requestAnimationFrame)\s*\(|\.shader\.(?:bind|generateProgram)\s*=/u.test(canopyResearchSource)
      || !pondSceneRendererSource.includes('const prepareCanopyBeforeFirstDraw = ZEN_PIXI_CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED')
      || !pondSceneRendererSource.includes('!disposed && useTicker === false && frameCount === 0')
      || !canopyResearchPresentationSource.includes('if (CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED && typeof prepareCanopyBeforeFirstDraw')
      || !canopyResearchPresentationSource.includes('waterEffectsLayer.topShadowObjects?.length !== 1')
      || !canopyResearchPresentationSource.includes('prepareCanopyBeforeFirstDraw(waterEffectsLayer.topShadowObjects[0].shader)')) {
    fail('Canopy preparation research must remain a separate debug-only explicit telemetry intervention before the first draw, with one public native ShaderSystem call, loud invalid/repeated admission, native errors and no GL/cache/compiler/global/retry/scheduling machinery. Default/native and production must not invoke it; program diagnostics stay observation-only.');
  }

  const environmentAuthoritySource = await readUtf8(
    'src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentAuthority.js',
  );
  const environmentSnapshotSource = await readUtf8(
    'src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentSnapshot.js',
  );
  const environmentKernelSource = await readUtf8(
    'src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentKernel.js',
  );
  const pondProjectionSource = await readUtf8(
    'src/themes/plugins/zen/pond/runtime/core/zenPondEnvironmentProjection.js',
  );
  const pondDynamicTargetSource = await readUtf8(
    'src/themes/plugins/zen/pond/runtime/core/zenPondEnvironmentDynamicTarget.js',
  );
  const bonsaiProjectionSource = await readUtf8(
    'src/themes/plugins/zen/runtime/environment/zenBonsaiEnvironmentProjection.js',
  );
  if (
    !environmentAuthoritySource.includes("'zen.world.environment.authority'")
    || !environmentAuthoritySource.includes('authoritySignature')
    || !environmentAuthoritySource.includes("REALTIME: 'realtime'")
    || !environmentAuthoritySource.includes("FIXED: 'fixed'")
  ) {
    fail('Zen world environment authority must remain a strict versioned realtime/fixed DTO.');
  }
  if (
    !environmentSnapshotSource.includes("'zen.world.environment.snapshot'")
    || !environmentSnapshotSource.includes('authorityRevision')
    || !environmentSnapshotSource.includes('sampleId')
    || !environmentKernelSource.includes('sampleZenWorldEnvironment')
  ) {
    fail('Zen world environment sampling must preserve authority revision and sample identity.');
  }
  const worldSampleStart = environmentKernelSource.indexOf(
    'export const sampleZenWorldEnvironment',
  );
  const worldSampleSource = worldSampleStart >= 0
    ? environmentKernelSource.slice(worldSampleStart)
    : '';
  if (
    !worldSampleSource.includes('resolveZenEnvironmentStateFromCanonicalTimeContext')
    || worldSampleSource.includes('resolveZenEnvironmentState({')
  ) {
    fail('A world sample must resolve its realtime clock once before environment projection.');
  }
  if (
    !pondProjectionSource.includes('sourceAuthorityRevision')
    || !pondProjectionSource.includes('dynamicSignature')
    || !pondProjectionSource.includes("bakeSignature: 'zen_pond_environment_bake:none'")
    || !pondProjectionSource.includes('projectZenPondEnvironmentDynamicTarget')
    || !pondDynamicTargetSource.includes('requireZenWorldEnvironmentSnapshot')
    || !pondDynamicTargetSource.includes('projectZenWorldEnvironmentRuntimeTarget')
    || !bonsaiProjectionSource.includes('dynamicSignature')
    || !bonsaiProjectionSource.includes('bakeSignature')
  ) {
    fail('Pond and Bonsai must project explicit dynamic and bake invalidation domains.');
  }

  if (!environmentAuthoritySource.includes('modelRevision')
      || /causeChannelTuning|envCause|from ['"].*pond\//u.test(environmentKernelSource)
      || /buildAmbientFacts|buildWeatherFacts|baseEnvironment:/u.test(environmentSnapshotSource)) {
    fail('World v2 semantics require model identity and one environment payload without Pond tuning or duplicate fact DTOs.');
  }
  const cloudFieldSource = await readUtf8('src/themes/plugins/zen/runtime/environment/zenWorldCloudField.js');
  const skyReflectionSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/pixiWaterSkyReflectionShader.js');
  const fieldUniformSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/pixiWaterSurfaceFieldUniformResolver.js');
  const fieldConsumerSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/pixiWaterSurfaceFieldConsumerShader.js');
  const waterDerivationSource = await readUtf8('src/themes/plugins/zen/pond/runtime/zenWaterDerivation.js');
  if (cloudFieldSource.includes('Math.random')
      || !skyReflectionSource.includes('zenWorldCloudField.js')
      || !skyReflectionSource.includes('reflect(-view, normal)')
      || !fieldUniformSource.includes('env.sunDirectionZ')
      || /resolveTimeLinkedLightAmount|resolveDiurnalPhase|const resolveSceneBrightness/u.test(waterDerivationSource)) {
    fail('Pond must consume canonical solar/lighting and shared seeded clouds without private diurnal or cloud motion math.');
  }
  if (/ws_apply_surface_sheen|uSurfaceGoldLift|uSurfaceSheenIntensity/u.test(fieldConsumerSource)) {
    fail('Canonical surface material must receive illumination once, without a second broad sheen/gold film.');
  }
  const waterSpriteSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/pixiWaterEffectsSpriteFactory.js');
  const waterTextureCacheSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/pixiWaterEffectsTextureCache.js');
  if (/BLEND_MODES\.(?:HARD_LIGHT|SOFT_LIGHT|OVERLAY)/u.test(waterSpriteSource + waterTextureCacheSource)) {
    fail('Pixi WebGL maps advanced blend enums to NORMAL; floor relief must use ZenBenthicMaterialFilter.');
  }
  for (const retiredCloudPath of [
    'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/textureBake/clouds.js',
    'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/pixiWaterEffectsCloudBenthicPass.js',
  ]) {
    try {
      await fs.access(path.resolve(rootDir, retiredCloudPath));
      fail(`${retiredCloudPath} is retired: sky reflection belongs after benthic refraction in the surface filter.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  const protocolSource = await readUtf8('src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerProtocol.js');
  if (!protocolSource.includes('FIRST_FRAME_ACK')) {
    fail('worker protocol must keep FIRST_FRAME_ACK as the readiness telemetry seam.');
  }
  if (!protocolSource.includes('SYNC_ENVIRONMENT_AUTHORITY')) {
    fail('worker protocol must keep environment authority separate from runtime params.');
  }

  const startupContractSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerStartupContract.js',
  );
  const engineLifecycleSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerEngineLifecycle.js',
  );
  const signalScannerLoopSource = await readUtf8(
    'src/themes/plugins/zen/pond/runtime/zenSignalScannerLoop.js',
  );
  const renderLoopSource = await readUtf8('src/platform/rendering/renderLoop.js');
  const firstFrameAckGateSource = await readUtf8(
    'src/themes/plugins/zen/pond/control/runtimeClient/createZenPondFirstFrameAckGate.js',
  );
  const workerMessageBusSource = await readUtf8(
    'src/themes/plugins/zen/pond/control/runtimeClient/createZenPondWorkerMessageBus.js',
  );
  const workerRendererMountSource = await readUtf8(
    'src/themes/plugins/zen/pond/control/runtimeClient/mountZenPondWorkerRendererCore.js',
  );
  const homeScanWorkspaceSource = await readUtf8(
    'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx',
  );
  const presentationSceneAckCoordinatorSource = await readUtf8(
    'src/apps/dashboard/tabs/main/home/zenHomePresentationSceneAckCoordinator.js',
  );
  if (
    !startupContractSource.includes("ZEN_POND_WORKER_STARTUP_EVENT = 'worker_startup_progress'")
    || !startupContractSource.includes("STARTUP_RENDER_FAILED: 'startup_render_failed'")
    || !startupContractSource.includes("RAF_LIVENESS_FALLBACK: 'raf_liveness_fallback'")
    || !startupContractSource.includes("RENDER_EXCEPTION: 'render_exception'")
    || !startupContractSource.includes("RAF_CALLBACK_STALLED: 'raf_callback_stalled'")
    || !startupContractSource.includes('createZenPondWorkerStartupProgress')
    || !startupContractSource.includes('requireZenPondWorkerStartupProgress')
    || !startupContractSource.includes('sanitizeZenPondWorkerStartupError')
    || !startupContractSource.includes('MAX_ERROR_MESSAGE_LENGTH')
    || !startupContractSource.includes("'[redacted-url]'")
  ) {
    fail('Pond startup telemetry must remain a bounded stage/reason DTO with sanitized error output.');
  }
  if (
    !engineLifecycleSource.includes('const AFTER_RENDER_ERROR_BREAKER_THRESHOLD = 3;')
    || !engineLifecycleSource.includes('const STARTUP_RAF_LIVENESS_WATCHDOG_MS = 120;')
    || !engineLifecycleSource.includes('const startupPending = state.firstFrameAckEmitted !== true;')
    || !engineLifecycleSource.includes('const fatal = startupPending')
    || !engineLifecycleSource.includes('ZEN_POND_WORKER_STARTUP_STAGE.STARTUP_RENDER_FAILED')
    || !engineLifecycleSource.includes('ZEN_POND_WORKER_STARTUP_READINESS_REASON.RENDER_EXCEPTION')
    || !engineLifecycleSource.includes('errorCode: sanitizedStartupError.code')
    || !engineLifecycleSource.includes("frameScheduler: 'auto'")
    || !engineLifecycleSource.includes('startupFrameWatchdogMs: STARTUP_RAF_LIVENESS_WATCHDOG_MS')
    || !engineLifecycleSource.includes('isStartupFramePending: () => state.firstFrameAckEmitted !== true')
    || !engineLifecycleSource.includes('state.firstFrameAckEmitted !== true')
    || !engineLifecycleSource.includes('onStartupFrameSchedulerFallback: () => {')
    || !engineLifecycleSource.includes('ZEN_POND_WORKER_STARTUP_STAGE.RAF_LIVENESS_FALLBACK')
  ) {
    fail('Pond startup must fail on the first pre-ACK render exception and own the exact 120ms auto-scheduler watchdog opt-in.');
  }
  if (
    !signalScannerLoopSource.includes('startupFrameWatchdogMs = null')
    || !signalScannerLoopSource.includes('isStartupFramePending = null')
    || !signalScannerLoopSource.includes('onStartupFrameSchedulerFallback = null')
    || !signalScannerLoopSource.includes('startupFrameWatchdogMs,')
    || !signalScannerLoopSource.includes('isStartupFramePending,')
    || !signalScannerLoopSource.includes('onStartupFrameSchedulerFallback,')
    || !signalScannerLoopSource.includes('pausedFrameIntervalMs: 250')
    || !signalScannerLoopSource.includes('animationEnabledRef.current === false')
  ) {
    fail('Pond runtime loop must forward the canonical startup scheduler liveness contract and re-observe paused activity without a local scheduler.');
  }
  if (
    !renderLoopSource.includes('startupFrameWatchdogMs = null')
    || !renderLoopSource.includes('isStartupFramePending = null')
    || !renderLoopSource.includes('onStartupFrameSchedulerFallback = null')
    || !renderLoopSource.includes("frameScheduler === 'auto'")
    || !renderLoopSource.includes('isStartupFramePending() === true')
    || !renderLoopSource.includes("settleSchedule(schedule, 'startup_timeout'")
    || !renderLoopSource.includes('activeSchedule !== schedule')
    || !renderLoopSource.includes('schedule.settled')
    || !renderLoopSource.includes('cancelAnimationFrame(schedule.rafId)')
    || !renderLoopSource.includes('clearTimeout(schedule.timeoutId)')
  ) {
    fail('runRenderLoop startup liveness must stay an auto-only, single-settlement rAF/timeout race.');
  }
  if (
    !firstFrameAckGateSource.includes('defaultTimeoutMs = 10000')
    || !firstFrameAckGateSource.includes("error.code = 'ZEN_POND_FIRST_FRAME_ACK_TIMEOUT'")
    || !firstFrameAckGateSource.includes('startupProgress: progress')
    || !firstFrameAckGateSource.includes('markProgress')
    || !firstFrameAckGateSource.includes('getProgress')
    || !workerMessageBusSource.includes('ZEN_POND_WORKER_STARTUP_EVENT')
    || !workerMessageBusSource.includes('ackGate.markProgress(progress)')
    || !workerMessageBusSource.includes('runtimeError.details = Object.freeze({ startupProgress })')
  ) {
    fail('Pond main runtime must retain bounded startup progress without extending the 10s first-frame ACK budget.');
  }
  if (
    !workerRendererMountSource.includes('requireZenPondWorkerStartupProgress')
    || !workerRendererMountSource.includes('error?.details?.startupProgress')
    || countOccurrences(workerRendererMountSource, 'startupProgress,') < 2
  ) {
    fail('Pond hard-failure readiness and telemetry must preserve validated startup progress.');
  }
  if (
    !homeScanWorkspaceSource.includes('startupStage: milestoneEvent?.startupStage ?? null')
    || !homeScanWorkspaceSource.includes('milestoneEvent?.startupReadinessReason ?? null')
    || !presentationSceneAckCoordinatorSource.includes('STARTUP_DIAGNOSTIC_TOKEN_PATTERN')
    || !presentationSceneAckCoordinatorSource.includes('startup_stage=')
    || !presentationSceneAckCoordinatorSource.includes('startup_reason=')
    || !presentationSceneAckCoordinatorSource.includes('error.details = normalizedDetails')
  ) {
    fail('Pond startup diagnostics must remain bounded through the Home presentation fatal error surface.');
  }

  const worldEnvironmentHookSource = await readUtf8(
    'src/themes/plugins/zen/runtime/environment/useZenWorldEnvironmentAuthority.js',
  );
  const pondEnvironmentHookSource = await readUtf8(
    'src/themes/plugins/zen/pond/app/hooks/useZenPondEnvironmentAuthority.js',
  );
  const bonsaiEnvironmentHookSource = await readUtf8(
    'src/themes/plugins/zen/runtime/environment/useZenBonsaiEnvironmentState.js',
  );
  const pondSurfaceSource = await readUtf8(
    'src/themes/plugins/zen/pond/app/ZenSignalScannerSurface.jsx',
  );
  const bonsaiRendererSource = await readUtf8(
    'src/themes/plugins/zen/runtime/useZenTreeRenderer.js',
  );
  if (
    !worldEnvironmentHookSource.includes('useThemeTemporalAuthority')
    || !worldEnvironmentHookSource.includes('useZenWorldEnvironmentAuthority')
  ) {
    fail('Zen render runtimes must consume temporal authority through the global environment hook.');
  }
  if (
    !pondEnvironmentHookSource.includes('useZenWorldEnvironmentAuthority')
    || pondEnvironmentHookSource.includes('useThemeTemporalAuthority')
    || !pondSurfaceSource.includes('useZenPondEnvironmentAuthority')
    || /\buseZenEnvState\s*\(/u.test(pondSurfaceSource)
  ) {
    fail('Pond main runtime must project weather authority only and leave environment sampling to the worker.');
  }
  if (
    !bonsaiEnvironmentHookSource.includes('useZenWorldEnvironmentAuthority')
    || !bonsaiEnvironmentHookSource.includes('projectZenBonsaiEnvironment')
    || !bonsaiRendererSource.includes('useZenBonsaiEnvironmentState')
    || bonsaiRendererSource.includes('/pond/')
    || bonsaiRendererSource.includes('useZenEnvState')
  ) {
    fail('Bonsai must consume its own environment projection without importing Pond ownership.');
  }

  const ambientHookSource = await readUtf8(
    'src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js',
  );
  if (countOccurrences(ambientHookSource, 'resolveZenAmbientPresentation(') !== 1) {
    fail('Dashboard ambient hook must resolve one environment sample per scheduled state tick.');
  }

  const workerEnvironmentPresentationSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerEnvironmentPresentation.js',
  );
  const environmentUpdateStart = workerEnvironmentPresentationSource.indexOf(
    'export const updateZenPondEnvironmentPresentation',
  );
  const environmentUpdateSource = environmentUpdateStart >= 0
    ? workerEnvironmentPresentationSource.slice(environmentUpdateStart)
    : '';
  if (
    !workerEnvironmentPresentationSource.includes('ZEN_POND_ENVIRONMENT_INTERPOLATION_FIELDS')
    || !workerEnvironmentPresentationSource.includes('interpolateZenPondEnvironmentTarget')
    || workerEnvironmentPresentationSource.includes('Object.keys(target')
    || environmentUpdateSource.includes('normalizeRuntimeEnvAuthority(envAuthority)')
  ) {
    fail('Pond worker frame path must use an explicit typed interpolation schema without authority normalization.');
  }

  const runtimeParamsSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerRuntimeParams.js',
  );
  const frameUpdateStart = runtimeParamsSource.indexOf(
    'export const updateRuntimeEnvironmentForWorkerState',
  );
  const frameUpdateSource = frameUpdateStart >= 0
    ? runtimeParamsSource.slice(frameUpdateStart)
    : '';
  if (
    !frameUpdateSource.includes('if (!presentationUpdate.applied)')
    || /if \(!presentationUpdate\.applied\)\s*\{[^}]*normalizeRuntimeEnvAuthority/u
      .test(frameUpdateSource)
  ) {
    fail('Pond worker no-op frames must return before resolver or authority validation work.');
  }
  if (
    worldEnvironmentHookSource.includes('useThemeAmbientPresentation')
    || worldEnvironmentHookSource.includes('ambient_snapshot:')
    || pondEnvironmentHookSource.includes('useThemeAmbientPresentation')
    || pondEnvironmentHookSource.includes('ambient_snapshot:')
  ) {
    fail('UI ambient snapshots must not participate in Zen worker time authority.');
  }

  const runtimeClientCoreSource = await readUtf8(
    'src/themes/plugins/zen/pond/control/runtimeClient/createZenPondWorkerRuntimeClientCore.js',
  );
  const workerMountSource = await readUtf8(
    'src/themes/plugins/zen/pond/control/useZenWorkerRendererMount.js',
  );
  const controlPayloadSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerControlPayload.js',
  );
  const visualProfileContractSource = await readUtf8(
    'src/themes/plugins/zen/pond/contracts/zenPondVisualProfile.js',
  );
  const visualRenderPlanSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/compileZenPondVisualRenderPlan.js',
  );
  if (
    !runtimeClientCoreSource.includes('includeEnvironmentAuthority: false')
    || !runtimeClientCoreSource.includes('ENVIRONMENT_AUTHORITY_CANCEL_KEY')
  ) {
    fail('environment authority must keep its own control key after initial worker payload.');
  }
  if (
    runtimeClientCoreSource.includes('envStateRef')
    || workerMountSource.includes('envStateRef')
    || controlPayloadSource.includes('envStateRef')
    || !controlPayloadSource.includes('envAuthority.timeContext.dayIndex')
  ) {
    fail('Pond main control path must derive roster time from signed authority without a duplicate env state.');
  }
  if (
    !visualProfileContractSource.includes("FLOOR: 'floor'")
    || !visualProfileContractSource.includes("PLANTS: 'plants'")
    || !visualProfileContractSource.includes("ROCKS: 'rocks'")
    || !visualProfileContractSource.includes("SUNLIGHT: 'sunlight'")
    || !controlPayloadSource.includes('visualProfileSignature')
    || !workerMountSource.includes('visualProfile,')
    || !runtimeParamsSource.includes('visualProfileChanged')
    || !visualRenderPlanSource.includes('compileZenPondVisualRenderPlan')
  ) {
    fail('Pond visual profiles must remain a strict four-axis runtime-param contract compiled once at scene mount.');
  }

  const syncHandlerSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/worker/core/createZenPondWorkerControlSyncHandlers.js',
  );
  if (
    !syncHandlerSource.includes('handleSyncEnvironmentAuthority')
    || !syncHandlerSource.includes('waterLayerNeedsApply')
    || !syncHandlerSource.includes('getWaterEffectsLayerApplyState')
  ) {
    fail('worker controls must separate environment deltas from material-driven water apply.');
  }

  const telemetrySource = await readUtf8('src/themes/plugins/zen/pond/renderers/worker/core/createZenPondWorkerTelemetry.js');
  if (!telemetrySource.includes('markFirstFrame')) {
    fail('worker telemetry must keep markFirstFrame as the readiness telemetry owner.');
  }
  for (const relativePath of [
    'src/themes/plugins/zen/pond/renderers/worker/core/createZenPondWorkerTelemetry.js',
    'src/themes/plugins/zen/pond/control/runtimeClient/metrics.js',
  ]) {
    const source = await readUtf8(relativePath);
    if (!source.includes('zenPondFrameMetrics.js')
      || !source.includes('normalizeZenPondFrameMetrics(')
      || /const normalize(?:StageMetrics|GpuTiming|KoiRenderMetrics|TopShadowProbe|SceneFrameMetrics|MainMetrics)\s*=/u.test(source)) {
      fail(`${relativePath} must consume the shared Pond frame metrics DTO instead of defining a second field projection.`);
    }
  }
  for (const relativePath of [
    'src/themes/plugins/zen/pond/contracts/zenPondFrameMetrics.js',
    'src/themes/plugins/zen/pond/control/runtimeClient/waterEffectsDebugControls.js',
  ]) {
    const source = await readUtf8(relativePath);
    if (!source.includes('zenPondShadowLightingMetrics.js')
      || !source.includes('readZenPondShadowLightingMetrics(value.shadowLighting)')) {
      fail(`${relativePath} must preserve the canonical shadow lighting DTO through its shared reader.`);
    }
  }

  const fishRosterSource = await readUtf8(
    'src/themes/plugins/zen/pond/runtime/zenFishRosterEntitySync.js',
  );
  const simulationFishSource = await readUtf8(
    'src/themes/plugins/zen/pond/model/koi/KoiSimulationFish.js',
  );
  const canvasFishSource = await readUtf8(
    'src/themes/plugins/zen/pond/model/koi/KoiFish.js',
  );
  if (
    !fishRosterSource.includes("from '../model/koi/KoiSimulationFish.js'")
    || !fishRosterSource.includes('new KoiSimulationFish(')
    || fishRosterSource.includes("from '../world/entities.js'")
    || simulationFishSource.includes("from './koiRender.js'")
    || simulationFishSource.includes("from './koiFishRenderMethods.js'")
    || !canvasFishSource.includes('class KoiFish extends KoiSimulationFish')
    || !canvasFishSource.includes("from './koiRender.js'")
    || !canvasFishSource.includes("from './koiFishRenderMethods.js'")
  ) {
    fail('Pond worker Koi roster must use the renderer-neutral simulation class while Canvas rendering stays on the public KoiFish subclass.');
  }
  const workerDecorConsumerPaths = [
    'src/themes/plugins/zen/pond/runtime/zenAmbientEntitySync.js',
    'src/themes/plugins/zen/pond/runtime/zenRockLayoutSync.js',
    'src/themes/plugins/zen/pond/runtime/systems/zenAmbientSimulationSystem.js',
    'src/themes/plugins/zen/pond/renderers/worker/core/createZenPondWorkerControlInputHandlers.js',
  ];
  await Promise.all(workerDecorConsumerPaths.map(async (relativePath) => {
    const source = await readUtf8(relativePath);
    if (source.includes('/world/entities.js')) {
      fail(`${relativePath} must use an exact decor seam instead of the Canvas-capable world/entities barrel.`);
    }
  }));

  const viewportPolicySource = await readUtf8('src/themes/plugins/zen/pond/runtime/zenPondViewportPolicy.js');
  const pondCanvasSource = await readUtf8('src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerCanvasLifecycle.js');
  const pondFieldSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/ZenWaterSurfaceField.js');
  if (!pondSurfaceSource.includes('resolveZenPondViewportLayout')
    || !pondCanvasSource.includes('resolveZenPondViewportLayout')
    || pondSurfaceSource.includes('WORLD_TARGET_ASPECT')
    || !pondFieldSource.includes('resolveZenPondFieldSize')
    || !viewportPolicySource.includes('ZEN_POND_RENDER_PIXEL_BUDGET')) {
    fail('Pond geometry and field allocation must consume the shared responsive viewport policy.');
  }

  const shadowConsumers = [
    ['src/themes/plugins/zen/pond/renderers/pixi/entitySync/pixiScenePlantSync.js', ['projectZenPondShadow', 'projectZenPondSubmergedShadow']],
    ['src/themes/plugins/zen/pond/renderers/pixi/entitySync/pixiSceneFishSync.js', ['projectZenPondSubmergedShadow']],
    ['src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/ZenCanopyLightTransferMesh.js', ['projectZenPondShadow']],
  ];
  await Promise.all(shadowConsumers.map(async ([relativePath, projectors]) => {
    const source = await readUtf8(relativePath);
    if (!projectors.every(projector => source.includes(projector)) || !source.includes('shadowLight')) {
      fail(`${relativePath} must consume the shared frame light and support-height projection.`);
    }
    if (/resolveZenPondShadowLight\s*\(/u.test(source)) {
      fail(`${relativePath} must not rebuild the per-frame shadow light snapshot.`);
    }
  }));
  const [canopyMeshSource, canopyDialectSource, canopyPresentationSource, canopyLayerSource, canopySpriteStateSource, canopySpriteFactorySource] = await Promise.all([
    'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/ZenCanopyLightTransferMesh.js',
    'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/zenCanopyLightTransferShaderDialect.js',
    'src/themes/plugins/zen/pond/renderers/pixi/pixiWaterPresentationRuntime.js',
    'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/layer/createPixiWaterEffectsLayerCore.js',
    'src/themes/plugins/zen/pond/renderers/pixi/waterEffects/layer/spriteState.js',
    'src/themes/plugins/zen/pond/renderers/pixi/pixiWaterEffectsSpriteFactory.js',
  ].map(readUtf8));
  const canopyDialectImports = [...canopyDialectSource.matchAll(/\bfrom\s*['"]([^'"]+)['"]/gu)].map((match) => match[1]);
  const forbiddenCanopyShaderOwnerPattern = /\b(?:GLProgram|ProgramCache|ShaderSystem|compileShader|linkProgram|bindAttribLocation|getExtension|getParameter|getProgramParameter|getActiveAttrib|getActiveUniform|getUniformLocation|glPrograms|programCache|attributeData|uniformData)\b|\bnew\s+Program\b|\bProgram\.(?:from|defaultVertexPrecision|defaultFragmentPrecision)\b|\.prototype|\.getContext\s*\(|\bsettings\s*\.|\bcatch\s*\(/u;
  if (
    canopyDialectImports.length !== 1
    || canopyDialectImports[0] !== '../../../../contracts/zenPondCanopyMaterial.js'
    || !canopyDialectSource.includes('export const resolveZenCanopyLightTransferShaderSources')
    || !canopyDialectSource.includes('ZEN_CANOPY_LIGHT_TRANSFER_WEBGL_VERSION_INVALID')
    || !/webGLVersion\s*===\s*1/u.test(canopyDialectSource)
    || !/webGLVersion\s*===\s*2/u.test(canopyDialectSource)
    || /webGLVersion\s*(?:=(?!=)|\?\?|\|\|)/u.test(canopyDialectSource)
    || forbiddenCanopyShaderOwnerPattern.test(canopyDialectSource + canopyMeshSource)
    || !canopyMeshSource.includes("from '../../zenPondPixiRuntime.js'")
    || !canopyMeshSource.includes('const shaderSources = resolveZenCanopyLightTransferShaderSources(webGLVersion)')
    || canopyMeshSource.indexOf('resolveZenCanopyLightTransferShaderSources(webGLVersion)') > canopyMeshSource.indexOf('new Geometry()')
    || countOccurrences(canopyMeshSource, 'Shader.from(') !== 1
    || !canopyMeshSource.includes('Shader.from(shaderSources.vertex, shaderSources.fragment,')
    || !canopyPresentationSource.includes('webGLVersion: renderer.context.webGLVersion')
    || !/createWaterEffectsSpriteState\(\{[\s\S]*?\bwebGLVersion,/u.test(canopyLayerSource)
    || !canopyLayerSource.includes('resolveZenCanopyLightTransferShaderSources(webGLVersion)')
    || canopyLayerSource.indexOf('resolveZenCanopyLightTransferShaderSources(webGLVersion)') > canopyLayerSource.indexOf('const textureBundle = createWaterEffectsTextureBundle(')
    || !/createPixiWaterEffectsSpriteFactory\(\{[\s\S]*?\bwebGLVersion,/u.test(canopySpriteStateSource)
    || !/new ZenCanopyLightTransferMesh\(\{[\s\S]*?\bwebGLVersion,/u.test(canopySpriteFactorySource)
  ) {
    fail('Canopy source dialect must consume the actual admitted WebGL scalar through presentation/layer/factory, reject invalid versions before textures/geometry, and retain native Shader.from compilation, reflection, cache, draw and lifecycle ownership. The pure source owner may import only the canopy material contract; GL queries, compiler replacements, version inference and compile-error fallback are forbidden.');
  }
  const shadowFrameSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/pixiFrameChannels.js');
  const canopyPassSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/pixiWaterEffectsCanopyPass.js');
  if (!canopyPassSource.includes('shadowLight: transfer.shadowLight') || /resolveZenPondShadowLight\s*\(/u.test(canopyPassSource)) {
    fail('Canopy dispatch must forward the common light to its cached per-height mesh projection.');
  }
  if (!shadowFrameSource.includes('shadowLight: resolveZenPondShadowLight(')) {
    fail('pixiFrameChannels must own the common shadow light snapshot.');
  }
  const shadowGraphSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/pixiSceneGraphLifecycle.js');
  const staticShadowSources = shadowGraphSource.match(/staticBaseSources:\s*Object\.freeze\(\[([\s\S]*?)\]\)/u)?.[1];
  if (!staticShadowSources || /rockCastShadowContainer|rocksContainer/u.test(staticShadowSources)) {
    fail('Rock form/cast lighting must stay outside the static floor cache to preserve the intervening live caustics.');
  }
  const decorBakeSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/pixiDecorBakeRuntime.js');
  const decorMeshSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/ZenDecorMaterialMesh.js');
  if (!decorBakeSource.includes('getBakeContentSignature')
    || !decorMeshSource.includes('getBakeContentSignature')
    || !decorBakeSource.includes('getSourceBounds')
    || !decorBakeSource.includes('shadow ? [1, 1, 1, 1]')
    || !decorBakeSource.includes('BLEND_MODES.MULTIPLY')) {
    fail('Decor result caches must track shader inputs, crop allocation, and preserve white-backed multiply transfer.');
  }
  const shadowRendererSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/ZenPixiSceneRenderer.js');
  if (/createPixiSceneAmbientMaskRuntime|createSoftShadowTexture|onViewportApplied/u.test(shadowRendererSource)) {
    fail('Scene must not restore object-blob shadow owners or a pre-commit viewport callback.');
  }

  const opticalDomainSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterOpticalDomain.js');
  const opticalTransportSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/ZenWaterLightTransport.js');
  const causticReceiverSource = await readUtf8('src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterCausticReceiverShader.js');
  if (!opticalDomainSource.includes('ZEN_POND_SHADOW_DEPTH_WORLD_UNITS')
    || !pondFieldSource.includes('resolveZenWaterOpticalDomain')
    || !causticReceiverSource.includes('surfaceFieldUv(')
    || causticReceiverSource.includes('frameVisibility(')) {
    fail('Water transport must share canonical depth and a guarded field domain, not treat the crop as a shadow.');
  }
  const [surfaceFieldFilterSource, surfaceFieldFilterDialectSource] = await Promise.all([
    'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/PixiWaterSurfaceFieldFilter.js',
    'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterSurfaceFieldFilterShaderDialect.js',
  ].map(readUtf8));
  if (
    !surfaceFieldFilterSource.includes('extends Filter')
    || !surfaceFieldFilterSource.includes('resolveZenWaterSurfaceFieldFilterShaderSources({')
    || !surfaceFieldFilterSource.includes('webGLVersion: options?.webGLVersion')
    || !surfaceFieldFilterSource.includes('vertexSrc: Filter.defaultVertexSrc')
    || !surfaceFieldFilterSource.includes('fragmentSrc: fragmentShader')
    || !surfaceFieldFilterSource.includes("shaderSources.dialect === 'glsl_es_100'")
    || countOccurrences(surfaceFieldFilterSource, 'super(null, fragmentShader)') !== 1
    || countOccurrences(surfaceFieldFilterSource, 'super(shaderSources.vertex, shaderSources.fragment)') !== 1
    || !/new WaterSurfaceFilterClass\(sceneWidth, sceneHeight, \{\s*webGLVersion: renderer\.context\.webGLVersion,/u.test(canopyPresentationSource)
    || /^\s*(?:import|export\s+.*\s+from)\b/mu.test(surfaceFieldFilterDialectSource)
    || !surfaceFieldFilterDialectSource.includes('export const resolveZenWaterSurfaceFieldFilterShaderSources')
    || !surfaceFieldFilterDialectSource.includes('ZEN_WATER_SURFACE_FIELD_FILTER_WEBGL_VERSION_INVALID')
    || !surfaceFieldFilterDialectSource.includes('ZEN_WATER_SURFACE_FIELD_FILTER_SHADER_SOURCE_INVALID')
    || !/webGLVersion\s*===\s*1/u.test(surfaceFieldFilterDialectSource)
    || !/webGLVersion\s*!==\s*2/u.test(surfaceFieldFilterDialectSource)
    || /webGLVersion\s*(?:=(?!=)|\?\?|\|\|)/u.test(surfaceFieldFilterDialectSource)
    || forbiddenCanopyShaderOwnerPattern.test(surfaceFieldFilterDialectSource + surfaceFieldFilterSource)
    || /\bapply\s*\([^)]*\)\s*\{/u.test(surfaceFieldFilterSource)
    || countOccurrences(surfaceFieldFilterDialectSource, 'layout(location = 0) in vec2 aVertexPosition;') !== 1
    || countOccurrences(surfaceFieldFilterDialectSource, 'layout(location = 0) out vec4 wsSurfaceFilterColor;') !== 1
  ) {
    fail('Surface-field Filter may select only an equivalent source dialect from the actual admitted WebGL version and public Filter.defaultVertexSrc. WebGL1 stays native; WebGL2 changes only the validated interface. Native Filter apply, compiler/reflection/cache/lifetime remain owned by Pixi; capability queries, global mutation, version inference and compile-error retry are forbidden.');
  }
  if (!opticalTransportSource.includes('source.canopyLayouts')
    || !opticalTransportSource.includes('state.uCrownProjection')
    || !opticalTransportSource.includes('state.uDirectOcclusion')
    || /Date\.now|performance\.now|setInterval|requestAnimationFrame|readPixels|createCanvas|resolveZenPondShadowLight\s*\(/u.test(opticalTransportSource)) {
    fail('Optical visibility must borrow admitted canopy state without another clock, shadow solve, foliage bake or readback.');
  }
  const [koiMaterialSource, koiMaterialDialectSource, koiFishSource, koiDisplaySource, koiEntityPassSource, koiFishSyncSource] = await Promise.all([
    'src/themes/plugins/zen/pond/renderers/pixi/ZenKoiMaterialMesh.js',
    'src/themes/plugins/zen/pond/renderers/pixi/zenKoiMaterialShaderDialect.js',
    'src/themes/plugins/zen/pond/renderers/pixi/PixiKoiFish.js',
    'src/themes/plugins/zen/pond/renderers/pixi/koiFishDisplayObjects.js',
    'src/themes/plugins/zen/pond/renderers/pixi/scene/pixiSceneEntitySyncPass.js',
    'src/themes/plugins/zen/pond/renderers/pixi/entitySync/pixiSceneFishSync.js',
  ].map(readUtf8));
  const forbiddenKoiCompilerPattern = /\b(?:GLProgram|ProgramCache|ShaderSystem|compileShader|linkProgram|bindAttribLocation|getExtension|getParameter|getProgramParameter|getActiveAttrib|getActiveUniform|getUniformLocation|glPrograms|programCache|attributeData|uniformData)\b|\bnew\s+Program\b|\bProgram\.(?:from|defaultVertexPrecision|defaultFragmentPrecision)\b|\.getContext\s*\(|\bsettings\s*\.|\bcatch\s*\(/u;
  if (
    /^\s*(?:import|export\s+.*\s+from)\b/mu.test(koiMaterialDialectSource)
    || forbiddenCanopyShaderOwnerPattern.test(koiMaterialDialectSource)
    || forbiddenKoiCompilerPattern.test(koiMaterialSource)
    || !koiMaterialDialectSource.includes('export const requireZenKoiMaterialWebGLVersion')
    || !koiMaterialDialectSource.includes('export const resolveZenKoiMaterialShaderSources')
    || !koiMaterialDialectSource.includes('ZEN_KOI_MATERIAL_WEBGL_VERSION_INVALID')
    || !koiMaterialDialectSource.includes('ZEN_KOI_MATERIAL_SHADER_SOURCE_INVALID')
    || !/webGLVersion\s*!==\s*1\s*&&\s*webGLVersion\s*!==\s*2/u.test(koiMaterialDialectSource)
    || /webGLVersion\s*(?:=(?!=)|\?\?|\|\|)/u.test(koiMaterialDialectSource)
    || !koiMaterialSource.includes('resolveZenKoiMaterialShaderSources({')
    || koiMaterialSource.indexOf('resolveZenKoiMaterialShaderSources({') > koiMaterialSource.indexOf('super(texture, points)')
    || countOccurrences(koiMaterialSource, 'Shader.from(') !== 1
    || !koiMaterialSource.includes('Shader.from(shaderSources.vertex, shaderSources.fragment,')
    || !koiMaterialSource.includes('createShader(texture, true, form, bodyShaderSources)')
    || !/syncSceneEntitiesPass\(\{\s*webGLVersion: app\.renderer\.context\.webGLVersion,/u.test(pondSceneRendererSource)
    || !/syncFish\(\{\s*webGLVersion,/u.test(koiEntityPassSource)
    || !koiFishSyncSource.includes('new PixiKoiFish(fish, koiTextureCache, webGLVersion)')
    || !koiFishSource.includes('requireZenKoiMaterialWebGLVersion(webGLVersion)')
    || koiFishSource.indexOf('requireZenKoiMaterialWebGLVersion(webGLVersion)') > koiFishSource.indexOf('textureCache.acquire(fishInfo)')
    || !/createPixiKoiDisplayObjects\(\{[\s\S]*?\bwebGLVersion,/u.test(koiFishSource)
    || !koiDisplaySource.includes('requireZenKoiMaterialWebGLVersion(webGLVersion)')
    || koiDisplaySource.indexOf('requireZenKoiMaterialWebGLVersion(webGLVersion)') > koiDisplaySource.indexOf('new Container()')
    || !koiDisplaySource.includes('new ZenKoiMaterialRope(textures.body, ropePoints, textures.bodyForm, webGLVersion)')
  ) {
    fail('Koi body source dialect must receive the actual scene context through entity sync/fish/display creation and reject invalid versions before leases or native allocation. Body and separately declared shadow interfaces feed the same native Shader.from path; compiler/reflection/cache, geometry/draw/lifetime and global settings remain owned by Pixi. Queries, version inference and compile-error retry are forbidden.');
  }

  const [connectedCausticSource, connectedCausticDialectSource] = await Promise.all([
    'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/ZenWaterConnectedCausticOverlay.js',
    'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterConnectedCausticShaderDialect.js',
  ].map(readUtf8));
  if (
    /^\s*(?:import|export\s+.*\s+from)\b/mu.test(connectedCausticDialectSource)
    || forbiddenCanopyShaderOwnerPattern.test(connectedCausticDialectSource + connectedCausticSource)
    || !connectedCausticDialectSource.includes('export const resolveZenWaterConnectedCausticShaderSources')
    || !connectedCausticDialectSource.includes('ZEN_CONNECTED_CAUSTIC_WEBGL_VERSION_INVALID')
    || !connectedCausticDialectSource.includes('ZEN_CONNECTED_CAUSTIC_SHADER_SOURCE_INVALID')
    || !/webGLVersion\s*!==\s*1\s*&&\s*webGLVersion\s*!==\s*2/u.test(connectedCausticDialectSource)
    || /webGLVersion\s*(?:=(?!=)|\?\?|\|\|)/u.test(connectedCausticDialectSource)
    || !connectedCausticSource.includes('resolveZenWaterConnectedCausticShaderSources({')
    || !connectedCausticSource.includes('webGLVersion: options.webGLVersion')
    || !connectedCausticSource.includes('vertexSrc: VERTEX_SHADER')
    || !connectedCausticSource.includes('fragmentSrc: zenWaterConnectedCausticFragmentShader')
    || connectedCausticSource.indexOf('resolveZenWaterConnectedCausticShaderSources({') > connectedCausticSource.indexOf('super(options)')
    || countOccurrences(connectedCausticSource, 'Shader.from(') !== 1
    || !/Shader\.from\(\s*shaderSources\.vertex,\s*shaderSources\.fragment,/u.test(connectedCausticSource)
    || !connectedCausticSource.includes('this.mesh.shader = this.shader')
    || !connectedCausticSource.includes('productShader.destroy()')
    || !/new BenthicCausticOverlayClass\(\{\s*webGLVersion: renderer\.context\.webGLVersion,/u.test(canopyPresentationSource)
  ) {
    fail('Connected bottom caustics must select only their equivalent authored source interface from the actual presentation context, rejecting invalid versions before superclass/receiver allocation. Native Shader.from compilation/reflection/context cache, shared receiver math, quad draw, temporary shader disposal and texture lifetime remain unchanged; queries, compiler overrides, version inference and retry are forbidden.');
  }

  const lightTransportDialectSource = await readUtf8(
    'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterLightTransportShaderDialect.js',
  );
  if (
    /^\s*(?:import|export\s+.*\s+from)\b/mu.test(lightTransportDialectSource)
    || forbiddenCanopyShaderOwnerPattern.test(lightTransportDialectSource + opticalTransportSource)
    || !lightTransportDialectSource.includes('export const resolveZenWaterLightTransportShaderSources')
    || !lightTransportDialectSource.includes('ZEN_WATER_LIGHT_TRANSPORT_WEBGL_VERSION_INVALID')
    || !lightTransportDialectSource.includes('ZEN_WATER_LIGHT_TRANSPORT_SHADER_SOURCE_INVALID')
    || !/webGLVersion\s*!==\s*1\s*&&\s*webGLVersion\s*!==\s*2/u.test(lightTransportDialectSource)
    || /webGLVersion\s*(?:=(?!=)|\?\?|\|\|)/u.test(lightTransportDialectSource)
    || !opticalTransportSource.includes('resolveZenWaterLightTransportShaderSources({')
    || !opticalTransportSource.includes('webGLVersion: renderer?.context?.webGLVersion')
    || !opticalTransportSource.includes('vertexSrc: vertex')
    || !opticalTransportSource.includes('fragmentSrc: zenWaterLightTransportFragment')
    || opticalTransportSource.indexOf('resolveZenWaterLightTransportShaderSources({') > opticalTransportSource.indexOf('RenderTexture.create(')
    || countOccurrences(opticalTransportSource, 'Shader.from(') !== 1
    || !/Shader\.from\(\s*sources\.vertex,\s*sources\.fragment,/u.test(opticalTransportSource)
    || !canopyPresentationSource.includes('new ZenWaterLightTransport(renderer)')
  ) {
    fail('Water light transport must select only the equivalent generated six-crown source interface from its actual renderer context before allocation. Native Shader.from compilation/array reflection/context cache, target/quad draw, change-only refresh and borrowed canopy arrays/atlases remain canonical; queries, compiler overrides, version inference and retry are forbidden.');
  }

  const [pondMaterialDialectSource, decorMaterialSource, floorMaterialSource, plantSyncSource, graphLifecycleSource] = await Promise.all([
    'src/themes/plugins/zen/pond/renderers/pixi/zenPondMaterialShaderDialect.js',
    'src/themes/plugins/zen/pond/renderers/pixi/ZenDecorMaterialMesh.js',
    'src/themes/plugins/zen/pond/renderers/pixi/ZenBenthicMaterialFilter.js',
    'src/themes/plugins/zen/pond/renderers/pixi/entitySync/pixiScenePlantSync.js',
    'src/themes/plugins/zen/pond/renderers/pixi/pixiSceneGraphLifecycle.js',
  ].map(readUtf8));
  const fixedPondMaterialIds = ['decor_material', 'decor_shadow', 'koi_shadow', 'benthic_material'];
  const constructorBody = (source, name) => source.split(`export class ${name} `)[1]?.split('export class ')[0];
  const materialBeforeAllocation = (source, name, allocation) => {
    const body = constructorBody(source, name);
    return typeof body === 'string'
      && body.indexOf('resolveZenPondMaterialShaderSources({') >= 0
      && body.indexOf(allocation) > body.indexOf('resolveZenPondMaterialShaderSources({');
  };
  if (
    /^\s*(?:import|export\s+.*\s+from)\b/mu.test(pondMaterialDialectSource)
    || forbiddenCanopyShaderOwnerPattern.test(pondMaterialDialectSource)
    || forbiddenKoiCompilerPattern.test(decorMaterialSource + floorMaterialSource)
    || !pondMaterialDialectSource.includes('export const resolveZenPondMaterialShaderSources')
    || !pondMaterialDialectSource.includes('ZEN_POND_MATERIAL_WEBGL_VERSION_INVALID')
    || !pondMaterialDialectSource.includes('ZEN_POND_MATERIAL_PROGRAM_ID_INVALID')
    || !pondMaterialDialectSource.includes('ZEN_POND_MATERIAL_SHADER_SOURCE_INVALID')
    || !/webGLVersion\s*!==\s*1\s*&&\s*webGLVersion\s*!==\s*2/u.test(pondMaterialDialectSource)
    || /webGLVersion\s*(?:=(?!=)|\?\?|\|\|)/u.test(pondMaterialDialectSource)
    || !pondMaterialDialectSource.includes('Object.hasOwn(MATERIAL_PROGRAMS, programId)')
    || !pondMaterialDialectSource.includes("typeof programId !== 'string'")
    || [...pondMaterialDialectSource.matchAll(/^\s{4}\w+: Object\.freeze\(\{/gmu)].length !== 4
    || fixedPondMaterialIds.some(id => !pondMaterialDialectSource.includes(`${id}: Object.freeze({`))
    || !pondMaterialDialectSource.includes('program.nativeFilterVertex ? null : vertexSrc')
    || !pondMaterialDialectSource.includes('layout(location = 0) out vec4')
    || !/#version\s+300\s+es/u.test(pondMaterialDialectSource)
    || !materialBeforeAllocation(decorMaterialSource, 'ZenDecorMaterialMesh', 'super(makeGeometry()')
    || !materialBeforeAllocation(decorMaterialSource, 'ZenDecorShadowMesh', 'super(makeGeometry()')
    || !materialBeforeAllocation(koiMaterialSource, 'ZenKoiShadowRope', 'super(texture,')
    || !materialBeforeAllocation(koiMaterialSource, 'ZenKoiShadowTail', 'super(new Geometry()')
    || !materialBeforeAllocation(floorMaterialSource, 'ZenBenthicMaterialFilter', 'super(shaderSources.vertex,')
    || countOccurrences(decorMaterialSource, 'Shader.from(shaderSources.vertex, shaderSources.fragment,') !== 2
    || countOccurrences(koiMaterialSource, "programId: 'koi_shadow'") !== 2
    || !floorMaterialSource.includes('vertexSrc: Filter.defaultVertexSrc')
    || !/createWaterEffectSpriteBinder\(\{\s*webGLVersion: renderer\.context\.webGLVersion,/u.test(canopyPresentationSource)
    || !/new ZenBenthicMaterialFilter\(\{\s*webGLVersion,/u.test(graphLifecycleSource)
    || !plantSyncSource.includes('new ZenDecorShadowMesh(webGLVersion)')
    || !plantSyncSource.includes('new ZenDecorMaterialMesh(rockTextureRecord, webGLVersion)')
    || !plantSyncSource.includes('new ZenDecorMaterialMesh(lilyTextureRecord, webGLVersion)')
    || !plantSyncSource.includes('new ZenDecorMaterialMesh(waterLilyTextureRecord, webGLVersion)')
    || !koiDisplaySource.includes('new ZenKoiShadowRope(textures.body, shadowPoints, webGLVersion)')
    || !koiDisplaySource.includes('new ZenKoiShadowTail(Texture.EMPTY, webGLVersion)')
  ) {
    fail('Four declared Pond material owners must receive only the actual scene/presentation WebGL version and validate their equivalent source interface before local allocation. WebGL1 raw pairs/default Filter vertex, effective precision, equations, native Shader/Filter compilation/reflection/cache, geometry/draw and texture lifetimes remain unchanged. Arbitrary sources, private compiler/cache owners, queries, global settings, inferred versions and retries are forbidden.');
  }

  const ownedShaderDialectSource = await readUtf8('src/themes/plugins/zen/runtime/pixi/zenPixiOwnedShaderDialect.js');
  const ownedShaderSites = [
    ['shoji', 'src/themes/plugins/zen/presentation/artifacts/engine/zenShojiScene.js', 'new Container()'],
    ['great_wave', 'src/themes/plugins/zen/presentation/artifacts/engine/zenGreatWaveScene.js', 'new Container()'],
    ['shishi_water', 'src/themes/plugins/zen/presentation/artifacts/engine/zenShishiOdoshiScene.js', 'new Container()'],
    ['bonsai_paper', 'src/themes/plugins/zen/runtime/pixi/zenBonsaiPaperFilter.js', 'new Filter('],
    ['water_surface_comparison', 'src/themes/plugins/zen/pond/renderers/pixi/pixiWaterSurfaceFilter.js', 'super(sources.vertex, sources.fragment)'],
    ['benthic_caustic_comparison', 'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/ZenWaterBenthicCausticOverlay.js', 'new Geometry()'],
  ];
  if (
    /^\s*(?:import|export\s+.*\s+from)\b/mu.test(ownedShaderDialectSource)
    || forbiddenCanopyShaderOwnerPattern.test(ownedShaderDialectSource)
    || !ownedShaderDialectSource.includes('export const requireZenPixiOwnedShaderWebGLVersion')
    || !ownedShaderDialectSource.includes('export const resolveZenPixiOwnedShaderSources')
    || !ownedShaderDialectSource.includes('ZEN_PIXI_OWNED_SHADER_WEBGL_VERSION_INVALID')
    || !ownedShaderDialectSource.includes('ZEN_PIXI_OWNED_SHADER_PROGRAM_INVALID')
    || !ownedShaderDialectSource.includes('ZEN_PIXI_OWNED_SHADER_SOURCE_INVALID')
    || !/webGLVersion\s*!==\s*1\s*&&\s*webGLVersion\s*!==\s*2/u.test(ownedShaderDialectSource)
    || /webGLVersion\s*(?:=(?!=)|\?\?|\|\|)/u.test(ownedShaderDialectSource)
    || !ownedShaderDialectSource.includes('Object.hasOwn(PROGRAMS, programId)')
    || !ownedShaderDialectSource.includes("typeof programId !== 'string'")
    || [...ownedShaderDialectSource.matchAll(/^\s{4}\w+: Object\.freeze\(\{/gmu)].length !== 6
    || ownedShaderSites.some(([id]) => !ownedShaderDialectSource.includes(`${id}: Object.freeze({`))
    || !ownedShaderDialectSource.includes('descriptor.filter ? null : vertexSrc')
    || !ownedShaderDialectSource.includes("fragmentPrecision: 'mediump'")
    || !ownedShaderDialectSource.includes('layout(location = 0) out vec4')
    || !/#version\s+300\s+es/u.test(ownedShaderDialectSource)
  ) {
    fail('Six declared additional Zen shader owners may select only validated equivalent source dialects from their actual context. The helper is pure/import-free and keeps native Filter null vertices and authored precision including Shishi mediump; compiler/reflection/cache, GL queries, global settings, fallback and retry owners are forbidden.');
  }
  // Scene factories may unwind their own resources and rethrow an original
  // failure. This is separate from forbidden compiler/cache/query ownership;
  // the pure source helper above still forbids catches and source retry paths.
  const forbiddenAdditionalShaderCompilerPattern = /\b(?:GLProgram|ProgramCache|ShaderSystem|compileShader|linkProgram|bindAttribLocation|getExtension|getParameter|getProgramParameter|getActiveAttrib|getActiveUniform|getUniformLocation|glPrograms|programCache|attributeData|uniformData)\b|\bnew\s+Program\b|\bProgram\.(?:from|defaultVertexPrecision|defaultFragmentPrecision)\b|\b(?:Program|Shader|Filter|Renderer|BatchRenderer|TilingSpriteRenderer)\.prototype\b|\.prototype(?:\s*\.\s*[\w$]+|\s*\[[^\]\r\n]*\])*\s*(?:=(?!=)|\+=|-=|\+\+|--)|\bObject\.(?:assign|defineProperty|defineProperties|setPrototypeOf)\s*\([^,\r\n]*\.prototype|\bsettings\s*\./u;
  const shishiOwnedFailureCleanup = /\}\s*catch\s*\(\s*(?<failure>[A-Za-z_$][\w$]*)\s*\)\s*\{\s*root\.destroy\(\{\s*children\s*:\s*true\s*\}\)\s*;\s*shaders\.forEach\(\s*shader\s*=>\s*shader\.destroy\(\)\s*\)\s*;\s*throw\s+\k<failure>\s*;\s*\}/u;
  await Promise.all(ownedShaderSites.map(async ([programId, relativePath, allocation]) => {
    const source = await readUtf8(relativePath);
    const selection = source.indexOf('resolveZenPixiOwnedShaderSources({');
    const allocated = source.indexOf(allocation);
    if (forbiddenAdditionalShaderCompilerPattern.test(source)
        || !source.includes(`programId: '${programId}'`)
        || selection < 0 || allocated <= selection) {
      fail(`${relativePath} must select its fixed equivalent source from the explicit actual WebGL version before native resources, keeping compiler/reflection/cache ownership and existing allocation/lifetime intact.`);
    }
    if (programId === 'shishi_water'
        && ([...source.matchAll(/\bcatch\s*\(/gu)].length !== 1 || !shishiOwnedFailureCleanup.test(source))) {
      fail('Shishi construction failure must release its existing owned root children and local shaders, then rethrow the original failure. This lifecycle cleanup cannot return a substitute scene, swallow a shader failure or retry another source.');
    }
  }));
  const [artifactEngineSource, bonsaiG15Source] = await Promise.all([
    'src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactEngine.js',
    'src/themes/plugins/zen/runtime/pixi/createZenBonsaiG15PixiRenderer.js',
  ].map(readUtf8));
  if (!artifactEngineSource.includes('webGLVersion: renderer.context.webGLVersion')
      || !/createZenBonsaiPaperFilter\(\{\s*webGLVersion: application\.renderer\.context\.webGLVersion,/u.test(bonsaiG15Source)) {
    fail('Artifact scene factories and G15 paper Filter must receive the existing admitted renderer context version, without capability probes, defaults or a second renderer.');
  }

  console.log('[zen-pond-worker-runtime-boundary] PASS: worker, Pixi, environment, common shadow projection and static/live cache preserve their canonical ownership boundaries.');
};

main().catch((error) => {
  console.error('[zen-pond-worker-runtime-boundary] Unexpected error:', error);
  process.exit(1);
});
