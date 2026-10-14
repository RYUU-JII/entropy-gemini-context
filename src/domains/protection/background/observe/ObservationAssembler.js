import {
  normalizeObservation,
} from '../../contracts/protectionContracts.js';
import { createBudgetSnapshotReader } from './BudgetSnapshotReader.js';
import { createPressureSignalResolver } from './PressureSignalResolver.js';
import { createDirectTriggerResolver } from './DirectTriggerResolver.js';

function normalizeTabId(tabId) {
  const num = Number(tabId);
  return Number.isInteger(num) ? num : -1;
}

function normalizeNow(now) {
  const num = Number(now);
  return Number.isFinite(num) ? num : Date.now();
}

export function createObservationAssembler({
  budgetSnapshotReader = createBudgetSnapshotReader(),
  pressureSignalResolver = createPressureSignalResolver(),
  directTriggerResolver = createDirectTriggerResolver(),
} = {}) {
  function assemble({
    profile,
    host,
    tabId,
    context = {},
    now = Date.now(),
  } = {}) {
    const snapshot = budgetSnapshotReader.readSnapshot({
      profile,
      host,
      context,
    });
    const pressureSignals = pressureSignalResolver.resolve({
      profile,
      host: snapshot.host,
      context,
      snapshot,
    });
    const directTriggers = directTriggerResolver.resolve({
      profile,
      host: snapshot.host,
      context,
      snapshot,
    });

    return normalizeObservation({
      host: snapshot.host,
      tabId: normalizeTabId(tabId),
      now: normalizeNow(now),
      siteDayMs: snapshot.siteDayMs,
      sessionMs: snapshot.sessionMs,
      budgetRatio: snapshot.budgetRatio,
      pressureSignals,
      directTriggers,
    });
  }

  return {
    assemble,
  };
}
