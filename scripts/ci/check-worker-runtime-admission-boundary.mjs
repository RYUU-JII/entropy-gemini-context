#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { WORKER_RUNTIME_CONTEXT } from '../../src/platform/workers/runtime/types.js';
import {
  WORKER_RUNTIME_SURFACE_IDS,
  WORKER_RUNTIME_SURFACE_KIND,
  WORKER_RUNTIME_SURFACE_STATUS,
  listWorkerRuntimeSurfaces,
  requireWorkerRuntimeSurface,
} from '../../src/platform/workers/runtime/WorkerRuntimeRegistry.js';

const rootDir = process.cwd();
const ADMITTED_SESSION_PATH = 'src/platform/workers/runtime/AdmittedWorkerRuntimeSession.js';
const ADMISSION_CONTROLLER_PATH = 'src/platform/workers/runtime/WorkerRuntimeAdmissionController.js';
const REQUEST_CLIENT_PATH = 'src/platform/workers/runtime/WorkerRequestClient.js';
const REGISTRY_PATH = 'src/platform/workers/runtime/WorkerRuntimeRegistry.js';
const ZEN_HOME_SESSION_OWNER_PATH = 'src/themes/plugins/zen/runtime/worker/ZenHomeRendererWorkerSession.js';
const ZEN_HOME_WORKER_ENTRY_PATH = 'src/themes/plugins/zen/runtime/worker/zenHomeRenderer.worker.js';
const ZEN_HOME_WORKER_PROTOCOL_PATH = 'src/themes/plugins/zen/runtime/worker/zenHomeRendererWorkerProtocol.js';
const ZEN_POND_WORKER_PATH = 'src/themes/plugins/zen/pond/renderers/worker/zenPondRenderer.worker.js';
const ZEN_POND_RENDERER_MODULE_ADMISSION_PATH = 'src/themes/plugins/zen/pond/renderers/worker/core/zenPondRendererModuleAdmission.js';
const ZEN_BONSAI_WORKER_PATH = 'src/themes/plugins/zen/runtime/worker/zenBonsaiRenderer.worker.js';
const ZEN_BONSAI_RENDERER_BACKEND_PATH = 'src/themes/plugins/zen/runtime/worker/renderers/createBonsaiWorkerRendererBackend.js';
const ZEN_BONSAI_PIXI_RENDERER_MODULE_ADMISSION_PATH = 'src/themes/plugins/zen/runtime/worker/renderers/zenBonsaiPixiRendererModuleAdmission.js';
const ZEN_PIXI_WORKER_ENVIRONMENT_PATH = 'src/themes/plugins/zen/runtime/worker/zenPixiWorkerEnvironment.js';
const ZEN_POND_WORKER_ENGINE_LIFECYCLE_PATH = 'src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerEngineLifecycle.js';
const ZEN_POND_WORKER_CANVAS_LIFECYCLE_PATH = 'src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerCanvasLifecycle.js';
const ZEN_POND_WORKER_CONTROL_RUNTIME_HANDLERS_PATH = 'src/themes/plugins/zen/pond/renderers/worker/core/createZenPondWorkerControlRuntimeHandlers.js';
const ZEN_POND_PIXI_SCENE_PATH = 'src/themes/plugins/zen/pond/renderers/pixi/ZenPixiSceneRenderer.js';
const ZEN_POND_PIXI_TEXTURE_FACTORIES_PATH = 'src/themes/plugins/zen/pond/renderers/pixi/pixiSceneTextureFactories.js';
const ZEN_POND_PIXI_VIEWPORT_PATH = 'src/themes/plugins/zen/pond/renderers/pixi/zenPixiSceneViewport.js';
const ZEN_POND_CLIENT_PATH = 'src/themes/plugins/zen/pond/control/runtimeClient/createZenPondWorkerRuntimeClientCore.js';
const ZEN_BONSAI_CLIENT_PATH = 'src/themes/plugins/zen/runtime/worker/ZenBonsaiWorkerRendererClient.js';
const GUARDED_SURFACES = Object.freeze(listWorkerRuntimeSurfaces({
  context: WORKER_RUNTIME_CONTEXT.UI,
  status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
}));
const SURFACE_CONSTANT_BY_ID = new Map(
  Object.entries(WORKER_RUNTIME_SURFACE_IDS).map(([key, value]) => [value, key]),
);

