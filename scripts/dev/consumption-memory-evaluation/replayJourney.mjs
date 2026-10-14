import { createConsumptionMemory, advanceConsumptionMemory, projectConsumptionMemory, createConsumptionPolicyEvidence, advanceConsumptionPolicyEvidence } from '../../../src/domains/behavior/consumption/consumptionMemoryModel.js';
import { projectShishiConsumptionLevel } from '../../../src/domains/protection/domain/shishiConsumptionLevel.js';
import { buildConsumptionEnvironment, buildGateEntryPresence } from '../../../src/domains/tracking/background/trackingConsumptionEnvironment.js';
import { isDataCollectionConsentGranted, shouldCollectDomainUsage } from '../../../src/domains/settings/config/dataCollectionPolicy.js';
import { shishiEntryDurationMs } from './shishiEntryWait.mjs';
import { INTERVENTION_RECOVERY_MS } from '../../../src/domains/nudge/runtime/interventionPolicy.js';
import { createAdmissionHarness } from './admissionHarness.mjs';
import { createGateReplayPolicy, REPLAY_HOSTS } from './gateReplayPolicy.mjs';
import { projectObservedIntervals } from './observedIntervals.mjs';
import { seededRandom } from './patternGenerator.mjs';

export const REACTION_PROFILES = Object.freeze({
  continue_only: { leave: 0, switch: 0 },
  mixed: { leave: 0.2, switch: 0.1 },
  leave_heavy: { leave: 0.5, switch: 0.2 },
});
const BASE = 100_000;

