import assert from 'node:assert/strict';
import { createAdmissionHarness } from './admissionHarness.mjs';
import { createGateReplayPolicy, REPLAY_HOSTS } from './gateReplayPolicy.mjs';
import { replayConsumptionJourney } from './replayJourney.mjs';
import { INTERVENTION_RECOVERY_MS, INTERVENTION_CANDIDATE_TTL_MS } from '../../../src/domains/nudge/runtime/interventionPolicy.js';

export function journeyPattern(steps, seed = 91) {
  let at = 0;
  const intervals = steps.map(([kind, durationMs, tab = 0], index) => {
    const input = { epoch: 'journey-fixture', sequence: index + 1, startedAt: at,
      endedAt: at + durationMs, kind, tab, domain: tab % 4 };
    at += durationMs; return input;
  });
  return { profile: 'explicit', seed, durationMs: at, intervals };
}

export async function evaluateJourneyContracts() {
  // These Enso cases isolate collision, cleanup and recovery, not automatic
  // consumption eligibility. Use explicit manual demand instead of assuming an
  // unobserved cadence is ready. Automatic cadence has production-owner suites.
  const checks = [];
  async function check(name, work) {
    try { await work(); checks.push({ name, passed: true }); }
    catch (error) { checks.push({ name, passed: false, error: error.message }); }
  }
  await check('ordinary intervention does not preempt an ongoing Enso or Site Furin', async () => {
    for (const [first, second] of [['enso_gate', 'site_furin'], ['enso_gate', 'global_sentinel'], ['site_furin', 'global_sentinel']]) {
      const h = createAdmissionHarness(); const acquired = await h.request(first, { manual: first === 'enso_gate' }); await h.present(acquired.lease);
      assert.equal((await h.request(second)).reason, 'active_intervention');
      assert.equal(h.raw().owner.leaseId, acquired.lease.leaseId);
    }
  });
  await check('mandatory cleanup transfers ownership and stale end/closure cannot act', async () => {
    const h = createAdmissionHarness(); const first = await h.request('enso_gate', { manual: true }); await h.present(first.lease);
    h.setTime(h.now() + 1000);
    const mandatory = await h.request('gate_interstitial', { gateKind: 'isolation' });
    assert.equal(mandatory.accepted, true); assert.equal(h.receipts.get(first.lease.leaseId).active, false);
    await h.present(mandatory.lease);
    assert.equal((await h.service.transition(first.lease, 'ended')).reason, 'stale_lease');
    let acted = false;
    const stale = await h.service.resolve(first.lease, async () => { acted = true; });
    assert.equal(stale.outcome, 'refused'); assert.equal(acted, false);
    assert.equal((await h.request('site_furin')).reason, 'active_intervention');
  });
  await check('unclean mandatory revocation rejects without transferring ownership', async () => {
    const h = createAdmissionHarness(); const first = await h.request('site_furin'); await h.present(first.lease);
    h.receipts.get(first.lease.leaseId).cleaned = false;
    await assert.rejects(h.request('gate_interstitial', { gateKind: 'isolation' }), /CLEANUP_UNCONFIRMED/);
    assert.equal(h.raw().owner.leaseId, first.lease.leaseId);
  });
  await check('worker recreation and tab changes preserve end-based recovery', async () => {
    const h = createAdmissionHarness(); const first = await h.request('enso_gate', { manual: true }); await h.present(first.lease);
    h.setTime(h.now() + 1000); await h.end(first.lease);
    const end = h.now(); h.restart(); h.focus(1);
    h.setTime(end + INTERVENTION_RECOVERY_MS - 1);
    assert.equal((await h.request('site_furin')).reason, 'global_gap');
    h.setTime(end + INTERVENTION_RECOVERY_MS);
    assert.equal((await h.request('site_furin')).accepted, true);
  });
  await check('concurrent requests serialize; another tab cannot acquire the active lease', async () => {
    const h = createAdmissionHarness();
    const pair = await Promise.all([h.request('enso_gate', { manual: true }), h.request('global_sentinel')]);
    assert.equal(pair.filter((value) => value.accepted).length, 1);
    h.focus(1); h.restart();
    assert.equal((await h.request('site_furin')).reason, 'active_intervention');
  });
  await check('pre-presentation abort and write failure consume no exposure or cooldown', async () => {
    const h = createAdmissionHarness(); const first = await h.request('enso_gate', { manual: true }); await h.end(first.lease);
    assert.equal(h.raw().kernel.globalNotBefore, 0);
    h.failWrite(); await assert.rejects(h.request('site_furin'), /SIMULATED_SESSION_WRITE_FAILURE/);
    h.restart(); const retry = await h.request('site_furin');
    assert.equal(retry.accepted, true); assert.equal(h.raw().kernel.lastPresentedAt, 0);
  });
  await check('expired evidence and reservation cannot become exposure', async () => {
    const h = createAdmissionHarness();
    assert.equal((await h.request('enso_gate', { observedAt: h.now() - INTERVENTION_CANDIDATE_TTL_MS })).reason, 'candidate_stale');
    const first = await h.request('gate_interstitial', { gateKind: 'entryCheckpoint' });
    h.setTime(first.lease.reservedUntil + 1);
    assert.equal((await h.present(first.lease)).reason, 'reservation_expired');
    const next = await h.request('site_furin');
    assert.equal(next.accepted, true); assert.equal(h.raw().kernel.globalNotBefore, 0);
  });
  await check('manual and automatic presentations remain mutually exclusive', async () => {
    const h = createAdmissionHarness(); const automatic = await h.request('global_sentinel'); await h.present(automatic.lease);
    assert.equal((await h.request('site_furin', { manual: true })).reason, 'active_intervention');
    await h.end(automatic.lease);
    const manual = await h.request('site_furin', { manual: true }); await h.present(manual.lease);
    assert.equal((await h.request('global_sentinel')).reason, 'active_intervention');
    assert.equal((await h.service.transition(automatic.lease, 'ended')).reason, 'stale_lease');
  });
  await check('Gate eligibility, stale entry and shared approval use the production policies', async () => {
    const gate = createGateReplayPolicy(), base = { hostname: REPLAY_HOSTS[0], tabId: 0, now: 100_000 };
    assert.equal(gate.evaluate(base).eligible, true);
    assert.equal(gate.evaluate({ ...base, enabled: false }).eligible, false);
    assert.equal(gate.evaluate({ ...base, enteredAt: 1 }).eligible, false);
    gate.decide({ ...base, decision: 'leave' }); assert.equal(gate.evaluate(base).eligible, true);
    gate.decide({ ...base, decision: 'continue', sessionId: 'first' });
    assert.equal(gate.evaluate({ ...base, tabId: 4 }).eligible, false);
    assert.equal(gate.evaluate({ ...base, hostname: REPLAY_HOSTS[1], tabId: 1 }).eligible, false);
    gate.observe({ observedAt: base.now + 1, presence: 'away' });
    for (let minute = 1; minute <= 10; minute++) {
      gate.observe({ observedAt: base.now + 1 + minute * 60_000, presence: 'away' });
      assert.equal(gate.getApproval().approved, minute < 10);
    }
    assert.equal(gate.evaluate({ ...base, now: base.now + 600_002 }).eligible, true);
  });
  await check('suppressed Gate is not replayed when recovery expires without a fresh entry', async () => {
    const pattern = journeyPattern([['protected_use', 2000, 0], ['protected_use', 120_000, 1]]);
    const replay = await replayConsumptionJourney(pattern, { competing: false, presentationFailureRate: 0, keepTrace: true });
    assert.equal(replay.shownGates, 1); assert.equal(replay.denials.global_gap, 1);
    assert.equal(replay.attempts.length, 2);
    const fresh = await replayConsumptionJourney(journeyPattern([
      ['protected_use', 2000, 0], ['protected_use', 120_000, 1], ['protected_use', 10_000, 2],
    ]), { competing: false, presentationFailureRate: 0 });
    assert.equal(fresh.shownGates, 2);
  });
  await check('failed render leaves all confirmed use and no intervention time', async () => {
    const replay = await replayConsumptionJourney(journeyPattern([['protected_use', 5000, 0], ['protected_use', 5000, 1]]),
      { competing: false, presentationFailureRate: 1 });
    assert.equal(replay.shown, 0); assert.equal(replay.failedPresentations, 2);
    assert.equal(replay.durations.intervention, 0); assert.equal(replay.durations.protected_use, 10_000);
  });
  await check('actual waiting is excluded and broader consent alone cannot certify rest', async () => {
    const pattern = journeyPattern([['protected_use', 30 * 60_000], ['outside', 5 * 60_000], ['protected_use', 30 * 60_000, 1]]);
    const restricted = await replayConsumptionJourney(pattern, { policy: 'adaptive', competing: false, presentationFailureRate: 0 });
    const broad = await replayConsumptionJourney(pattern, { policy: 'adaptive', collection: 'all_sites_minimal', competing: false, presentationFailureRate: 0 });
    assert.equal(restricted.durations.intervention, restricted.waitMs);
    assert.equal(restricted.durations.outside, 0); assert.equal(broad.durations.outside, 0);
    assert.equal(restricted.finalMemory, broad.finalMemory);
    assert.equal(restricted.unknownOutsideMs, 5 * 60_000);
  });
  return checks;
}