const fail = (message) => {
  console.error(`[worker-runtime-admission-boundary] FAIL: ${message}`);
  process.exitCode = 1;
};

const readProjectFile = (relativePath) => {
  const absolutePath = path.resolve(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Required file is missing: ${relativePath}.`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readBalancedSource = (source, openIndex, openChar, closeChar) => {
  if (source[openIndex] !== openChar) return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex, index + 1);
      }
    }
  }
  return null;
};

const collectProjectSourceFiles = (directoryPath) => {
  const files = [];
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectProjectSourceFiles(entryPath));
      continue;
    }
    if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
};

const projectSourceFiles = collectProjectSourceFiles(path.resolve(rootDir, 'src'));

const findStaticWorkerConstructors = (surface) => {
  const scriptBaseName = path.posix.basename(surface.scriptPath);
  const constructorPattern = new RegExp(
    `\\bnew\\s+Worker\\s*\\(\\s*new\\s+URL\\s*\\(\\s*['\"][^'\"]*${escapeRegExp(scriptBaseName)}['\"]`,
    'g',
  );
  return projectSourceFiles.flatMap((absolutePath) => {
    const source = fs.readFileSync(absolutePath, 'utf8');
    const matches = source.match(constructorPattern) || [];
    return matches.map(() => path.relative(rootDir, absolutePath).split(path.sep).join('/'));
  });
};

const assertAdmittedWorkerConstruction = (surface) => {
  const source = readProjectFile(surface.ownerPath);
  if (!source) return;
  const constructorCount = (source.match(/\bnew\s+Worker\s*\(/g) || []).length;
  const admittedConstructorPattern = /createAdmittedWorkerRuntimeSession\s*\(\s*\{[\s\S]*?createWorker\s*:\s*\(\)\s*=>\s*new\s+Worker\s*\(\s*new\s+URL\s*\(/;

  if (!source.includes('createAdmittedWorkerRuntimeSession')) {
    fail(`${surface.id} owner does not import/use the admitted worker session.`);
  }
  if (constructorCount !== 1) {
    fail(`${surface.id} owner must have exactly one statically auditable Worker constructor; found ${constructorCount}.`);
  }
  if (!admittedConstructorPattern.test(source)) {
    fail(`${surface.id} Worker constructor is not nested in createAdmittedWorkerRuntimeSession().`);
  }
  if (/resolveWorkerRuntimeBudget|\bWorkerPool\b/.test(source)) {
    fail(`${surface.id} owner interprets a local worker budget/pool outside the admission controller.`);
  }

  const constructorOwners = findStaticWorkerConstructors(surface);
  if (constructorOwners.length !== 1 || constructorOwners[0] !== surface.ownerPath) {
    fail(
      `${surface.id} Worker script must have exactly one static constructor at ${surface.ownerPath}; `
      + `found ${constructorOwners.length}: ${constructorOwners.join(', ') || 'none'}.`,
    );
  }
};

const assertAdmittedRequestWorkerConstruction = (surface) => {
  const source = readProjectFile(surface.ownerPath);
  if (!source) return;
  const surfaceConstant = SURFACE_CONSTANT_BY_ID.get(surface.id);
  if (!surfaceConstant) {
    fail(`${surface.id} is missing a WORKER_RUNTIME_SURFACE_IDS constant.`);
    return;
  }

  const clientConstructors = Array.from(
    source.matchAll(/\bnew\s+WorkerRequestClient\s*\(/g),
  );
  if (clientConstructors.length !== 1) {
    fail(`${surface.id} request owner must have exactly one WorkerRequestClient construction; found ${clientConstructors.length}.`);
    return;
  }
  const clientOpenIndex = source.indexOf('(', clientConstructors[0].index);
  const clientCall = readBalancedSource(source, clientOpenIndex, '(', ')');
  if (!clientCall) {
    fail(`${surface.id} request owner has an unreadable WorkerRequestClient construction.`);
    return;
  }

  const configCalls = Array.from(
    clientCall.matchAll(/\bcreateWorkerRequestClientConfig\s*\(/g),
  );
  if (configCalls.length !== 1) {
    fail(`${surface.id} request client must contain exactly one canonical config call; found ${configCalls.length}.`);
    return;
  }
  const configOpenIndex = clientCall.indexOf('(', configCalls[0].index);
  const configCall = readBalancedSource(clientCall, configOpenIndex, '(', ')');
  const surfacePattern = new RegExp(
    `^\\(\\s*WORKER_RUNTIME_SURFACE_IDS\\.${escapeRegExp(surfaceConstant)}\\s*,`,
  );
  if (!configCall || !surfacePattern.test(configCall)) {
    fail(`${surface.id} request client is not bound to WORKER_RUNTIME_SURFACE_IDS.${surfaceConstant}.`);
    return;
  }

  const factoryMatches = Array.from(
    configCall.matchAll(/\bworkerFactory\s*:\s*([A-Za-z_$][\w$]*)/g),
  );
  if (factoryMatches.length !== 1) {
    fail(`${surface.id} request config must bind exactly one named workerFactory; found ${factoryMatches.length}.`);
    return;
  }
  const factoryName = factoryMatches[0][1];
  const factoryDefinitionPattern = new RegExp(
    `\\bconst\\s+${escapeRegExp(factoryName)}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{`,
  );
  const factoryDefinition = factoryDefinitionPattern.exec(source);
  if (!factoryDefinition) {
    fail(`${surface.id} workerFactory ${factoryName} must be a statically auditable local factory.`);
    return;
  }
  const factoryOpenIndex = source.indexOf('{', factoryDefinition.index);
  const factoryBody = readBalancedSource(source, factoryOpenIndex, '{', '}');
  const workerConstructors = factoryBody
    ? Array.from(factoryBody.matchAll(/\breturn\s+new\s+([A-Za-z_$][\w$]*)\s*\(/g))
    : [];
  if (workerConstructors.length !== 1) {
    fail(`${surface.id} workerFactory must return exactly one imported Worker constructor; found ${workerConstructors.length}.`);
    return;
  }

  const workerConstructorName = workerConstructors[0][1];
  const ownerConstructorCount = Array.from(source.matchAll(new RegExp(
    `\\bnew\\s+${escapeRegExp(workerConstructorName)}\\s*\\(`,
    'g',
  ))).length;
  if (ownerConstructorCount !== 1) {
    fail(`${surface.id} owner must construct ${workerConstructorName} exactly once; found ${ownerConstructorCount}.`);
  }
  const workerImportPattern = new RegExp(
    `\\bimport\\s+${escapeRegExp(workerConstructorName)}\\s+from\\s+['\"]([^'\"]+)['\"]`,
  );
  const workerImport = workerImportPattern.exec(source);
  if (!workerImport) {
    fail(`${surface.id} constructor ${workerConstructorName} must be a default imported Worker module.`);
  } else {
    const moduleSpecifier = workerImport[1];
    const moduleImportPattern = new RegExp(
      `\\bimport\\s+[A-Za-z_$][\\w$]*\\s+from\\s+['\"]${escapeRegExp(moduleSpecifier)}['\"]`,
    );
    const moduleOwners = projectSourceFiles
      .filter((absolutePath) => moduleImportPattern.test(fs.readFileSync(absolutePath, 'utf8')))
      .map((absolutePath) => path.relative(rootDir, absolutePath).split(path.sep).join('/'));
    if (moduleOwners.length !== 1 || moduleOwners[0] !== surface.ownerPath) {
      fail(`${surface.id} Worker module ${moduleSpecifier} must be imported only by ${surface.ownerPath}; found ${moduleOwners.join(', ') || 'none'}.`);
    }
  }

  const directConstructorOwners = findStaticWorkerConstructors(surface);
  if (directConstructorOwners.length > 0) {
    fail(`${surface.id} request Worker script also has direct Worker constructors: ${directConstructorOwners.join(', ')}.`);
  }
  if (/resolveWorkerRuntimeBudget|\bWorkerPool\b/.test(source)) {
    fail(`${surface.id} request owner interprets a local worker budget/pool outside the admission controller.`);
  }
};

const assertUnifiedZenHomeRendererTopology = () => {
  const homeSurface = requireWorkerRuntimeSurface(WORKER_RUNTIME_SURFACE_IDS.ZEN_HOME_RENDERER);
  if (homeSurface.ownerPath !== ZEN_HOME_SESSION_OWNER_PATH) {
    fail(`zen_home_renderer owner must be ${ZEN_HOME_SESSION_OWNER_PATH}; found ${homeSurface.ownerPath}.`);
  }
  if (homeSurface.scriptPath !== ZEN_HOME_WORKER_ENTRY_PATH) {
    fail(`zen_home_renderer entry must be ${ZEN_HOME_WORKER_ENTRY_PATH}; found ${homeSurface.scriptPath}.`);
  }
  for (const retiredSurfaceId of ['zen_pond_renderer', 'zen_bonsai_renderer']) {
    if (GUARDED_SURFACES.some((surface) => surface.id === retiredSurfaceId)) {
      fail(`${retiredSurfaceId} must not return as an independently admitted physical surface.`);
    }
  }

  const homeOwnerSource = readProjectFile(ZEN_HOME_SESSION_OWNER_PATH);
  const homeEntrySource = readProjectFile(ZEN_HOME_WORKER_ENTRY_PATH);
  const homeProtocolSource = readProjectFile(ZEN_HOME_WORKER_PROTOCOL_PATH);
  const pondWorkerSource = readProjectFile(ZEN_POND_WORKER_PATH);
  const pondRendererModuleAdmissionSource = readProjectFile(
    ZEN_POND_RENDERER_MODULE_ADMISSION_PATH,
  );
  const bonsaiWorkerSource = readProjectFile(ZEN_BONSAI_WORKER_PATH);
  const bonsaiRendererBackendSource = readProjectFile(ZEN_BONSAI_RENDERER_BACKEND_PATH);
  const bonsaiPixiRendererModuleAdmissionSource = readProjectFile(
    ZEN_BONSAI_PIXI_RENDERER_MODULE_ADMISSION_PATH,
  );
  const pixiWorkerEnvironmentSource = readProjectFile(ZEN_PIXI_WORKER_ENVIRONMENT_PATH);
  const pondWorkerEngineLifecycleSource = readProjectFile(ZEN_POND_WORKER_ENGINE_LIFECYCLE_PATH);
  const pondWorkerCanvasLifecycleSource = readProjectFile(
    ZEN_POND_WORKER_CANVAS_LIFECYCLE_PATH,
  );
  const pondWorkerControlRuntimeHandlersSource = readProjectFile(
    ZEN_POND_WORKER_CONTROL_RUNTIME_HANDLERS_PATH,
  );
  const pondPixiSceneSource = readProjectFile(ZEN_POND_PIXI_SCENE_PATH);
  const pondPixiTextureFactoriesSource = readProjectFile(
    ZEN_POND_PIXI_TEXTURE_FACTORIES_PATH,
  );
  const pondPixiViewportSource = readProjectFile(ZEN_POND_PIXI_VIEWPORT_PATH);
  const pondClientSource = readProjectFile(ZEN_POND_CLIENT_PATH);
  const bonsaiClientSource = readProjectFile(ZEN_BONSAI_CLIENT_PATH);

  for (const [label, source, requiredTokens] of [
    ['Zen Home session owner', homeOwnerSource, [
      'createAdmittedWorkerRuntimeSession',
      'acquireZenHomeRendererWorkerChannel',
      'createZenHomeRendererChannelEnvelope',
      'createZenHomeRendererChannelReleaseMessage',
      'createZenHomeRendererChannelPrepareMessage',
      'createZenHomeRendererDiagnosticsConfigureMessage',
      'createZenHomeRendererWorldPrepareMessage',
      'physicalGenerationSequence',
      'isCurrentPhysicalGeneration',
      'zen_home_worker:physical_session_created',
      'startupReservation',
      'preparePhysicalSession',
      'zen_home_renderer_channel_post_failed',
    ]],
    ['Zen Home worker entry', homeEntrySource, [
      'initializeZenPondRendererWorker',
      'initializeZenBonsaiRendererWorker',
      "import('../../pond/renderers/worker/zenPondRenderer.worker.js')",
      "import('./zenBonsaiRenderer.worker.js')",
      'zenPondRendererModuleAdmission.prepare()',
      'shouldPrepareBonsaiPixiRenderer',
      'zenBonsaiPixiRendererModuleAdmission.prepare()',
      'preparePondStartupRuntime',
      'loadPondRuntime',
      'loadBonsaiRuntime',
      'const prepareHomeWorldRuntimes',
      'ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT',
      'POND_RUNTIME_IMPORT_READY',
      'HOME_WORLD_PREPARE_READY',
      'isZenHomeRendererWorldPrepareMessage',
      'Promise.all([',
      'requireZenHomeRendererChannelEnvelope',
      'isZenHomeRendererChannelReleaseMessage',
      'isZenHomeRendererChannelPrepareMessage',
      'homeWorldRuntimePreparationPromise',
      'channelRuntime.dispose()',
      'channelSessionId',
      'messageChain',
      'self.reportError',
      'terminalError',
      'ensurePixiWorkerRuntimeEnvironment',
      'reportTerminalFailure(error)',
    ]],
    ['Zen Home worker protocol', homeProtocolSource, [
      'ZEN_HOME_RENDERER_CHANNEL',
      'channelSessionId',
      'zen_home_renderer_channel',
      'zen_home_renderer_channel_release',
      'zen_home_renderer_channel_prepare',
      'zen_home_renderer_diagnostics_configure',
      'zen_home_renderer_diagnostic',
      'zen_home_renderer_world_prepare',
    ]],
    ['Zen Pond client', pondClientSource, ['acquireZenHomeRendererWorkerChannel']],
    ['Zen Bonsai client', bonsaiClientSource, ['acquireZenHomeRendererWorkerChannel']],
    ['Zen Pond logical worker', pondWorkerSource, [
      'assertWorkerRuntimeEnvironment',
      'prepareZenPondRendererModules',
      'renderer_module_admission_start',
      'renderer_module_admission_end',
    ]],
    ['Zen Pond renderer module admission', pondRendererModuleAdmissionSource, [
      "import('../../pixi/ZenPixiSceneRenderer.js')",
      "import('../../pixi/pixiWaterEffectsLayer.js')",
      'Promise.all([',
      'ZEN_POND_RENDERER_MODULE_ADMISSION_FAILED',
    ]],
    ['Zen Bonsai logical worker', bonsaiWorkerSource, [
      'requirePixiWorkerRuntimeEnvironment',
      'zenBonsaiPixiRendererModuleAdmission.getSnapshot()',
      'rendererAdmissionLeadToInitMs',
    ]],
    ['Zen Bonsai renderer backend', bonsaiRendererBackendSource, [
      'zenBonsaiPixiRendererModuleAdmission.loadRendererFactory()',
    ]],
    ['Zen Bonsai Pixi renderer module admission', bonsaiPixiRendererModuleAdmissionSource, [
      "import('../../pixi/createPixiBonsaiRenderer.js')",
      'ZEN_BONSAI_PIXI_RENDERER_MODULE_ADMISSION_FAILED',
    ]],
    ['Zen Pond worker engine lifecycle', pondWorkerEngineLifecycleSource, [
      'devicePixelRatio: state.dpr',
    ]],
    ['Zen Pond worker control runtime', pondWorkerControlRuntimeHandlersSource, [
      'devicePixelRatio: runtimeState.dpr',
    ]],
    ['Zen Pond Pixi scene', pondPixiSceneSource, [
      'applyZenPixiSceneViewport({',
      'devicePixelRatio',
    ]],
    ['Zen Pond Pixi viewport owner', pondPixiViewportSource, [
      'renderer.resolution = nextResolution',
      'resolveZenPondRenderResolution({',
      'resolveZenPondWorldResolution({',
      'worldRenderTexture.setResolution(worldResolution)',
      'worldRenderTexture.resize(worldWidth, worldHeight, true)',
    ]],
    ['Zen Pond Pixi texture factories', pondPixiTextureFactoriesSource, [
      'ZEN_PIXI_SCENE_DEVICE_PIXEL_RATIO_INVALID',
      'numericDevicePixelRatio',
    ]],
  ]) {
    requiredTokens.forEach((token) => {
      if (!source.includes(token)) fail(`${label} is missing unified Home token ${token}.`);
    });
  }

  if (/^import\s+\{\s*initializeZenPondRendererWorker\s*\}/mu.test(homeEntrySource)) {
    fail(
      'Zen Home worker entry must keep the Pond logical runtime behind its channel-owned dynamic admission.',
    );
  }
  if (/^import\s+\{\s*initializeZenBonsaiRendererWorker\s*\}/mu.test(homeEntrySource)) {
    fail(
      'Zen Home worker entry must keep the Bonsai logical runtime behind its channel-owned dynamic admission.',
    );
  }

  const pixiEnvironmentInstallOwners = projectSourceFiles
    .filter((absolutePath) => fs.readFileSync(absolutePath, 'utf8').includes(
      'ensurePixiWorkerRuntimeEnvironment();',
    ))
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'));
  if (
    pixiEnvironmentInstallOwners.length !== 1
    || pixiEnvironmentInstallOwners[0] !== ZEN_HOME_WORKER_ENTRY_PATH
  ) {
    fail(
      `Pixi Worker environment must be installed only by ${ZEN_HOME_WORKER_ENTRY_PATH}; `
      + `found ${pixiEnvironmentInstallOwners.join(', ') || 'none'}.`,
    );
  }

  const mutableGlobalDprSources = projectSourceFiles
    .filter((absolutePath) => {
      const relativePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
      return (
        relativePath.startsWith('src/themes/plugins/zen/runtime/worker/')
        || relativePath.startsWith('src/themes/plugins/zen/pond/renderers/worker/')
        || relativePath.startsWith('src/themes/plugins/zen/pond/renderers/pixi/')
      );
    })
    .filter((absolutePath) => {
      const source = fs.readFileSync(absolutePath, 'utf8');
      return (
        source.includes('setPixiWorkerDevicePixelRatio')
        || /\b(?:globalThis|self|window)\.devicePixelRatio\b/.test(source)
      );
    })
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'));
  if (mutableGlobalDprSources.length > 0) {
    fail(
      'Zen Home renderer closure must not own mutable Worker-global devicePixelRatio state; '
      + `found ${mutableGlobalDprSources.join(', ')}.`,
    );
  }

  for (const [file, source] of [
    [ZEN_POND_WORKER_CANVAS_LIFECYCLE_PATH, pondWorkerCanvasLifecycleSource],
  ]) {
    if (
      /\bstate\.canvas\.(?:width|height)\s*=/.test(source)
    ) {
      fail(`${file} must leave Pond canvas backing-store ownership to the Pixi scene renderer.`);
    }
  }

  const selfMessageOwners = [
    [ZEN_HOME_WORKER_ENTRY_PATH, homeEntrySource],
    [ZEN_POND_WORKER_PATH, pondWorkerSource],
    [ZEN_BONSAI_WORKER_PATH, bonsaiWorkerSource],
  ].filter(([, source]) => /\bself\.(?:onmessage|postMessage)\b/.test(source));
  if (
    selfMessageOwners.length !== 1
    || selfMessageOwners[0][0] !== ZEN_HOME_WORKER_ENTRY_PATH
  ) {
    fail(
      'Zen Home physical worker messaging must have exactly one self owner at '
      + `${ZEN_HOME_WORKER_ENTRY_PATH}; found ${selfMessageOwners.map(([file]) => file).join(', ') || 'none'}.`,
    );
  }

  for (const [clientPath, source] of [
    [ZEN_POND_CLIENT_PATH, pondClientSource],
    [ZEN_BONSAI_CLIENT_PATH, bonsaiClientSource],
  ]) {
    if (/\bnew\s+Worker\s*\(|createAdmittedWorkerRuntimeSession/.test(source)) {
      fail(`${clientPath} must not construct or independently admit a physical renderer Worker.`);
    }
  }
};

const zenLocalAdmissionPolicyOwners = projectSourceFiles
  .filter((absolutePath) => absolutePath.includes('/src/themes/plugins/zen/'))
  .filter((absolutePath) => /resolveWorkerRuntimeBudget|\bWorkerPool\b/.test(
    fs.readFileSync(absolutePath, 'utf8'),
  ))
  .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\\\', '/'));
if (zenLocalAdmissionPolicyOwners.length > 0) {
  fail(`Zen runtime must not own WorkerPool/runtime-budget policy: ${zenLocalAdmissionPolicyOwners.join(', ')}.`);
}

const admissionSource = readProjectFile(ADMISSION_CONTROLLER_PATH);
const sessionSource = readProjectFile(ADMITTED_SESSION_PATH);
const requestClientSource = readProjectFile(REQUEST_CLIENT_PATH);
const registrySource = readProjectFile(REGISTRY_PATH);
if (admissionSource) {
  if (!admissionSource.includes('resolveWorkerRuntimeBudget')) {
    fail('Admission controller does not resolve the canonical runtime budget.');
  }
  if (!admissionSource.includes('requireWorkerRuntimeSurface')) {
    fail('Admission controller does not resolve canonical registry metadata.');
  }
  for (const token of ['groupCapacities', 'laneCapacities', 'activeByGroup', 'activeByLane']) {
    if (!admissionSource.includes(token)) {
      fail(`Admission controller does not enforce/expose canonical grouped lane budget token ${token}.`);
    }
  }
}
if (sessionSource) {
  const acquireIndex = sessionSource.indexOf('admissionController.acquire');
  const constructIndex = sessionSource.indexOf('worker = createWorker()');
  if (acquireIndex < 0 || constructIndex < 0 || acquireIndex > constructIndex) {
    fail('Admitted worker session must acquire a lease before invoking the Worker constructor.');
  }
  if (!sessionSource.includes('lease.release')) {
    fail('Admitted worker session does not own lease release.');
  }
}

if (requestClientSource) {
  for (const token of [
    'createAdmittedWorkerRuntimeSession',
    'this.admissionRequired',
    'this.releaseAdmissionOnIdle',
    'this.workerSession',
  ]) {
    if (!requestClientSource.includes(token)) {
      fail(`WorkerRequestClient does not own canonical UI request admission token ${token}.`);
    }
  }
}

if (registrySource) {
  for (const token of ['admissionRequired', 'releaseAdmissionOnIdle']) {
    if (!registrySource.includes(token)) {
      fail(`Worker request config does not protect canonical admission token ${token}.`);
    }
  }
}

assertUnifiedZenHomeRendererTopology();

for (const surface of GUARDED_SURFACES) {
  const surfaceId = surface.id;
  requireWorkerRuntimeSurface(surfaceId);
  const rank = Number(surface.admission?.rank);
  if (!Number.isFinite(rank)) {
    fail(`${surfaceId} is missing registry admission rank metadata.`);
    continue;
  }
  if (typeof surface.admission?.preemptible !== 'boolean') {
    fail(`${surfaceId} is missing registry preemptible metadata.`);
  }
  if (typeof surface.admission?.group !== 'string' || !surface.admission.group.trim()) {
    fail(`${surfaceId} is missing registry admission group metadata.`);
  }
  if (!Object.isFrozen(surface.admission)) {
    fail(`${surfaceId} registry admission metadata must be frozen.`);
  }
  if (surface.kind === WORKER_RUNTIME_SURFACE_KIND.REQUEST) {
    assertAdmittedRequestWorkerConstruction(surface);
  } else {
    assertAdmittedWorkerConstruction(surface);
  }
}

if (!process.exitCode) {
  console.log(`[worker-runtime-admission-boundary] PASS: all ${GUARDED_SURFACES.length} active UI Worker surfaces are admission-owned.`);
}
