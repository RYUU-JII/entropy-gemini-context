import {
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';

function normalizeFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeBudgetMinutes(value) {
  const minutes = normalizeFiniteNumber(value);
  return minutes > 0 ? minutes : 0;
}

function normalizeHost(host) {
  return typeof host === 'string' ? host.trim().toLowerCase() : '';
}

function readNumberWithFallback(primaryReader, fallbackValue, input) {
  if (typeof primaryReader === 'function') {
    const value = primaryReader(input);
    return normalizeFiniteNumber(value);
  }
  return normalizeFiniteNumber(fallbackValue);
}

export function createBudgetSnapshotReader({
  getSiteDayMs = null,
  getSessionMs = null,
} = {}) {
  function readSnapshot({
    profile,
    host,
    context = {},
  } = {}) {
    const normalizedProfile = normalizeProtectionProfile(profile);
    const normalizedHost = normalizeHost(host);
    const budgetEntry = normalizedProfile.budgets?.[normalizedHost] || null;
    const dailyMinutes = normalizeBudgetMinutes(
      context?.effectiveTargetMinutes ?? budgetEntry?.dailyMinutes,
    );
    const siteDayMs = readNumberWithFallback(getSiteDayMs, context?.siteDayMs, {
      host: normalizedHost,
      context,
      profile: normalizedProfile,
    });
    const sessionMs = readNumberWithFallback(getSessionMs, context?.sessionMs, {
      host: normalizedHost,
      context,
      profile: normalizedProfile,
    });

    const budgetRatio = dailyMinutes > 0
      ? siteDayMs / (dailyMinutes * 60_000)
      : 0;

    return {
      host: normalizedHost,
      dailyMinutes,
      siteDayMs,
      sessionMs,
      budgetRatio,
    };
  }

  return {
    readSnapshot,
  };
}