// A virtual event driver, not an alternate scheduler: all admission decisions
// are made by InterventionAdmissionService. Timed events only deliver fixture
// observations and actual presentation/end callbacks. No gap-expiry retries.
export async function replayConsumptionJourney(pattern, {
  policy = 'fixed', collection = 'protected_sites', reaction = 'continue_only',
  presentationFailureRate = 0.04, competing = true, keepTrace = false,
} = {}) {
  if (!['fixed', 'adaptive'].includes(policy) || !['protected_sites', 'all_sites_minimal'].includes(collection)
    || !Object.hasOwn(REACTION_PROFILES, reaction) || !Number.isFinite(presentationFailureRate)
    || presentationFailureRate < 0 || presentationFailureRate > 1) throw new Error('JOURNEY_OPTIONS_INVALID');
  const epoch = `journey:${pattern.profile}:${pattern.seed}`;
  let memory = createConsumptionMemory({ epoch, startedAt: BASE });
  let policyEvidence = createConsumptionPolicyEvidence(BASE, { knownZero: true });
  const admission = createAdmissionHarness({ startedAt: BASE }), gate = createGateReplayPolicy();
  let at = BASE, serial = 0, world = { kind: 'unknown', tab: 0 }, latestEntryAt = 0;
  let unknownOutsideMs = 0, pointCount = 0, eligible = 0, entryAttempts = 0, failedPresentations = 0;
  let previousWorld = null;
  const exposures = [], attempts = [], evidence = [], events = [], denials = {};
  const settings = (kind) => ({ dataCollectionMode: kind === 'disabled' ? 'off' : collection,
    insightsConsent: collection === 'protected_sites' ? 'protected_only' : 'all_sites',
    blockedUrls: REPLAY_HOSTS, trackingExcludedUrls: [] });
  const hostFor = (value) => value.kind === 'outside' ? 'outside.example' : REPLAY_HOSTS[value.tab % REPLAY_HOSTS.length];
  function browserEnvironmentInput(now) {
    const unavailable = ['unknown', 'disabled'].includes(world.kind);
    const tab = { id: world.tab, windowId: 1, active: true,
      url: `https://${hostFor(world)}/`, audible: unavailable ? undefined : world.kind === 'protected_media' };
    return { tabs: [tab], focusedActiveTabs: [tab],
      focusedWindow: unavailable ? null : { id: 1, focused: ['protected_use', 'outside'].includes(world.kind) }, now,
      idleState: 'active', settings: settings(world.kind),
      resolveScope: async ({ hostname }) => ({ ok: true, isBlockedDomain: REPLAY_HOSTS.includes(hostname) }) };
  }
  function schedule(time, type, detail) { events.push({ time, type, detail, serial: ++serial }); }
  function deterministicDraw(key, salt) {
    let hash = pattern.seed >>> 0;
    for (const char of `${key}:${salt}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return seededRandom(hash)();
  }
  async function settle(until) {
    if (until === at) return;
    const config = settings(world.kind), hostname = hostFor(world);
    const collectionEnabled = isDataCollectionConsentGranted(config);
    const foregroundReceipts = ['protected_use', 'outside'].includes(world.kind)
      && shouldCollectDomainUsage(hostname, config)
      ? [{ tabId: world.tab, hostname, startedAt: at, endedAt: until,
        isProtected: world.kind === 'protected_use', audible: false, closed: true }] : [];
    const environmentInput = browserEnvironmentInput(until);
    const point = await buildConsumptionEnvironment(environmentInput);
    gate.observe(await buildGateEntryPresence(environmentInput));
    const observed = projectObservedIntervals({ epoch, sequence: memory.sequence + 1,
      startedAt: at, endedAt: until, collectionEnabled, exposureCoverage: 'complete', foregroundReceipts,
      environmentPoints: [point], exposures: exposures.filter((item) => item.startedAt < until && (item.endedAt === null || item.endedAt > at))
        .map((item) => ({ leaseId: item.lease.leaseId, startedAt: item.startedAt, endedAt: item.endedAt === null ? until : item.endedAt })) });
    for (const interval of observed.intervals) {
      const before = memory.memory;
      policyEvidence = advanceConsumptionPolicyEvidence(policyEvidence, interval);
      memory = advanceConsumptionMemory(memory, interval);
      if (interval.kind === 'intervention' && before !== memory.memory) throw new Error('INTERVENTION_SELF_PRESSURE');
      if (world.kind === 'outside' && interval.kind === 'unknown') unknownOutsideMs += interval.endedAt - interval.startedAt;
    }
    pointCount += observed.pointCount;
    if (keepTrace) evidence.push(...observed.evidence);
    at = until; admission.setTime(at);
  }
  async function request(kind, context) {
    const isGate = kind === 'gate_interstitial';
    const intensity = isGate && policy === 'adaptive'
      ? projectShishiConsumptionLevel({ enabled: true, consumption: { ...projectConsumptionMemory(memory, at), policyEvidence } })
      : { holdDurationMs: isGate ? shishiEntryDurationMs(0) : context.durationMs, status: 'fixed' };
    const selected = isGate && policy === 'adaptive'
      ? { ...intensity, holdDurationMs: shishiEntryDurationMs(intensity.waitExtensionMs) } : intensity;
    const result = await admission.request(kind, { tabId: world.tab, ...(isGate ? { gateKind: 'entryCheckpoint' } : {}) });
    const row = { at, kind, accepted: result.accepted, reason: result.reason, key: context.key,
      memory: memory.memory, levelStatus: selected.status, holdDurationMs: selected.holdDurationMs };
    attempts.push(row);
    if (!result.accepted) { denials[result.reason] = (denials[result.reason] ?? 0) + 1; return; }
    const failure = deterministicDraw(context.key, 'presentation') < presentationFailureRate;
    schedule(at + 100, 'present', { lease: result.lease, row, selected: Object.freeze(selected), failure, context });
  }
  async function enter(context) {
    entryAttempts++;
    const hostname = hostFor(world);
    const result = gate.evaluate({ hostname, tabId: world.tab, now: at, enteredAt: latestEntryAt,
      isForeground: world.kind === 'protected_use' });
    if (!result.eligible) {
      const reason = result.telemetry.entryApproved ? 'entry_approved' : 'ineligible';
      denials[reason] = (denials[reason] ?? 0) + 1;
      return;
    }
    eligible++;
    await request('gate_interstitial', { ...context, hostname, tabId: world.tab });
  }
  for (const [index, interval] of pattern.intervals.entries()) {
    schedule(BASE + interval.startedAt, 'world', { interval, key: `intent:${index}` });
  }
  // Deliver the existing production observation cadence as virtual fixture
  // events. These update evidence; they never request or retry a Gate.
  for (let t = 60_000; t < pattern.durationMs; t += 60_000) schedule(BASE + t, 'observation', null);
  if (competing) {
    // Explicit external candidate fixtures, not a reimplementation of Furin's
    // timer/debt/episode generator. Rejected fixtures have no replay obligation.
    for (let t = 30 * 60_000; t < pattern.durationMs; t += 60 * 60_000) {
      schedule(BASE + t, 'external', { kind: 'global_sentinel', durationMs: 20_000, key: `global:${t}` });
      schedule(BASE + t + 1000, 'external', { kind: 'site_furin', durationMs: 20_000, key: `site:${t}` });
    }
  }
  const horizon = BASE + pattern.durationMs;
  while (events.length) {
    events.sort((a, b) => a.time - b.time || a.serial - b.serial);
    const event = events.shift();
    if (event.time > horizon) break;
    await settle(event.time);
    if (event.type === 'world') {
      const { interval, key } = event.detail;
      // This driver interprets the next incompatible scripted intent as an
      // explicit cancellation, with a cleanup receipt. A timer must never grant
      // a continue/pass for a person who has already abandoned the fixture.
      for (const exposure of exposures.filter((item) => item.endedAt === null && item.lease.gateKind !== null)) {
        if (interval.kind !== 'protected_use' || interval.tab !== exposure.lease.tabId) {
          const result = await admission.end(exposure.lease);
          if (!result.accepted) throw new Error('JOURNEY_ABANDON_REJECTED');
          exposure.endedAt = at; exposure.decision = 'abandoned';
        }
      }
      previousWorld = world;
      world = { kind: interval.kind === 'intervention' ? 'protected_use' : interval.kind, tab: interval.tab,
        beganAt: at, plannedDurationMs: interval.endedAt - interval.startedAt };
      gate.observe(await buildGateEntryPresence(browserEnvironmentInput(at)));
      admission.focus(['protected_use', 'outside'].includes(world.kind) ? world.tab : -1);
      if (interval.kind !== 'intervention' && world.kind === 'protected_use' && (previousWorld.kind !== 'protected_use' || previousWorld.tab !== world.tab)) {
        latestEntryAt = at;
        await enter({ key, plannedDurationMs: world.plannedDurationMs,
          afterLongDeparture: previousWorld.kind === 'outside' && at - previousWorld.beganAt >= 30 * 60_000 });
      }
      if (interval.kind === 'intervention') await request('enso_gate', { key, durationMs: world.plannedDurationMs });
    } else if (event.type === 'external') {
      await request(event.detail.kind, event.detail);
    } else if (event.type === 'present') {
      const detail = event.detail;
      const foreground = detail.lease.tabId === world.tab && ['protected_use', 'outside'].includes(world.kind);
      if (detail.failure || !foreground) {
        failedPresentations++;
        await admission.end(detail.lease);
        continue;
      }
      const shown = await admission.present(detail.lease);
      if (!shown.accepted) throw new Error(`JOURNEY_PRESENTATION_REJECTED:${shown.reason}`);
      const last = exposures.at(-1);
      if (last && (last.endedAt === null || at < last.endedAt + INTERVENTION_RECOVERY_MS)) throw new Error('JOURNEY_EXPOSURE_GAP_VIOLATION');
      const exposure = { ...detail, startedAt: at, endedAt: null };
      exposures.push(exposure);
      schedule(at + detail.selected.holdDurationMs, 'end', exposure);
    } else if (event.type === 'end') {
      const exposure = event.detail;
      if (exposure.endedAt !== null) continue;
      const result = await admission.end(exposure.lease);
      if (!result.accepted) throw new Error('JOURNEY_STALE_END');
      exposure.endedAt = at;
      if (exposure.lease.gateKind !== null) {
        const draw = deterministicDraw(exposure.context.key, 'reaction');
        const profile = REACTION_PROFILES[reaction];
        const decision = draw < profile.leave + profile.switch ? 'leave' : 'continue';
        gate.decide({ sessionId: exposure.lease.leaseId, now: at, decision });
        exposure.decision = decision;
        // A response may change only the intent which actually met this gate.
        // Subsequent explicit fixture actions remain independent user boundaries.
        if (world.beganAt === exposure.row.at && decision === 'leave') {
          if (draw < profile.leave) {
            world = { kind: 'outside', tab: world.tab, beganAt: at, plannedDurationMs: 0 };
            admission.focus(world.tab);
          } else {
            world = { kind: 'protected_use', tab: (world.tab + 1) % 8, beganAt: at, plannedDurationMs: 0 };
            admission.focus(world.tab); latestEntryAt = at;
            await enter({ key: `${exposure.context.key}:switch`, plannedDurationMs: 0, afterLongDeparture: false });
          }
        }
      }
    }
  }
  await settle(horizon);
  const shownGates = exposures.filter((item) => item.lease.gateKind !== null);
  const elapsed = (item) => (item.endedAt === null ? horizon : item.endedAt) - item.startedAt;
  const waitMs = shownGates.reduce((sum, item) => sum + elapsed(item), 0);
  const shortVisitWaitMs = shownGates.filter((item) => item.context.plannedDurationMs <= 5000).reduce((sum, item) => sum + elapsed(item), 0);
  const longDepartureWaitMs = shownGates.filter((item) => item.context.afterLongDeparture).reduce((sum, item) => sum + elapsed(item), 0);
  const summary = { policy, collection, reaction, entryAttempts, eligible, requestCount: attempts.length,
    shown: exposures.length, shownGates: shownGates.length, waitMs, shortVisitWaitMs, longDepartureWaitMs,
    failedPresentations, denials, finalMemory: memory.memory, durations: memory.durations,
    unknownOutsideMs, pointCount, abandonedGates: shownGates.filter((item) => item.decision === 'abandoned').length,
    unresolvedAtHorizon: exposures.filter((item) => item.endedAt === null).length };
  if (keepTrace) return { ...summary, attempts, evidence, exposures: exposures.map((item) => ({
    kind: item.lease.kind, startedAt: item.startedAt, endedAt: item.endedAt,
    holdDurationMs: item.selected.holdDurationMs, decision: item.decision ?? null })) };
  return summary;
}
