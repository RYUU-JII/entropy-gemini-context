import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  launchQaPlaywrightBrowser,
  readQaPlaywrightBrowserReceipt,
} from '../browser/qaPlaywrightBrowserOwner.mjs';
import { QA_RUN_STATUSES } from '../contracts/qaTargetContract.mjs';
import { createZenCherryPlumeLiveSourceLease } from './zenCherryPlumeLiveSourceLease.mjs';

const API = '__ZEN_CHERRY_PLUME_LIVE_QA__';
const PROTOCOL_SOURCE_SHA256 = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const serializeError = error => ({ name: error.name, message: error.message,
  code: error.code || null, stack: error.stack });

export async function executeQaProtocol({ plan, artifact, browser, evidence,
  attachmentsDir, signal, reportBrowserGpuCapability, registerCleanup }) {
  if (artifact?.id !== 'source_render') throw Error('QA_PLUME_SOURCE_RENDER_REQUIRED');
  if (browser?.processOwnership !== 'owned' || !browser.chrome) throw Error('QA_PLUME_OWNED_BROWSER_REQUIRED');
  const outputDir = path.join(attachmentsDir, 'cherry-plume-live');
  await mkdir(outputDir, { recursive: true });
  const report = { contract: plan.protocolOptions.contract, targetId: plan.targetId,
    protocolSourceSha256: PROTOCOL_SOURCE_SHA256,
    sourceHash: plan.parameters.source, seed: plan.parameters.seed,
    interpretation: 'Detached source-pinned WebGL/Canvas render, shared flower material, natural-frame growth playback and research-control contract. Shared flowers intentionally approximate the procedural petal painter; same-candidate Canvas/Pixi parity remains required. Wind is a shared rigid root transform; this does not certify hierarchical branch motion, product/worker integration, physical GPU or FPS.',
    startedAt: new Date().toISOString(), status: 'running', cases: [], assertions: [], captures: [],
    diagnostics: { consoleErrors: [], pageErrors: [], requestFailures: [] },
    cleanup: { browser: 'not_acquired', context: 'not_acquired', server: 'not_acquired' } };
  registerCleanup('zen_cherry_plume_live_resources', async () => {
    if (['browser', 'context', 'server'].some(name => !['not_acquired', 'released'].includes(report.cleanup[name]))) {
      throw Error('QA_PLUME_RESOURCE_CLEANUP_UNPROVEN');
    }
    return { status: 'released', resources: report.cleanup };
  });
  let source = null, ownedBrowser = null, context = null, page = null, failure = null;
  const assert = (condition, code, detail = null) => {
    report.assertions.push({ code, passed: Boolean(condition), detail });
    if (!condition) {
      const error = new Error(`${code}${detail === null ? '' : `:${JSON.stringify(detail)}`}`);
      error.code = code; throw error;
    }
  };
  const capture = async name => {
    const filename = path.join(outputDir, `${name}.png`);
    await page.screenshot({ path: filename, fullPage: true, animations: 'disabled' });
    report.captures.push({ name, path: filename });
  };
  const call = async (method, argument = null) => {
    signal?.throwIfAborted();
    return page.evaluate(async ({ name, method, argument }) => {
      const api = window[name];
      if (!api || typeof api[method] !== 'function') throw Error(`QA_PLUME_API_METHOD:${method}`);
      return api[method](argument);
    }, { name: API, method, argument });
  };
  const assertSharedFlowerAtlas = (receipt, name) => {
    const renderer = receipt.renderer;
    assert(renderer.flowerAtlasCount === 1 && renderer.flowerAtlasTileCount === 24
      && renderer.flowerAtlasBytes === 512 * 256 * 4
      && renderer.flowerAtlasBakeCount === 1 && renderer.flowerAtlasUploadCount === 1
      && renderer.flowerAtlasAllocationCount === 1,
    'QA_PLUME_SHARED_FLOWER_ATLAS_RETAINED', {
      name, count: renderer.flowerAtlasCount, tileCount: renderer.flowerAtlasTileCount,
      bytes: renderer.flowerAtlasBytes, bakes: renderer.flowerAtlasBakeCount,
      uploads: renderer.flowerAtlasUploadCount, allocations: renderer.flowerAtlasAllocationCount,
    });
    assert(renderer.textureCount === renderer.woodTextureCount + renderer.flowerAtlasCount
      && renderer.textureBytes <= 64 * 1024 * 1024,
    'QA_PLUME_COMBINED_TEXTURE_BUDGET', {
      name, textureCount: renderer.textureCount, woodTextureCount: renderer.woodTextureCount,
      textureBytes: renderer.textureBytes, flowerAtlasBytes: renderer.flowerAtlasBytes,
    });
  };
  const developmentCounts = receipt => {
    const development = receipt.snapshot.live.development;
    if (!development?.wood || !Array.isArray(development.flower?.flowers)) throw Error('QA_PLUME_DEVELOPMENT_RECEIPT');
    const flowers = development.flower.flowers;
    return { wood: development.wood, flower: {
      total: flowers.length,
      dormant: flowers.filter(row => row.stage === 'dormant').length,
      swelling: flowers.filter(row => row.stage === 'swelling').length,
      opening: flowers.filter(row => row.stage === 'opening').length,
      full: flowers.filter(row => row.stage === 'full').length,
      visibleBuds: flowers.filter(row => row.alpha > 0 && row.budOpacity > 0).length,
      visiblePetals: flowers.filter(row => row.alpha > 0 && row.petalOpacity > 0).length,
      meanProgress: flowers.length ? flowers.reduce((total, row) => total + row.progress, 0) / flowers.length : 0,
    } };
  };
  const observe = async (name, method, argument) => {
    const startedAt = Date.now();
    const receipt = await call(method, argument);
    report.cases.push({ name, elapsedMs: Date.now() - startedAt, receipt, development: developmentCounts(receipt) });
    assert(receipt.sourceHash === plan.parameters.source, 'QA_PLUME_RECEIPT_SOURCE', name);
    assert(receipt.state.seed === plan.parameters.seed, 'QA_PLUME_RECEIPT_SEED', name);
    assert(receipt.renderer.backend === 'pixi-webgl', 'QA_PLUME_WEBGL_RENDERER', name);
    assertSharedFlowerAtlas(receipt, name);
    if(method==='resize'){
      const expectedWidth=argument.width/argument.pixelRatio,expectedHeight=argument.height/argument.pixelRatio;
      assert(Math.abs(receipt.canvas.cssWidth-expectedWidth)<.02&&Math.abs(receipt.canvas.cssHeight-expectedHeight)<.02
        &&Math.abs(receipt.canvas.pixiCssWidth-expectedWidth)<.02&&Math.abs(receipt.canvas.pixiCssHeight-expectedHeight)<.02,
      'QA_PLUME_CSS_BACKING_SCALE',receipt.canvas);
    }
    return receipt;
  };
  const parity = async name => {
    const receipt = await call('comparePixels');
    report.cases.push({ name, parity: receipt });
    assert(Number.isFinite(receipt.meanAbsoluteError) && receipt.meanAbsoluteError <= 2,
      'QA_PLUME_PIXEL_MEAN_ERROR', receipt);
    assert(Number.isFinite(receipt.differingPixelFraction) && receipt.differingPixelFraction <= .02,
      'QA_PLUME_PIXEL_DIFFERENCE_AREA', receipt);
    assert(receipt.referencePaintedPixels > 100 && receipt.pixiPaintedPixels > 100,
      'QA_PLUME_NONEMPTY_SURFACE', receipt);
    assert(receipt.referenceInkPixels > 10 && receipt.pixiInkPixels > 10,
      'QA_PLUME_VISIBLE_TREE_INK', receipt);
    assert(receipt.rasterContext.willReadFrequently === true,
      'QA_PLUME_EXPLICIT_READBACK_CONTEXT', receipt.rasterContext);
    return receipt;
  };
  const assertPlaybackBounded = (receipt, name) => {
    const playback = receipt.playback;
    assert(playback && Number.isInteger(playback.framesCommitted)
      && Number.isInteger(playback.tickCount) && Number.isInteger(playback.maxInFlight)
      && playback.maxInFlight >= 0 && playback.maxInFlight <= 1
      && typeof playback.inFlight === 'boolean'
      && Number.isInteger(playback.pendingFrameCount)
      && playback.pendingFrameCount >= 0 && playback.pendingFrameCount <= 1,
    'QA_PLUME_PLAYBACK_BOUNDED_WORK', { name, playback });
    assert(receipt.renderer.textureBytes <= 64 * 1024 * 1024
      && receipt.renderer.textureCount <= 4,
    'QA_PLUME_PLAYBACK_TEXTURE_BUDGET', {
      name, textureBytes: receipt.renderer.textureBytes, textureCount: receipt.renderer.textureCount,
    });
  };
  const waitForPlayback = async (name, predicate) => {
    const startedAt = Date.now(), deadline = startedAt + 30_000;
    let receipt, samples = [], sampledFrame = -1, totalSampleCount = 0;
    do {
      receipt = await call('read');
      if (receipt.playback.framesCommitted !== sampledFrame || predicate(receipt)) {
        sampledFrame = receipt.playback.framesCommitted;
        totalSampleCount++;
        // Keep the entire journey represented without an unbounded evidence
        // array. Older points become sparser as later growth is observed.
        if (samples.length >= 60) samples = samples.filter((_, index) => index % 2 === 0);
        samples.push({ elapsedMs: Date.now() - startedAt,
          growth: receipt.state.growth, mode: receipt.snapshot.live.clock.mode,
          observedYear: receipt.snapshot.live.clock.observedYear,
          framesCommitted: receipt.playback.framesCommitted,
          tickCount: receipt.playback.tickCount,
          frameCostMs: receipt.playback.frameCostMs,
          frameTiming: receipt.frameTiming,
          lastUpdate: receipt.renderer.lastUpdate,
          textureBytes: receipt.renderer.textureBytes,
          flowerSpriteCount: receipt.renderer.flowerSpriteCount,
          flowerSpriteAllocationCount: receipt.renderer.flowerSpriteAllocationCount,
          flowerAtlasBakeCount: receipt.renderer.flowerAtlasBakeCount,
          flowerAtlasUploadCount: receipt.renderer.flowerAtlasUploadCount,
          development: developmentCounts(receipt),
        });
      }
      if (predicate(receipt)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    assert(predicate(receipt), 'QA_PLUME_PLAYBACK_NATURAL_PROGRESS', {
      name, playback: receipt.playback, growth: receipt.state.growth,
    });
    assertPlaybackBounded(receipt, name);
    assertSharedFlowerAtlas(receipt, name);
    report.cases.push({ name, elapsedMs: Date.now() - startedAt,
      receipt, samples, samplesOmitted: totalSampleCount - samples.length });
    return receipt;
  };
  try {
    source = await createZenCherryPlumeLiveSourceLease({ rootDir: plan.rootDir,
      studyPath: plan.protocolOptions.studyPath, sourceHash: plan.parameters.source });
    report.source = source.receipt; report.cleanup.server = 'owned';
    await evidence.event('QA_PLUME_SOURCE_CAPTURED', { sourceHash: plan.parameters.source,
      sourceFiles: source.receipt.files.length, port: source.receipt.port });
    ownedBrowser = await launchQaPlaywrightBrowser({ executablePath: browser.chrome,
      headless: plan.browserExecution.headless }, {
      ownerId: `qa-cherry-plume-live:pid=${process.pid}`, rootDir: plan.rootDir,
      executionPlan: plan.browserExecution, presentation: plan.browserExecution.presentation,
      audioPolicy: plan.browserExecution.audioPolicy, displayReceipt: browser.display,
      launchEnvironment: browser.launchEnvironment,
      renderingRequirement: plan.browserExecution.renderingRequirement,
    });
    report.cleanup.browser = 'owned';
    report.browser = { version: ownedBrowser.version(), owner: readQaPlaywrightBrowserReceipt(ownedBrowser) };
    if (report.browser.owner?.gpuCapability) await reportBrowserGpuCapability(report.browser.owner.gpuCapability);
    context = await ownedBrowser.newContext({ viewport: { width: 1180, height: 900 },
      deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light' });
    report.cleanup.context = 'owned';
    page = await context.newPage();
    page.setDefaultTimeout(120_000);
    page.on('console', message => { if (message.type() === 'error') report.diagnostics.consoleErrors.push(message.text()); });
    page.on('pageerror', error => report.diagnostics.pageErrors.push(serializeError(error)));
    page.on('requestfailed', request => report.diagnostics.requestFailures.push({ url: request.url(), failure: request.failure() }));
    const url = new URL(source.url);
    url.searchParams.set('seed', String(plan.parameters.seed));
    url.searchParams.set('source', plan.parameters.source);
    report.url = url.href;
    const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    assert(response?.status() === 200, 'QA_PLUME_HTTP_ENTRY', response?.status());
    await page.waitForFunction(name => Boolean(window[name]?.ready), API);
    await page.evaluate(async name => { await window[name].ready; }, API);
    const initial = await observe('initial', 'read');
    assert(initial.state.growth === 1 && initial.state.activation === 1 && initial.state.year === 3
      && initial.state.phase === 'spring' && initial.state.stage === .45
      && initial.state.yaw === 0 && initial.state.view === 'flowers' && initial.state.wind === 0
      && initial.state.woodStyle === 'continuous' && initial.state.flowerStyle === 'shared',
    'QA_PLUME_INITIAL_STATE', initial.state);
    await observe('qa-surface', 'resize', { width: 320, height: 400, pixelRatio: 1 });
    const mature = await observe('mature', 'read');
    assert(mature.snapshot.segments > 0 && mature.snapshot.flowers > 0, 'QA_PLUME_MATURE_ORGANS');
    assert(['woodFrameTextureCount', 'woodFrameTextureAllocationCount', 'transformUpdateCount', 'transformReuseCount']
      .every(key => Number.isInteger(mature.renderer[key]) && mature.renderer[key] >= 0)
      && mature.renderer.woodFrameTextureCount > 0 && mature.renderer.transformUpdateCount > 0,
    'QA_PLUME_RENDER_RESOURCE_COUNTERS', mature.renderer);
    const maturePixels = await parity('mature-parity');
    await capture('01-mature');
    const sameSurface = await observe('same-size-plan-reuse', 'resize', { width: 320, height: 400, pixelRatio: 1 });
    assert(sameSurface.renderer.lastUpdate.kind === 'reuse'
      && sameSurface.renderer.lastUpdate.paintedRuns === 0
      && sameSurface.renderer.lastUpdate.updatedAtlases === 0
      && sameSurface.renderer.lastUpdate.allocatedAtlases === 0,
    'QA_PLUME_IDENTICAL_PLAN_REUSES_PAINT', sameSurface.renderer.lastUpdate);
    assert(sameSurface.renderer.rebakeCount === mature.renderer.rebakeCount
      && sameSurface.renderer.textureAllocationCount === mature.renderer.textureAllocationCount
      && sameSurface.renderer.spriteAllocationCount === mature.renderer.spriteAllocationCount
      && sameSurface.renderer.flowerSpriteAllocationCount === mature.renderer.flowerSpriteAllocationCount,
    'QA_PLUME_IDENTICAL_PLAN_REUSES_RESOURCES');
    assert(sameSurface.renderer.woodFrameTextureAllocationCount === mature.renderer.woodFrameTextureAllocationCount
      && sameSurface.renderer.woodFrameTextureCount === mature.renderer.woodFrameTextureCount,
    'QA_PLUME_IDENTICAL_PLAN_REUSES_FRAME_TEXTURES');
    // The only-wind API path renders at time=0. Both calls must use the exact
    // same time: zero wind at different times can still produce signed zeros.
    const transformRest = await observe('transform-rest', 'set', { wind: 0 });
    const transformRepeat = await observe('transform-rest-repeat', 'set', { wind: 0 });
    assert(transformRepeat.renderer.transformUpdateCount === transformRest.renderer.transformUpdateCount
      && transformRepeat.renderer.lastTransformUpdate.updatedSprites === 0
      && transformRepeat.renderer.lastTransformUpdate.reusedSprites === transformRepeat.renderer.spriteCount
      && transformRepeat.renderer.transformReuseCount > transformRest.renderer.transformReuseCount,
    'QA_PLUME_IDENTICAL_RENDER_REUSES_TRANSFORMS', transformRepeat.renderer.lastTransformUpdate);

    const proceduralFlowers = await observe('flowers-procedural', 'set', { flowerStyle: 'procedural' });
    assert(proceduralFlowers.plan.flowerStyle === 'procedural'
      && proceduralFlowers.plan.flowerSprites === 0,
    'QA_PLUME_PROCEDURAL_FLOWER_COMPARISON');
    await parity('flowers-procedural-parity');
    await capture('flowers-procedural');
    await page.locator('#flowerStyle').selectOption('shared');
    await page.waitForFunction(() => new URL(location.href).searchParams.get('flowerStyle') === 'shared'
      && document.querySelector('#workspace').dataset.state === 'ready');
    const sharedFlowers = await observe('flowers-shared-via-ui', 'read');
    assert(sharedFlowers.plan.flowerStyle === 'shared' && sharedFlowers.plan.flowerSprites > 0
      && sharedFlowers.renderer.flowerSpriteCount === sharedFlowers.plan.flowerSprites,
    'QA_PLUME_SHARED_FLOWER_SPRITES_APPLIED');
    assert(sharedFlowers.snapshot.woodHash === proceduralFlowers.snapshot.woodHash
      && sharedFlowers.snapshot.flowerRestHash === proceduralFlowers.snapshot.flowerRestHash,
    'QA_PLUME_FLOWER_STYLE_PRESERVES_STRUCTURE');
    assert(sharedFlowers.plan.commands < proceduralFlowers.plan.commands * .5,
      'QA_PLUME_SHARED_FLOWER_COMMAND_REDUCTION', {
        shared: sharedFlowers.plan.commands, procedural: proceduralFlowers.plan.commands,
      });
    const sharedFlowerPixels = await parity('flowers-shared-parity');
    assert(sharedFlowerPixels.referenceHash === maturePixels.referenceHash,
      'QA_PLUME_SHARED_FLOWER_RETURN_IDENTITY');
    await capture('flowers-shared');
    report.cases.push({ name: 'flower-material-comparison',
      procedural: { plan: proceduralFlowers.plan, frameTiming: proceduralFlowers.frameTiming },
      shared: { plan: sharedFlowers.plan, frameTiming: sharedFlowers.frameTiming },
      commandRatio: sharedFlowers.plan.commands / proceduralFlowers.plan.commands,
      interpretation: 'Same tree and observation; shared flowers are an intentional material approximation. Frame costs are recorded without a hard timing threshold; Canvas/Pixi parity compares each candidate with itself.',
    });

    const annualTarget = mature.snapshot.live.clock.annualTarget;
    let previousDevelopment = null;
    for (const [name, local] of [['bud', 0], ['swelling', .08], ['opening', .16], ['full', .25]]) {
      const growth = .62 + .38 * (4.5 + local) / annualTarget;
      const developing = await observe(`development-${name}`, 'set', { growth });
      const counts = developmentCounts(developing).flower;
      assert(counts.total === mature.snapshot.flowers
        && developing.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
      'QA_PLUME_DEVELOPMENT_PRESERVES_FLOWER_REST', { name, counts });
      if (previousDevelopment) assert(counts.meanProgress >= previousDevelopment.meanProgress,
        'QA_PLUME_FLOWER_DEVELOPMENT_ADVANCES', { name, counts, previous: previousDevelopment });
      if (name === 'bud') assert(counts.dormant === counts.total && counts.visiblePetals === 0,
        'QA_PLUME_FLOWER_DEVELOPMENT_STARTS_CLOSED', counts);
      if (name === 'swelling') assert(counts.visibleBuds > 0
        && [counts.dormant, counts.swelling, counts.opening, counts.full].filter(count => count > 0).length > 1,
      'QA_PLUME_FLOWER_ONSETS_ARE_STAGGERED', counts);
      if (name === 'opening') assert(counts.opening > 0 && counts.visiblePetals > 0 && counts.full < counts.total,
        'QA_PLUME_FLOWER_PETALS_UNFOLD', counts);
      if (name === 'full') assert(counts.full === counts.total && counts.visibleBuds === 0,
        'QA_PLUME_FLOWER_DEVELOPMENT_REACHES_FULL', counts);
      await parity(`development-${name}-parity`);
      await capture(`development-${name}`);
      previousDevelopment = counts;
    }
    const developmentRestored = await observe('development-mature-restored', 'set', { growth: 1 });
    assert(developmentRestored.snapshot.woodHash === mature.snapshot.woodHash
      && developmentRestored.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
    'QA_PLUME_DEVELOPMENT_MATURE_REST_IDENTITY');
    const developmentRestoredPixels = await parity('development-mature-restored-parity');
    assert(developmentRestoredPixels.referenceHash === maturePixels.referenceHash,
      'QA_PLUME_DEVELOPMENT_MATURE_PIXEL_IDENTITY');

    const referenceWood = await observe('wood-reference', 'set', { view: 'wood', woodStyle: 'reference' });
    await capture('wood-reference');
    await page.locator('#woodStyle').selectOption('continuous');
    await page.waitForFunction(() => new URL(location.href).searchParams.get('woodStyle') === 'continuous'
      && document.querySelector('#workspace').dataset.state === 'ready');
    const continuousWood = await observe('wood-continuous-via-ui', 'read');
    assert(referenceWood.snapshot.woodHash === continuousWood.snapshot.woodHash
      && referenceWood.snapshot.flowerRestHash === continuousWood.snapshot.flowerRestHash,
    'QA_PLUME_WOOD_STYLE_PRESERVES_STRUCTURE');
    assert(referenceWood.woodSurface.style === 'reference'
      && continuousWood.woodSurface.style === 'continuous'
      && continuousWood.woodSurface.sharedSeamCount > 0,
    'QA_PLUME_WOOD_SURFACE_APPLIED', continuousWood.woodSurface);
    await parity('wood-continuous-parity');
    await capture('wood-continuous');
    await observe('wood-return-flowers', 'set', { view: 'flowers' });

    const low = await observe('growth-low', 'set', { growth: .12 });
    assert(low.snapshot.segments < mature.snapshot.segments, 'QA_PLUME_GROWTH_CHANGES_WOOD');
    await capture('02-growth-low');
    for (const growth of [0, .32, .5, .68, .86, 1]) {
      await observe(`growth-${growth}`, 'set', { growth });
      if (growth === .5) await capture('growth-middle');
    }
    const lowAgain = await observe('growth-low-return', 'set', { growth: .12 });
    assert(lowAgain.snapshot.woodHash === low.snapshot.woodHash
      && lowAgain.snapshot.flowerRestHash === low.snapshot.flowerRestHash,
    'QA_PLUME_GROWTH_REPLAY_IDENTITY');
    const matureAgain = await observe('growth-mature-return', 'set', { growth: 1 });
    assert(matureAgain.snapshot.woodHash === mature.snapshot.woodHash
      && matureAgain.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
    'QA_PLUME_MATURE_REPLAY_IDENTITY');

    // Five unique poses exceed the UI's four-pose cache. These are warm-study
    // observations of full draw work; receipt hashes are computed afterwards.
    const fixedStates = [
      ['f4', .32], ['foundation', .66],
      ['swelling', .62 + .38 * 4.58 / annualTarget],
      ['opening', .62 + .38 * 4.66 / annualTarget], ['mature', 1],
    ];
    const fixedStageSamples = [];
    const retainedRepacks = [];
    let previousFixedStage = matureAgain;
    for (let round = 0; round < 3; round++) for (const [stage, growth] of fixedStates) {
      const measured = await observe(`fixed-stage-${round}-${stage}`, 'set', { growth });
      const timing = measured.frameTiming;
      assert(['cameraMs', 'modelMs', 'snapshotMs', 'planMs', 'canvasMs', 'pixiMs', 'totalMs']
        .every(key => Number.isFinite(timing[key]) && timing[key] >= 0),
      'QA_PLUME_FIXED_STAGE_TIMING_FINITE', { round, stage, timing });
      fixedStageSamples.push({ round, stage, growth, mode: measured.snapshot.live.clock.mode,
        frameTiming: timing, renderer: measured.renderer.lastUpdate,
        textureBytes: measured.renderer.textureBytes });
      const before = previousFixedStage.renderer, after = measured.renderer;
      if (after.lastUpdate.kind === 'full' && before.drawRuns === after.drawRuns
        && before.woodTextureCount === 1 && after.woodTextureCount === 1) {
        const repack = { round, stage, drawRuns: after.drawRuns,
          woodSpriteAllocations: after.woodSpriteAllocationCount - before.woodSpriteAllocationCount,
          woodFrameTextureAllocations: after.woodFrameTextureAllocationCount - before.woodFrameTextureAllocationCount,
          woodAtlasAllocations: after.woodTextureAllocationCount - before.woodTextureAllocationCount };
        assert(repack.woodSpriteAllocations === 0 && repack.woodFrameTextureAllocations === 0
          && repack.woodAtlasAllocations === 0 && after.woodFrameTextureCount === after.drawRuns,
        'QA_PLUME_FULL_REPACK_RETAINS_SLOT_RESOURCES', repack);
        retainedRepacks.push(repack);
      }
      previousFixedStage = measured;
    }
    assert(retainedRepacks.length > 0, 'QA_PLUME_FULL_REPACK_REUSE_EXERCISED', retainedRepacks);
    report.cases.push({ name: 'full-repack-resource-reuse', observations: retainedRepacks,
      interpretation: 'Existing fixed-stage updates require full paint repacks with unchanged run count and one retained wood atlas; the same frame textures and sprites remain owned.' });
    report.cases.push({ name: 'fixed-stage-performance', samples: fixedStageSamples,
      interpretation: 'Three rounds of five fixed states exceed the four-entry UI pose cache. Studies, canonical pose preparation and flower material are already warm. Timings come from draw before diagnostic receipt hashing, include comparison Canvas and Pixi, and carry no FPS or fixed-budget verdict. Native archived/current alternating observations provide the controlled before/after comparison.' });

    const yawChanged = await observe('camera-yaw-changed', 'set', { yaw: 30 });
    assert(yawChanged.snapshot.woodHash === mature.snapshot.woodHash
      && yawChanged.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
    'QA_PLUME_CAMERA_YAW_PRESERVES_REST');
    const yawPixels = await parity('camera-yaw-parity');
    assert(yawPixels.referenceHash !== maturePixels.referenceHash,
      'QA_PLUME_CAMERA_YAW_CHANGES_PROJECTION');
    await observe('camera-yaw-restored', 'set', { yaw: 0 });
    const yawRestoredPixels = await parity('camera-yaw-restored-parity');
    assert(yawRestoredPixels.referenceHash === maturePixels.referenceHash,
      'QA_PLUME_CAMERA_YAW_RETURN_IDENTITY');

    await page.locator('#activation').press('Home');
    // Keep the Playwright predicate synchronous: an async predicate's Promise
    // can be truthy before the debounced UI update has actually committed.
    await page.waitForFunction(() => new URL(location.href).searchParams.get('activation') === '0'
      && document.querySelector('#workspace').dataset.state === 'ready');
    const inactive = await observe('activation-low-via-ui-key', 'read');
    assert(inactive.snapshot.woodHash === mature.snapshot.woodHash
      && inactive.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
    'QA_PLUME_ACTIVATION_PRESERVES_STRUCTURE');
    assert(inactive.snapshot.effectiveFlowers < mature.snapshot.effectiveFlowers,
      'QA_PLUME_ACTIVATION_CHANGES_FLOWERING');
    await capture('03-activation-low');
    let previousActivation = await observe('activation-full-before-shared-pose', 'set', { activation: 1 });
    for (const activation of [.35, .7, 1, 0]) {
      const current = await observe(`activation-${activation}`, 'set', { activation });
      assert(current.snapshot.woodHash === mature.snapshot.woodHash
        && current.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
      'QA_PLUME_ACTIVATION_STABLE_IDENTITY', activation);
      assert(current.renderer.flowerSpriteAllocationCount === previousActivation.renderer.flowerSpriteAllocationCount
        && current.renderer.flowerSpriteCount === previousActivation.renderer.flowerSpriteCount,
      'QA_PLUME_ACTIVATION_REUSES_FLOWER_SPRITES', activation);
      if (activation === .35) await parity('shared-activation-partial-parity');
      previousActivation = current;
    }
    await page.locator('#activation').press('End');
    await page.waitForFunction(() => new URL(location.href).searchParams.get('activation') === '1'
      && document.querySelector('#workspace').dataset.state === 'ready');
    const restored = await observe('activation-restored-via-ui-key', 'read');
    assert(restored.snapshot.effectiveFlowers === mature.snapshot.effectiveFlowers,
      'QA_PLUME_ACTIVATION_RECOVERY');
    const restoredPixels = await parity('restored-parity');
    assert(restoredPixels.referenceHash === maturePixels.referenceHash,
      'QA_PLUME_REFERENCE_RASTER_RECOVERY');
    for (let repeat = 0; repeat < 3; repeat++) {
      const repeatedPixels = await parity(`repeated-readback-${repeat}`);
      assert(repeatedPixels.referenceHash === maturePixels.referenceHash,
        'QA_PLUME_REFERENCE_READBACK_STABILITY', repeat);
    }
    const windStart = await observe('wind-start', 'set', { wind: 1 });
    const visibility = await page.evaluate(() => document.visibilityState);
    assert(visibility === 'visible', 'QA_PLUME_WIND_DOCUMENT_VISIBLE', visibility);
    const windDeadline = Date.now() + 15_000;
    let windFrameReceipt;
    do {
      windFrameReceipt = await call('read');
      if (windFrameReceipt.renderer.renderCount >= windStart.renderer.renderCount + 3) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < windDeadline);
    assert(windFrameReceipt.renderer.renderCount >= windStart.renderer.renderCount + 3,
      'QA_PLUME_NATURAL_WIND_FRAMES', windFrameReceipt.renderer.renderCount);
    const windRunning = await observe('wind-real-frames', 'read');
    assert(windRunning.snapshot.woodHash === mature.snapshot.woodHash
      && windRunning.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
    'QA_PLUME_WIND_PRESERVES_REST_IDENTITY');
    assert(Number.isInteger(windStart.renderer.rebakeCount)
      && windRunning.renderer.rebakeCount === windStart.renderer.rebakeCount,
    'QA_PLUME_WIND_REUSES_BAKE');
    assert(windRunning.renderer.transformUpdateCount > windStart.renderer.transformUpdateCount,
      'QA_PLUME_WIND_APPLIES_CHANGED_TRANSFORMS');
    report.cases.push({ name: 'wind-observation', visibility,
      frameCountDelta: windRunning.renderer.renderCount - windStart.renderer.renderCount,
      interpretation: 'Naturally delivered requestAnimationFrame updates; no FPS or sustained performance verdict.' });
    await observe('wind-stopped', 'set', { wind: 0 });

    const playbackStart = await observe('playback-seek-start', 'set', { growth: .28 });
    const playing = await observe('playback-start', 'playback', { action: 'play', durationSeconds: 10 });
    assert(playing.playback.status === 'playing' && playing.playback.durationSeconds === 10,
      'QA_PLUME_PLAYBACK_STARTED', playing.playback);
    assertPlaybackBounded(playing, 'start');
    const advanced = await waitForPlayback('playback-natural-frames', receipt =>
      receipt.playback.framesCommitted >= playing.playback.framesCommitted + 2
      && receipt.playback.committedGrowth > playbackStart.state.growth);
    assert(advanced.playback.tickCount > playing.playback.tickCount
      && advanced.snapshot.woodHash !== playbackStart.snapshot.woodHash,
    'QA_PLUME_PLAYBACK_CHANGES_RENDERED_TREE');
    const paused = await observe('playback-paused', 'playback', { action: 'pause' });
    assert(paused.playback.status === 'paused' && paused.playback.inFlight === false
      && paused.playback.pendingFrameCount === 0,
    'QA_PLUME_PLAYBACK_PAUSE_DRAINS_WORK', paused.playback);
    assertPlaybackBounded(paused, 'pause');
    await capture('05-playback-paused');
    await new Promise(resolve => setTimeout(resolve, 750));
    const quiet = await observe('playback-pause-quiet', 'read');
    assert(quiet.state.growth === paused.state.growth
      && quiet.playback.requestedGrowth === paused.playback.requestedGrowth
      && quiet.playback.framesCommitted === paused.playback.framesCommitted
      && quiet.snapshot.woodHash === paused.snapshot.woodHash,
    'QA_PLUME_PLAYBACK_PAUSE_FREEZES_STATE');

    // Resume through the same visible button used by a person. The wall-clock
    // bound allows the actual click/read latency, but not time spent paused.
    const resumedAt = Date.now();
    await page.locator('#growth-play').click();
    const resumed = await observe('playback-resumed-via-ui', 'read');
    const resumeElapsedSeconds = (Date.now() - resumedAt) / 1000;
    assert(resumed.playback.status === 'playing'
      && resumed.playback.requestedGrowth >= quiet.playback.committedGrowth
      && resumed.playback.requestedGrowth <= quiet.playback.requestedGrowth
        + resumeElapsedSeconds / quiet.playback.durationSeconds + .015,
    'QA_PLUME_PLAYBACK_RESUME_EXCLUDES_PAUSE_TIME', {
      resumeElapsedSeconds, before: quiet.playback, after: resumed.playback,
    });
    await waitForPlayback('playback-resumed-natural-frame', receipt =>
      receipt.playback.framesCommitted > quiet.playback.framesCommitted);
    await observe('playback-pause-before-restart', 'playback', { action: 'pause' });

    const restarted = await observe('playback-restart', 'playback', { action: 'restart' });
    assert(restarted.state.growth === 0 && restarted.playback.committedGrowth === 0
      && restarted.playback.status === 'playing' && restarted.state.seed === plan.parameters.seed,
    'QA_PLUME_PLAYBACK_RESTART_SAME_TREE', restarted.playback);
    await waitForPlayback('playback-restart-natural-frame', receipt =>
      receipt.playback.committedGrowth > 0);

    // Manual seeks interrupt automatic work at the public input boundary.
    // Issue a short burst in one browser task, then prove no old automatic
    // frame can overwrite the final requested position after the queue drains.
    await page.evaluate(async name => {
      const api = window[name];
      await Promise.all([.21, .43, .72].map(growth => api.set({ growth })));
    }, API);
    const seeked = await observe('playback-manual-seek-burst', 'read');
    assert(seeked.state.growth === .72 && seeked.playback.committedGrowth === .72
      && seeked.playback.status === 'paused' && seeked.playback.inFlight === false
      && seeked.playback.pendingFrameCount === 0,
    'QA_PLUME_PLAYBACK_MANUAL_SEEK_OWNS_STATE', seeked.playback);
    assertPlaybackBounded(seeked, 'manual-seek');
    await new Promise(resolve => setTimeout(resolve, 400));
    const seekQuiet = await observe('playback-manual-seek-quiet', 'read');
    assert(seekQuiet.state.growth === .72
      && seekQuiet.playback.framesCommitted === seeked.playback.framesCommitted
      && seekQuiet.snapshot.woodHash === seeked.snapshot.woodHash,
    'QA_PLUME_PLAYBACK_NO_STALE_SEEK_OVERWRITE');

    // Bud marks change draw-slice bounds during opening. Probe compatible
    // post-bloom slots here; all four bud-stage parity/resource checks remain.
    const nearEnd = await observe('playback-near-end', 'set', { growth: .98 });
    const smallStep = await observe('playback-small-step', 'set', { growth: .981 });
    assert(smallStep.renderer.lastUpdate.kind === 'partial'
      && smallStep.renderer.lastUpdate.paintedRuns > 0
      && smallStep.renderer.lastUpdate.reusedRuns > 0
      && smallStep.renderer.lastUpdate.updatedAtlases > 0
      && smallStep.renderer.lastUpdate.allocatedAtlases === 0,
    'QA_PLUME_SMALL_GROWTH_REUSES_UNCHANGED_PAINT', smallStep.renderer.lastUpdate);
    assert(smallStep.renderer.textureAllocationCount === nearEnd.renderer.textureAllocationCount
      && smallStep.renderer.spriteAllocationCount === nearEnd.renderer.spriteAllocationCount,
    'QA_PLUME_SMALL_GROWTH_REUSES_RESOURCES');
    await parity('playback-small-step-parity');
    await observe('playback-full-journey-start', 'set', { growth: 0 });
    const finishing = await observe('playback-play-to-end', 'playback', { action: 'play', durationSeconds: 10 });
    const ended = await waitForPlayback('playback-natural-endpoint', receipt =>
      receipt.playback.status === 'ended' && receipt.playback.committedGrowth === 1);
    assert(ended.state.growth === 1 && ended.playback.inFlight === false
      && ended.playback.pendingFrameCount === 0
      && ended.playback.framesCommitted >= finishing.playback.framesCommitted + 3,
    'QA_PLUME_PLAYBACK_ENDPOINT_SETTLED', ended.playback);
    assert(ended.snapshot.woodHash === mature.snapshot.woodHash
      && ended.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
    'QA_PLUME_PLAYBACK_MATURE_IDENTITY');
    const endpointPixels = await parity('playback-endpoint-parity');
    assert(endpointPixels.referenceHash === maturePixels.referenceHash,
      'QA_PLUME_PLAYBACK_MATURE_RASTER_IDENTITY');
    report.cases.push({ name: 'playback-observation',
      interpretation: 'Naturally delivered requestAnimationFrame growth commits, pause/resume, same-seed restart, manual-seek ownership and a complete growth 0-to-1 journey with the exact mature endpoint. Sampled costs include this comparison surface and QA observations; no simulated frames or sustained FPS verdict.',
      framesCommitted: ended.playback.framesCommitted,
      tickCount: ended.playback.tickCount,
      maxInFlight: ended.playback.maxInFlight,
      pendingFrameCount: ended.playback.pendingFrameCount,
      frameCostMs: ended.playback.frameCostMs,
      renderer: {
        fullBakeCount: ended.renderer.fullBakeCount,
        partialBakeCount: ended.renderer.partialBakeCount,
        reuseCount: ended.renderer.reuseCount,
        textureAllocationCount: ended.renderer.textureAllocationCount,
        textureUpdateCount: ended.renderer.textureUpdateCount,
        spriteAllocationCount: ended.renderer.spriteAllocationCount,
        textureBytes: ended.renderer.textureBytes,
        flowerSpriteCount: ended.renderer.flowerSpriteCount,
        flowerSpriteAllocationCount: ended.renderer.flowerSpriteAllocationCount,
        flowerAtlasBakeCount: ended.renderer.flowerAtlasBakeCount,
        flowerAtlasUploadCount: ended.renderer.flowerAtlasUploadCount,
        flowerAtlasAllocationCount: ended.renderer.flowerAtlasAllocationCount,
      },
    });

    await observe('resized-retina', 'resize', { width: 768, height: 960, pixelRatio: 2 });
    const retinaPixels = await parity('resized-retina-parity');
    await capture('04-resized-retina');

    // Reuse the same renderer across two seeds; separate browser runs would
    // not establish atlas lifetime across a reroll in one research session.
    const alternateSeed = plan.parameters.seed === 151 ? 123123 : 151;
    const seedSwitchStartedAt = Date.now();
    const alternate = await call('set', { seed: alternateSeed, growth: 1 });
    report.cases.push({ name: 'shared-atlas-alternate-seed',
      elapsedMs: Date.now() - seedSwitchStartedAt, receipt: alternate });
    assert(alternate.sourceHash === plan.parameters.source && alternate.state.seed === alternateSeed,
      'QA_PLUME_ALTERNATE_SEED_SOURCE_IDENTITY');
    assert(alternate.renderer.backend === 'pixi-webgl'
      && alternate.state.flowerStyle === 'shared' && alternate.state.growth === 1,
    'QA_PLUME_ALTERNATE_SEED_SHARED_RENDERER');
    assert(alternate.snapshot.flowerRestHash !== mature.snapshot.flowerRestHash
      && alternate.renderer.flowerSpriteCount === alternate.plan.flowerSprites,
    'QA_PLUME_ALTERNATE_SEED_FLOWER_STATE');
    assertSharedFlowerAtlas(alternate, 'alternate-seed');
    const seedRestored = await observe('shared-atlas-seed-restored', 'set', {
      seed: plan.parameters.seed, growth: 1,
    });
    assert(seedRestored.snapshot.woodHash === mature.snapshot.woodHash
      && seedRestored.snapshot.flowerRestHash === mature.snapshot.flowerRestHash,
    'QA_PLUME_SEED_RETURN_REST_IDENTITY');
    const seedRestoredPixels = await parity('shared-atlas-seed-restored-parity');
    assert(seedRestoredPixels.referenceHash === retinaPixels.referenceHash,
      'QA_PLUME_SEED_RETURN_RASTER_IDENTITY');

    await observe('playback-before-dispose', 'set', { growth: .96 });
    const disposingPlayback = await observe('playback-dispose-start', 'playback', { action: 'play' });
    assert(disposingPlayback.playback.status === 'playing', 'QA_PLUME_PLAYBACK_ACTIVE_BEFORE_DISPOSE');
    const disposed = await call('dispose');
    report.cases.push({ name: 'disposed', receipt: disposed });
    assert(disposed.disposed === true && disposed.renderer.disposed === true,
      'QA_PLUME_RENDERER_DISPOSED', disposed);
    assert(disposed.renderer.textureCount === 0 && disposed.renderer.spriteCount === 0,
      'QA_PLUME_RENDERER_RESOURCES_RELEASED', disposed.renderer);
    assert(disposed.renderer.woodFrameTextureCount === 0,
      'QA_PLUME_WOOD_FRAME_TEXTURES_RELEASED', disposed.renderer);
    assert(disposed.renderer.flowerAtlasCount === 0 && disposed.renderer.flowerAtlasBytes === 0
      && disposed.renderer.flowerSpriteCount === 0,
    'QA_PLUME_SHARED_FLOWER_RESOURCES_RELEASED', disposed.renderer);
    assert(disposed.playback.status === 'disposed' && disposed.playback.inFlight === false
      && disposed.playback.pendingFrameCount === 0,
    'QA_PLUME_PLAYBACK_DISPOSED', disposed.playback);
    assert(source.missingRequests.length === 0, 'QA_PLUME_COMPLETE_SOURCE_CLOSURE', source.missingRequests);
    assert(Object.values(report.diagnostics).every(entries => entries.length === 0),
      'QA_PLUME_BROWSER_DIAGNOSTICS', report.diagnostics);
    report.status = 'passed';
  } catch (error) {
    failure = error; report.status = 'failed'; report.error = serializeError(error);
    if (page && !page.isClosed()) {
      try { await capture('failure'); } catch (captureError) { report.captureError = serializeError(captureError); }
    }
  } finally {
    const cleanupErrors = [];
    for (const [name, resource] of [['context', context], ['browser', ownedBrowser], ['server', source]]) {
      if (!resource) continue;
      try { await resource.close(); report.cleanup[name] = 'released'; }
      catch (error) { report.cleanup[name] = 'failed'; cleanupErrors.push(serializeError(error)); }
    }
    if (cleanupErrors.length) {
      report.cleanup.errors = cleanupErrors; report.status = 'failed';
      failure = new Error('QA_PLUME_RESOURCE_CLEANUP_FAILED');
    }
    report.completedAt = new Date().toISOString();
    await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await evidence.event('QA_PLUME_LIVE_FINISHED', { status: report.status,
      sourceHash: report.sourceHash, cleanup: report.cleanup, report: path.join(outputDir, 'report.json') });
  }
  if (failure) throw failure;
  return Object.freeze({ status: QA_RUN_STATUSES.PASS, protocol: 'zen_cherry_plume_live',
    sourceHash: plan.parameters.source, reportJsonPath: path.join(outputDir, 'report.json'),
    captures: report.captures, cleanup: report.cleanup });
}
