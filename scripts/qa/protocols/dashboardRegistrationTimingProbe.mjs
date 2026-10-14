// Observe development timing logs on the capture's exact existing document and
// verified extension worker. No API replacement, target creation or focus change.
import fs from 'node:fs/promises';
import { prepareDashboardCpuProfileEvidence } from './dashboardBootCpuProfileEvidence.mjs';

export async function observeDashboardRegistrationTiming({ harness, page, run, record, cpuProfilePath = null }) {
  const worker = await harness.waitForServiceWorker();
  if (worker.type !== 'service_worker'
    || worker.url !== `chrome-extension://${harness.extensionId}/service-worker-loader.js`) {
    throw new Error('QA_REGISTRATION_TIMING_WORKER_IDENTITY_REQUIRED');
  }
  const { sessionId } = await harness.cdp.send('Target.attachToTarget', {
    targetId: worker.targetId, flatten: true,
  });
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('QA_REGISTRATION_TIMING_SESSION_REQUIRED');
  const observations = [];
  let profileEnabled = false, profileStarted = false, profileStartReceipt;
  let failure = null;
  const unsubscribe = harness.cdp.subscribe('Runtime.consoleAPICalled', event => {
    if (![sessionId, page.sessionId].includes(event.sessionId)) return;
    if (event.params?.args?.[0]?.value !== '[SETTINGS_FLOW][timing]') return;
    try {
      if (observations.length >= 512) throw new Error('QA_REGISTRATION_TIMING_OVERFLOW');
      const timing = JSON.parse(event.params.args[1].value);
      if (typeof timing.phase !== 'string' || !Number.isFinite(timing.durationMs) || timing.durationMs < 0) {
        throw new Error('QA_REGISTRATION_TIMING_INVALID');
      }
      observations.push({ ...timing, atEpochMs: event.params.timestamp,
        source: event.sessionId === sessionId ? 'background' : 'dashboard' });
    } catch (error) { failure = error; }
  });
  try {
    await harness.cdp.send('Runtime.enable', {}, sessionId);
    if (cpuProfilePath !== null) {
      await harness.cdp.send('Profiler.enable', {}, page.sessionId);
      profileEnabled = true;
      await harness.cdp.send('Profiler.setSamplingInterval', { interval: 1000 }, page.sessionId);
      const requestedAtEpochMs = Date.now();
      await harness.cdp.send('Profiler.start', {}, page.sessionId);
      profileStarted = true;
      profileStartReceipt = { requestedAtEpochMs, confirmedAtEpochMs: Date.now() };
    }
    const result = await run();
    if (failure) throw failure;
    for (const registration of result.registrationObservations) {
      registration.settingsTimings = observations.filter(timing => timing.atEpochMs >= registration.startedAtEpochMs
        && timing.atEpochMs < registration.startedAtEpochMs + 3500);
      for (const phase of ['persistence', 'propagation_wait', 'reconciliation', 'registration_ready']) {
        if (!registration.settingsTimings.some(timing => timing.phase === phase)) {
          throw new Error('QA_REGISTRATION_TIMING_PHASE_MISSING:' + phase);
        }
      }
    }
    return result;
  } finally {
    unsubscribe();
    try {
      if (profileStarted) {
        const { profile } = await harness.cdp.send('Profiler.stop', {}, page.sessionId);
        const prepared = prepareDashboardCpuProfileEvidence(profile, profileStartReceipt);
        await fs.writeFile(cpuProfilePath, prepared.body);
        await fs.writeFile(cpuProfilePath + '.clock.json', JSON.stringify(prepared.clock, null, 2));
      }
    } finally {
      try { if (profileEnabled) await harness.cdp.send('Profiler.disable', {}, page.sessionId); }
      finally {
        try { await record(observations); }
        finally { await harness.cdp.send('Target.detachFromTarget', { sessionId }); }
      }
    }
  }
}
