import { resolveDopamineBingeDetection } from './dopamineBingeDetector.js';
import RewardDriftObservationRuntime from './RewardDriftObservationRuntime.js';

function assertFeedEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || evidence.kind !== 'feed_flow') {
    throw new Error('DOPAMINE_BINGE_FEED_EVIDENCE_INVALID');
  }
  if (!Number.isFinite(Number(evidence.observedAt)) || Number(evidence.observedAt) < 0) {
    throw new Error('DOPAMINE_BINGE_FEED_EVIDENCE_TIMESTAMP_INVALID');
  }
}

export class DopamineBingeEvidenceRuntime {
  constructor() {
    this._rewardObservation = new RewardDriftObservationRuntime();
    this.reset();
  }

  observeFeedEvidence(evidence) {
    assertFeedEvidence(evidence);
    this._feedEvidence = evidence;
    return evidence;
  }

  configureRewardObservation(options) {
    return this._rewardObservation.configure(options);
  }

  recordRewardTransition(transition) {
    return this._rewardObservation.recordTransition(transition);
  }

  hasRewardObservation() {
    return this._rewardObservation.hasObservation();
  }

  clearFeedEvidence() {
    this._feedEvidence = null;
  }

  clearRewardEvidence() {
    this._rewardObservation.clear();
  }

  resolve(options = {}) {
    if (Object.hasOwn(options, 'rewardEvidence')) {
      throw new Error('DOPAMINE_BINGE_REWARD_EVIDENCE_OVERRIDE_UNSUPPORTED');
    }
    const { now = Date.now() } = options;
    return resolveDopamineBingeDetection({
      rewardEvidence: this.getRewardEvidence({ now }),
      feedEvidence: this._feedEvidence,
      now,
    });
  }

  getFeedEvidence() {
    return this._feedEvidence;
  }

  getRewardEvidence({ now = Date.now() } = {}) {
    return this._rewardObservation.getEvidence({ now });
  }

  reset() {
    this._feedEvidence = null;
    this._rewardObservation.clear();
  }
}

export const dopamineBingeEvidenceRuntime = new DopamineBingeEvidenceRuntime();

export default dopamineBingeEvidenceRuntime;
