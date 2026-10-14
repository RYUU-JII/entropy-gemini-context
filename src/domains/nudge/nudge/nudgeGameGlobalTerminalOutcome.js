import { SENTINEL_OUTCOME_REASONS } from '../runtime/sentinelOutcomeContract.js';
import { SENTINEL_MEDIA_RESTORE_MODES } from './nudgeGameMediaSuppression.js';

export const GLOBAL_SENTINEL_TERMINAL_OUTCOMES = Object.freeze({
  FRACTURE_ESCAPE: 'fracture_escape',
  RESYNCHRONIZED: 'resynchronized',
});

export function resolveGlobalSentinelTerminalOutcome(outcome) {
  if (outcome === 'success') {
    return {
      outcome: 'success',
      terminalOutcome: GLOBAL_SENTINEL_TERMINAL_OUTCOMES.FRACTURE_ESCAPE,
      outcomeReason: SENTINEL_OUTCOME_REASONS.GLOBAL_COLLAPSE_SUCCESS,
      mediaRestoreMode: SENTINEL_MEDIA_RESTORE_MODES.RELEASE,
      opensRiftInvite: true,
      poisonedReward: false,
    };
  }
  if (outcome === 'failure') {
    return {
      outcome: 'failure',
      terminalOutcome: GLOBAL_SENTINEL_TERMINAL_OUTCOMES.RESYNCHRONIZED,
      outcomeReason: SENTINEL_OUTCOME_REASONS.GLOBAL_RESYNC_FAILURE,
      mediaRestoreMode: SENTINEL_MEDIA_RESTORE_MODES.RELEASE,
      opensRiftInvite: false,
      poisonedReward: false,
    };
  }
  throw new Error(`global_sentinel_terminal_outcome_invalid:${String(outcome)}`);
}
