import {
  normalizeDirectTriggers,
} from '../../contracts/protectionContracts.js';

const CONTEXT_DIRECT_TRIGGER_FLAGS = Object.freeze([
  ['shortFormEntry', 'SHORT_FORM_ENTRY'],
  ['videoSeekAbuse', 'VIDEO_SEEK_ABUSE'],
  ['sessionEnd', 'SESSION_END'],
  ['siteExit', 'SITE_EXIT'],
]);

function sortTriggers(triggers = []) {
  return [...triggers].sort((left, right) => left.localeCompare(right));
}

export function createDirectTriggerResolver({
  nearExhaustedRatio = 0.85,
  exceededRatio = 1,
} = {}) {
  function resolve({
    context = {},
    snapshot = {},
  } = {}) {
    const triggers = new Set(normalizeDirectTriggers(context?.directTriggers));

    CONTEXT_DIRECT_TRIGGER_FLAGS.forEach(([flagKey, trigger]) => {
      if (context?.[flagKey]) {
        triggers.add(trigger);
      }
    });

    const budgetRatio = Number(snapshot?.budgetRatio) || 0;
    if (budgetRatio >= nearExhaustedRatio) {
      triggers.add('BUDGET_NEAR_EXHAUSTED');
    }
    if (budgetRatio >= exceededRatio) {
      triggers.add('BUDGET_EXCEEDED');
    }

    return sortTriggers(triggers);
  }

  return {
    resolve,
  };
}
