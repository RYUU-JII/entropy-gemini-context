import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { launchQaPlaywrightBrowser, readQaPlaywrightBrowserReceipt } from '../browser/qaPlaywrightBrowserOwner.mjs';
import { QA_RUN_STATUSES } from '../contracts/qaTargetContract.mjs';
import { createZenRainStreaksSourceLease } from './zenRainStreaksSourceLease.mjs';

const API = '__ZEN_RAIN_STREAKS_QA__';
const PROTOCOL_SHA256 = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const serializeError = error => ({ name: error.name, message: error.message,
  code: error.code || null, stack: error.stack });

export async function executeQaProtocol({ plan, artifact, browser, evidence,
  attachmentsDir, signal, reportBrowserGpuCapability, registerCleanup }) {
  if (artifact?.id !== 'source_render') throw Error('QA_RAIN_STREAKS_SOURCE_RENDER_REQUIRED');
  if (browser?.processOwnership !== 'owned' || !browser.chrome) throw Error('QA_RAIN_STREAKS_OWNED_BROWSER_REQUIRED');
  const outputDir = path.join(attachmentsDir, 'rain-streaks');
  await mkdir(outputDir, { recursive: true });
  const report = { contract: plan.protocolOptions.contract, targetId: plan.targetId,
    protocolSha256: PROTOCOL_SHA256, startedAt: new Date().toISOString(), status: 'running',
    interpretation: 'Detached source-captured WebGL rain geometry and cost research. CPU/GPU measurements are evidence without a timing gate; unavailable GPU timers remain an explicit measurement limit. This does not certify product integration, physical GPU or frame-rate performance.',
    assertions: [], captures: [],
    diagnostics: { consoleErrors: [], pageErrors: [], requestFailures: [] },
    cleanup: { page: 'not_acquired', context: 'not_acquired', browser: 'not_acquired', server: 'not_acquired' } };
  let source = null, ownedBrowser = null, context = null, page = null, failure = null, cleanupPromise = null;
  const assert = (condition, code, detail = null) => {
    report.assertions.push({ code, passed: Boolean(condition), detail });
    if (!condition) { const error = Error(`${code}:${JSON.stringify(detail)}`); error.code = code; throw error; }
  };
  const cleanup = () => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const errors = [];
      for (const [name, resource] of [['page', page], ['context', context], ['browser', ownedBrowser], ['server', source]]) {
        if (!resource) continue;
        try { await resource.close(); report.cleanup[name] = 'released'; }
        catch (error) { report.cleanup[name] = 'failed'; errors.push(serializeError(error)); }
      }
      if (errors.length) { report.cleanup.errors = errors; throw Error('QA_RAIN_STREAKS_RESOURCE_CLEANUP_FAILED'); }
      return { status: 'released', resources: { ...report.cleanup } };
    })();
    return cleanupPromise;
  };
  registerCleanup('zen_rain_streaks_resources', cleanup);
  const call = async (method, argument = null) => {
    signal?.throwIfAborted();
    return page.evaluate(async ({ name, method, argument }) => {
      const api = window[name];
      if (!api || typeof api[method] !== 'function') throw Error(`QA_RAIN_STREAKS_API_METHOD:${method}`);
      return api[method](argument);
    }, { name: API, method, argument });
  };
  try {
    source = await createZenRainStreaksSourceLease({ rootDir: plan.rootDir, entryPath: plan.protocolOptions.entryPath });
    report.cleanup.server = 'owned';
    report.source = source.receipt;
    report.preview = await source.exportPreview(path.join(outputDir, 'preview.html'));
    report.sourceBefore = await source.assertUnchanged();
    await evidence.event('QA_RAIN_STREAKS_SOURCE_CAPTURED', { sourceHash: source.receipt.sourceHash,
      inputs: source.receipt.inputs.length, bundle: source.receipt.bundle });
    ownedBrowser = await launchQaPlaywrightBrowser({ executablePath: browser.chrome,
      headless: plan.browserExecution.headless }, {
      ownerId: `qa-rain-streaks:pid=${process.pid}`, rootDir: plan.rootDir,
      executionPlan: plan.browserExecution, presentation: plan.browserExecution.presentation,
      audioPolicy: plan.browserExecution.audioPolicy, displayReceipt: browser.display,
      launchEnvironment: browser.launchEnvironment,
      renderingRequirement: plan.browserExecution.renderingRequirement,
    });
    report.cleanup.browser = 'owned';
    report.browser = { version: ownedBrowser.version(), owner: readQaPlaywrightBrowserReceipt(ownedBrowser) };
    if (report.browser.owner?.gpuCapability) await reportBrowserGpuCapability(report.browser.owner.gpuCapability);
    context = await ownedBrowser.newContext({ viewport: { width: 1100, height: 850 }, deviceScaleFactor: 1,
      locale: 'ko-KR', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light' });
    report.cleanup.context = 'owned';
    page = await context.newPage();
    report.cleanup.page = 'owned';
    page.setDefaultTimeout(120_000);
    page.on('console', message => { if (message.type() === 'error') report.diagnostics.consoleErrors.push(message.text()); });
    page.on('pageerror', error => report.diagnostics.pageErrors.push(serializeError(error)));
    page.on('requestfailed', request => report.diagnostics.requestFailures.push({ url: request.url(), failure: request.failure() }));
    const response = await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    assert(response?.status() === 200, 'QA_RAIN_STREAKS_HTTP_ENTRY', response?.status());
    await page.waitForFunction(name => Boolean(window[name]?.ready), API);
    await page.evaluate(async name => { await window[name].ready; }, API);
    report.study = await call('runStudy');
    report.studyJsonPath = path.join(outputDir, 'study.json');
    await writeFile(report.studyJsonPath, JSON.stringify(report.study, null, 2) + '\n');
    assert(report.study?.contract === 'zen_rain_streaks_study_v1', 'QA_RAIN_STREAKS_STUDY_CONTRACT');
    assert(Array.isArray(report.study.assertions) && report.study.assertions.length > 0
      && report.study.assertions.every(assertion => assertion.passed === true),
    'QA_RAIN_STREAKS_FIXTURE_ASSERTIONS', report.study.assertions);
    assert(Array.isArray(report.study.cases) && report.study.cases.length > 0, 'QA_RAIN_STREAKS_STUDY_CASES');
    assert(report.study.waterImpacts?.contract === 'zen_water_impact_cost_study_v1'
      && Array.isArray(report.study.waterImpacts.cases) && report.study.waterImpacts.cases.length > 0,
    'QA_RAIN_STREAKS_WATER_IMPACT_STUDY');
    assert(report.study.productionRain?.contract === 'zen_production_rain_cost_study_v1'
      && Array.isArray(report.study.productionRain.cases) && report.study.productionRain.cases.length > 0,
    'QA_RAIN_STREAKS_PRODUCTION_STUDY');
    for (const studyCase of [...report.study.cases, ...report.study.waterImpacts.cases, ...report.study.productionRain.cases]) {
      assert(Array.isArray(studyCase.phases) && studyCase.phases.length > 0
        && studyCase.phases.every(phase => ['median', 'p95', 'max'].every(key => (
          Number.isFinite(phase.cpuMs?.[key]) && phase.cpuMs[key] >= 0
        )) && phase.cpuMs.median <= phase.cpuMs.p95 && phase.cpuMs.p95 <= phase.cpuMs.max),
      'QA_RAIN_STREAKS_FINITE_CPU_OBSERVATION', studyCase.id);
    }
    for (const { rainIntensity, appearanceMode, name } of [
      { rainIntensity: .72, appearanceMode: 'current', name: 'rain-72' },
      { rainIntensity: 1, appearanceMode: 'current', name: 'rain-100' },
      { rainIntensity: .72, appearanceMode: 'appRain', name: 'app-rain-sky' },
      { rainIntensity: .72, appearanceMode: 'cloudy', name: 'cloudier-sky' },
      { rainIntensity: .72, appearanceMode: 'readable', name: 'readable-rain' },
      { rainIntensity: .72, appearanceMode: 'sparse', name: 'sparse-rain' },
      { rainIntensity: 1, appearanceMode: 'sparse', name: 'sparse-max' },
    ]) {
      const receipt = await call('capture', { rainIntensity, appearanceMode, width: 640, height: 480, pixelRatio: 1, time: 4.25 });
      assert(receipt.width === 640 && receipt.height === 480 && receipt.pixelRatio === 1
        && receipt.rainIntensity === rainIntensity && receipt.time === 4.25,
      'QA_RAIN_STREAKS_CAPTURE_STATE', receipt);
      const filename = path.join(outputDir, `${name}.png`);
      await page.screenshot({ path: filename, fullPage: false, animations: 'disabled' });
      report.captures.push({ path: filename, receipt });
    }
    report.dispose = await call('dispose');
    assert(report.dispose.disposed === true && report.dispose.remainingMeshes === 0
      && report.dispose.remainingQueries === 0 && report.dispose.contextLost === true,
    'QA_RAIN_STREAKS_RESOURCES_DISPOSED', report.dispose);
    assert(source.missingRequests.length === 0, 'QA_RAIN_STREAKS_COMPLETE_BUNDLE_CLOSURE', source.missingRequests);
    assert(Object.values(report.diagnostics).every(rows => rows.length === 0),
      'QA_RAIN_STREAKS_BROWSER_DIAGNOSTICS', report.diagnostics);
    report.status = 'passed';
  } catch (error) {
    failure = error; report.status = 'failed'; report.error = serializeError(error);
  } finally {
    if (source) {
      try { report.sourceAfter = await source.assertUnchanged(); }
      catch (error) { report.sourceError = serializeError(error); report.status = 'failed'; failure = error; }
    }
    try { await cleanup(); }
    catch (error) { report.status = 'failed'; failure = error; }
    report.completedAt = new Date().toISOString();
    await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await evidence.event('QA_RAIN_STREAKS_FINISHED', { status: report.status,
      sourceHash: report.source?.sourceHash, cleanup: report.cleanup, report: path.join(outputDir, 'report.json') });
  }
  if (failure) throw failure;
  return Object.freeze({ status: QA_RUN_STATUSES.PASS, protocol: 'zen_rain_streaks',
    sourceHash: report.source.sourceHash, reportJsonPath: path.join(outputDir, 'report.json'),
    captures: report.captures, cleanup: report.cleanup });
}
