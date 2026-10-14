import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { runtimeSendMessage } from '../../../../platform/messaging/runtime/runtimeMessaging.js';
import {
  RITUAL_SURFACE_OBSERVER_EVENTS,
  RITUAL_SURFACE_TYPES,
  setRitualSurfaceObserver,
} from '../../../nudge/runtime/ritualSurfaceArbiter.js';
import {
  INTERVENTION_PHASES,
  INTERVENTION_SURFACE_IDS,
} from '../../contracts/interventionLedgerContract.js';

/**
 * Every ritual surface except the gate interstitial. The gate records itself
 * from the background, where it owns a session and knows its own decision, and
 * recording it here as well would double every gate episode in the ledger.
 */
const SURFACE_ID_BY_RITUAL_TYPE = Object.freeze({
  [RITUAL_SURFACE_TYPES.PRESAGE]: INTERVENTION_SURFACE_IDS.FLARE_PRESAGE,
  [RITUAL_SURFACE_TYPES.ENSO_GATE]: INTERVENTION_SURFACE_IDS.BARRIER_CONSUMPTION_BOUNDARY,
  [RITUAL_SURFACE_TYPES.SITE_FURIN]: INTERVENTION_SURFACE_IDS.FLARE_SITE_FURIN,
  [RITUAL_SURFACE_TYPES.GLOBAL_SENTINEL]: INTERVENTION_SURFACE_IDS.FLARE_GLOBAL_SENTINEL,
});

/**
 * What arbitration outcomes mean to the ledger.
 *
 *   claimed   - the surface took the screen.
 *   refused   - it asked and a higher surface already held it.
 *   suppressed- it held the screen and a higher surface took it away.
 *   released  - the episode ended.
 *
 * `refused` and `suppressed` are both recorded as SUPPRESSED because they are
 * the same fact for a saturation reader: policy wanted to interrupt and did
 * not. They stay distinguishable by their reason.
 */
const PHASE_BY_OBSERVER_EVENT = Object.freeze({
  [RITUAL_SURFACE_OBSERVER_EVENTS.CLAIMED]: INTERVENTION_PHASES.SHOWN,
  [RITUAL_SURFACE_OBSERVER_EVENTS.REFUSED]: INTERVENTION_PHASES.SUPPRESSED,
  [RITUAL_SURFACE_OBSERVER_EVENTS.SUPPRESSED]: INTERVENTION_PHASES.SUPPRESSED,
  [RITUAL_SURFACE_OBSERVER_EVENTS.RELEASED]: INTERVENTION_PHASES.RESOLVED,
});

const MAX_PENDING_RECORDS = 64;

let pendingRecords = [];
let flushHandle = null;
let installed = false;

function resolveHostname() {
  if (typeof window === 'undefined') return '';
  const hostname = window.location?.hostname;
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function buildRecord(event) {
  const surfaceId = SURFACE_ID_BY_RITUAL_TYPE[event?.surface?.type];
  if (!surfaceId) return null;
  const phase = PHASE_BY_OBSERVER_EVENT[event?.kind];
  if (!phase) return null;

  const by = typeof event?.by?.type === 'string' ? event.by.type : '';
  const reason = typeof event?.reason === 'string' ? event.reason : '';
  return {
    surfaceId,
    phase,
    // The tab is filled in by the background from the message sender: a content
    // script cannot name its own tab, and one that claimed to would be
    // asserting something it has no standing to assert.
    hostname: resolveHostname(),
    reason: by ? `${reason}:${by}` : reason,
    sessionId: typeof event?.surface?.scope === 'string' ? event.surface.scope : '',
    at: Date.now(),
  };
}

function flushPendingRecords() {
  flushHandle = null;
  if (!pendingRecords.length) return;
  const records = pendingRecords;
  pendingRecords = [];
  // Losing an observation must not disturb the surface that produced it, but a
  // ledger with silent holes is worse than one that says it has holes. A dead
  // channel throws where a live one rejects, so both are reported the same way.
  const reportFailure = (error) => {
    console.error('[RitualSurfaceLedger] failed to record surface episode', error);
  };
  try {
    void Promise.resolve(runtimeSendMessage({
      action: MESSAGE_ACTIONS.RECORD_RITUAL_SURFACE_LEDGER,
      records,
    })).catch(reportFailure);
  } catch (error) {
    reportFailure(error);
  }
}

function scheduleFlush() {
  if (flushHandle !== null) return;
  flushHandle = setTimeout(flushPendingRecords, 0);
}

function handleSurfaceEvent(event) {
  const record = buildRecord(event);
  if (!record) return;
  if (pendingRecords.length >= MAX_PENDING_RECORDS) {
    // A backlog this deep means the channel is gone, not that the user is being
    // interrupted 64 times at once. Drop the oldest rather than grow without
    // bound on a page that will never deliver them.
    pendingRecords.shift();
  }
  pendingRecords.push(record);
  scheduleFlush();
}

/**
 * Routes every ritual surface episode to the background intervention ledger.
 *
 * One installation covers all of them: the arbiter is already the only place
 * that knows which surface holds the screen, so nothing has to be added to the
 * surfaces themselves, and a surface that is added later is recorded without
 * being taught to report.
 */
export function installRitualSurfaceLedgerReporter() {
  if (installed) return false;
  setRitualSurfaceObserver(handleSurfaceEvent);
  installed = true;
  return true;
}

export function teardownRitualSurfaceLedgerReporter() {
  if (!installed) return false;
  setRitualSurfaceObserver(null);
  if (flushHandle !== null) {
    clearTimeout(flushHandle);
    flushHandle = null;
  }
  pendingRecords = [];
  installed = false;
  return true;
}

export function flushRitualSurfaceLedgerForTest() {
  if (flushHandle !== null) {
    clearTimeout(flushHandle);
  }
  flushPendingRecords();
}
