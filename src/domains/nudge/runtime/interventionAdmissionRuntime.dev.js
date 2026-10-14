import {
  InterventionAdmissionArbiter,
} from './InterventionAdmissionArbiter.js';
import {
  createEnsoInterventionCandidate,
} from '../interaction/ensoInterventionCandidate.js';
import {
  classifyInterventionConsumptionPattern,
} from '../attention/consumptionPatternClassifier.js';
import {
  DEFAULT_INTERVENTION_SHADOW_EPOCH_MS,
  InterventionAdmissionShadow,
} from './InterventionAdmissionShadow.js';

export const INTERVENTION_ADMISSION_RUNTIME_ENABLED = true;

export function createInterventionAdmissionRuntime(options = {}) {
  const {
    shadowEpochMs = DEFAULT_INTERVENTION_SHADOW_EPOCH_MS,
    shadowSchedule,
    shadowCancel,
    ...arbiterOptions
  } = options;
  const arbiter = new InterventionAdmissionArbiter(arbiterOptions);
  const shadow = new InterventionAdmissionShadow({
    epochMs: shadowEpochMs,
    now: arbiterOptions.now,
    ...(typeof shadowSchedule === 'function'
      ? { schedule: shadowSchedule }
      : {}),
    ...(typeof shadowCancel === 'function'
      ? { cancel: shadowCancel }
      : {}),
  });
  let latestBingeDetection = null;
  let latestMediaEvidence = null;

  const projectConsumptionProfile = (context = {}) => {
    const now = context?.now ?? Date.now();
    if (Object.prototype.hasOwnProperty.call(context, 'bingeDetection')) {
      latestBingeDetection = context.bingeDetection;
    }
    if (Object.prototype.hasOwnProperty.call(context, 'mediaEvidence')) {
      latestMediaEvidence = context.mediaEvidence;
    }
    return classifyInterventionConsumptionPattern({
      bingeDetection: latestBingeDetection,
      mediaEvidence: latestMediaEvidence,
      now,
    });
  };

  const reserveWeightedCandidate = (candidate, context = {}) => {
    const now = context?.now ?? Date.now();
    const consumptionProfile = projectConsumptionProfile({
      ...context,
      now,
    });
    const profileWeight = consumptionProfile.weights?.[candidate?.kind];
    const weightedCandidate = Number.isFinite(Number(profileWeight))
      ? Object.freeze({
          ...candidate,
          weight: Number(profileWeight),
        })
      : candidate;
    const result = arbiter.request(weightedCandidate, { now });
    const shadowSnapshot = shadow.observe({
      candidate: weightedCandidate,
      actualAdmission: result,
      consumptionProfile,
      now,
    });
    return Object.freeze({
      ...result,
      candidate: weightedCandidate,
      consumptionProfile,
      shadowSnapshot,
    });
  };

  return Object.freeze({
    enabled: true,
    // This research-only arbiter is synchronous and never has a prepared ticket.
    canCompletePrepared: () => false,
    getSnapshot: () => arbiter.getSnapshot(),
    subscribe: (subscription) => arbiter.subscribe(subscription),
    getShadowSnapshot: (context) => shadow.flush(context),
    subscribeShadow: (subscription) => shadow.subscribe(subscription),
    disposeShadow: () => shadow.dispose(),
    getConsumptionProfile: (context) => projectConsumptionProfile(context),
    observeConsumptionEvidence: (context) => projectConsumptionProfile(context),
    reserveCandidate: reserveWeightedCandidate,
    reserveEnso: ({
      source,
      requestSerial,
      bingeDetection = null,
      now = Date.now(),
    } = {}) => reserveWeightedCandidate(
      createEnsoInterventionCandidate({
        source,
        requestSerial,
        now,
      }),
      { bingeDetection, now },
    ),
    present: (lease, context) => arbiter.present(lease, context),
    abort: (lease, context) => arbiter.abort(lease, context),
    release: (lease, context) => arbiter.release(lease, context),
    setContext: (context) => arbiter.setContext(context),
  });
}

export const sharedInterventionAdmissionRuntime =
  createInterventionAdmissionRuntime();

export default sharedInterventionAdmissionRuntime;
