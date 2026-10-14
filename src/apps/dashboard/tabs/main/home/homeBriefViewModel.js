import { formatMinutes } from '@/apps/dashboard/utils/formatters.js';

const MINUTE_MS = 60000;
const ALERT_RATIO = 1;
const WARN_RATIO = 0.85;

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAbsoluteMinutes(ms) {
  return formatMinutes(Math.max(0, toNumber(ms)));
}

function formatPercentRatio(ratio) {
  return `${Math.round(Math.max(0, Math.min(1, toNumber(ratio))) * 100)}%`;
}

function dedupeChips(chips = []) {
  const seen = new Set();
  return chips.filter((chip) => {
    const key = `${chip?.id || ''}:${chip?.text || ''}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveBriefTone({
  isManaged = false,
  ratio = 0,
  deltaMs = 0,
  peakWindowActiveMs = 0,
  goalMs = 0,
  focusUsedMs = 0,
}) {
  if (!isManaged) {
    return focusUsedMs > 0 ? 'warn' : 'muted';
  }
  if (goalMs > 0 && ratio >= ALERT_RATIO) return 'alert';
  if (goalMs > 0 && ratio >= WARN_RATIO) return 'warn';
  if (deltaMs >= 12 * MINUTE_MS || peakWindowActiveMs >= 14 * MINUTE_MS) return 'active';
  return 'ok';
}

function resolveBriefStatusLabel(tone, isManaged, hasFocus, tTabs) {
  if (!hasFocus) return tTabs('main.brief_status_idle', {});
  if (!isManaged) return tTabs('main.brief_status_unmanaged', {});
  switch (tone) {
    case 'alert':
      return tTabs('main.brief_status_over', {});
    case 'warn':
      return tTabs('main.brief_status_near', {});
    case 'active':
      return tTabs('main.brief_status_rising', {});
    default:
      return tTabs('main.brief_status_stable', {});
  }
}

function buildBriefVerdict({
  focusDomain,
  focusUsedMs,
  goalMs,
  deltaMs,
  isManaged,
  tTabs,
}) {
  if (!focusDomain) return tTabs('main.brief_verdict_idle', {});
  if (!isManaged) {
    return tTabs('main.brief_verdict_today_value', {
      value: formatAbsoluteMinutes(focusUsedMs),
    });
  }

  if (goalMs > 0 && focusUsedMs > goalMs) {
    return tTabs('main.brief_verdict_over_value', {
      value: formatAbsoluteMinutes(focusUsedMs - goalMs),
    });
  }

  const remainingMs = Math.max(0, goalMs - focusUsedMs);
  if (goalMs > 0 && remainingMs <= 20 * MINUTE_MS) {
    return tTabs('main.brief_verdict_left_value', {
      value: formatAbsoluteMinutes(remainingMs),
    });
  }

  if (deltaMs >= 12 * MINUTE_MS) {
    return tTabs('main.brief_verdict_average_up_value', {
      value: formatAbsoluteMinutes(deltaMs),
    });
  }

  if (deltaMs <= -12 * MINUTE_MS) {
    return tTabs('main.brief_verdict_average_down_value', {
      value: formatAbsoluteMinutes(Math.abs(deltaMs)),
    });
  }

  return tTabs('main.brief_verdict_today_value', {
    value: formatAbsoluteMinutes(focusUsedMs),
  });
}

function buildBriefSupportText({
  focusDomain,
  tTabs,
}) {
  if (!focusDomain) return tTabs('main.brief_support_idle', {});
  return null;
}

function buildBriefChips({
  primaryInsightChip = null,
  focusUsedMs,
  goalMs,
  deltaMs,
  peakWindow,
  isManaged,
  tTabs,
}) {
  const chips = [];
  if (primaryInsightChip?.id && primaryInsightChip?.text) {
    chips.push(primaryInsightChip);
  }
  const todayChip = focusUsedMs > 0
    ? {
      id: 'today',
      text: tTabs('main.brief_chip_today_compact', {
        value: formatAbsoluteMinutes(focusUsedMs),
      }),
    }
    : null;

  const peakChip = peakWindow?.activeMs >= 8 * MINUTE_MS
    ? {
      id: 'peak',
      text: tTabs('main.brief_chip_peak_compact', { window: peakWindow.label }),
    }
    : null;

  const averageChip = Math.abs(deltaMs) >= 5 * MINUTE_MS
    ? {
      id: 'delta',
      text: deltaMs >= 0
        ? tTabs('main.brief_chip_average_up_compact', { value: formatAbsoluteMinutes(Math.abs(deltaMs)) })
        : tTabs('main.brief_chip_average_down_compact', { value: formatAbsoluteMinutes(Math.abs(deltaMs)) }),
    }
    : null;

  if (!isManaged) {
    chips.push({
      id: 'target-unset',
      text: tTabs('main.brief_chip_target_unset', {}),
    });
    if (peakChip) {
      chips.push(peakChip);
    } else if (todayChip) {
      chips.push(todayChip);
    }
    return dedupeChips(chips).slice(0, 2);
  }

  if (goalMs <= 0) {
    chips.push({
      id: 'target-unset',
      text: tTabs('main.brief_chip_target_unset', {}),
    });
    if (peakChip) {
      chips.push(peakChip);
    } else if (averageChip) {
      chips.push(averageChip);
    }
    return dedupeChips(chips).slice(0, 2);
  }

  if (goalMs > 0) {
    if (focusUsedMs > goalMs) {
      chips.push({
        id: 'today',
        text: tTabs('main.brief_chip_today_compact', {
          value: formatAbsoluteMinutes(focusUsedMs),
        }),
      });
    } else {
      chips.push({
        id: 'remaining',
        text: tTabs('main.brief_chip_remaining_compact', {
          value: formatAbsoluteMinutes(Math.max(0, goalMs - focusUsedMs)),
        }),
      });
    }
  }

  if (peakChip) {
    chips.push(peakChip);
  } else if (averageChip) {
    chips.push(averageChip);
  }

  return dedupeChips(chips).slice(0, 2);
}

function buildSitesAction({
  id,
  label,
  title = null,
  body = null,
  focusDomain = '',
}) {
  if (!focusDomain || !label) {
    return null;
  }
  return {
    id,
    label,
    title,
    body,
    tabId: 'sites',
    params: { domain: focusDomain },
  };
}

function buildDefaultPrimaryAction({
  focusDomain,
  isManaged,
  focusUsedMs,
  tTabs,
}) {
  if (!focusDomain) {
    return null;
  }
  if (!isManaged) {
    return buildSitesAction({
      id: 'add-site',
      label: tTabs('main.home_action_add_unmanaged_cta', {}),
      title: tTabs('main.home_action_add_unmanaged_title', { domain: focusDomain }),
      body: tTabs('main.home_action_add_unmanaged_body', {
        value: formatAbsoluteMinutes(focusUsedMs),
      }),
      focusDomain,
    });
  }
  return buildSitesAction({
    id: 'review-site',
    label: tTabs('main.home_action_review_site_cta', {}),
    title: tTabs('main.home_action_review_site_title', { domain: focusDomain }),
    body: tTabs('main.home_actions_narrative', {}),
    focusDomain,
  });
}

function buildProtectionAction({ tTabs }) {
  return {
    id: 'raise-protection',
    label: tTabs('main.home_action_raise_protection_cta', {}),
    title: tTabs('main.home_action_raise_protection_title', {}),
    body: tTabs('main.home_action_raise_protection_body', {}),
    tabId: 'filter',
    params: null,
  };
}

function buildScoreSetupChips(scoreSetup = null, tTabs) {
  if (!scoreSetup || typeof scoreSetup !== 'object') return [];
  const coverage = scoreSetup.coverage && typeof scoreSetup.coverage === 'object'
    ? scoreSetup.coverage
    : null;
  const recommendations = scoreSetup.recommendations && typeof scoreSetup.recommendations === 'object'
    ? scoreSetup.recommendations
    : {};
  const chips = [];
  if (coverage && toNumber(coverage.totalActiveMs) > 0 && toNumber(coverage.coverageRatio) < 0.995) {
    chips.push({
      id: 'score-coverage',
      text: tTabs('main.score_setup_coverage_chip', {
        value: formatPercentRatio(coverage.coverageRatio),
      }),
    });
  }
  if (toNumber(recommendations.readyCount) > 0) {
    chips.push({
      id: 'score-recommendations-ready',
      text: tTabs('main.score_setup_ready_chip', {
        count: Math.floor(toNumber(recommendations.readyCount)),
      }),
    });
  } else if (toNumber(recommendations.observingCount) > 0) {
    chips.push({
      id: 'score-recommendations-observing',
      text: tTabs('main.score_setup_observing_chip', {
        count: Math.floor(toNumber(recommendations.observingCount)),
      }),
    });
  }
  return chips;
}

function buildScoreSetupAction({
  scoreSetup = null,
  focusDomain = '',
  tTabs,
} = {}) {
  if (!scoreSetup || typeof scoreSetup !== 'object') return null;
  const coverage = scoreSetup.coverage && typeof scoreSetup.coverage === 'object'
    ? scoreSetup.coverage
    : null;
  const recommendations = scoreSetup.recommendations && typeof scoreSetup.recommendations === 'object'
    ? scoreSetup.recommendations
    : {};
  const needsCoverageSetup = coverage
    && toNumber(coverage.totalActiveMs) > 0
    && coverage.displayReady === false;
  const readyCount = Math.floor(toNumber(recommendations.readyCount));
  if (!needsCoverageSetup && readyCount <= 0) return null;
  return {
    id: readyCount > 0 ? 'review-score-recommendations' : 'review-score-coverage',
    label: readyCount > 0
      ? tTabs('main.score_setup_action_ready', {})
      : tTabs('main.score_setup_action_coverage', {}),
    title: readyCount > 0
      ? tTabs('main.score_setup_action_ready_title', { count: readyCount })
      : tTabs('main.score_setup_action_coverage_title', {}),
    body: readyCount > 0
      ? tTabs('main.score_setup_action_ready_body', { count: readyCount })
      : tTabs('main.score_setup_action_coverage_body', {
        value: formatPercentRatio(coverage?.coverageRatio),
      }),
    tabId: 'sites',
    params: { domain: focusDomain || null, panel: 'score_setup' },
  };
}

function dedupeActions(actions = []) {
  const seen = new Set();
  return actions.filter((action) => {
    if (!action?.id || !action?.tabId) return false;
    const domain = typeof action?.params?.domain === 'string' ? action.params.domain : '';
    const key = `${action.id}:${action.tabId}:${domain}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildHomeBriefViewModel(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('buildHomeBriefViewModel requires an input object.');
  }
  const {
    insightPresentation = null,
    riskTone = 'ok',
    isManaged = false,
    focusDomain = '',
    focusUsedMs = 0,
    goalMs = 0,
    ratio = 0,
    deltaMs = 0,
    peakWindow = null,
    scoreSetup = null,
    tTabs,
  } = input;
  if (typeof tTabs !== 'function') {
    throw new TypeError('buildHomeBriefViewModel requires tTabs.');
  }
  const briefTone = insightPresentation?.briefTone || resolveBriefTone({
    isManaged,
    ratio,
    deltaMs,
    peakWindowActiveMs: peakWindow?.activeMs,
    goalMs,
    focusUsedMs,
  });
  const hasExplicitPrimaryAction = Object.prototype.hasOwnProperty.call(
    insightPresentation || {},
    'primaryAction',
  );
  const primaryAction = hasExplicitPrimaryAction
    ? insightPresentation.primaryAction
    : buildDefaultPrimaryAction({
        focusDomain,
        isManaged,
        focusUsedMs,
        tTabs,
      });
  const actions = dedupeActions([
    buildScoreSetupAction({
      scoreSetup,
      focusDomain,
      tTabs,
    }) || primaryAction,
    riskTone === 'alert' ? buildProtectionAction({ tTabs }) : null,
  ]);
  const displayedPrimaryAction = actions[0] || primaryAction;
  const scoreSetupChips = buildScoreSetupChips(scoreSetup, tTabs);
  const brief = {
    focusDomain,
    tone: briefTone,
    statusLabel: insightPresentation?.briefStatusLabel
      || resolveBriefStatusLabel(briefTone, isManaged, Boolean(focusDomain), tTabs),
    verdict: insightPresentation?.briefVerdict || buildBriefVerdict({
      focusDomain,
      focusUsedMs,
      goalMs,
      deltaMs,
      isManaged,
      tTabs,
    }),
    supportingText: Object.prototype.hasOwnProperty.call(insightPresentation || {}, 'briefSupportingText')
      ? insightPresentation.briefSupportingText
      : displayedPrimaryAction?.body || buildBriefSupportText({
          focusDomain,
          tTabs,
        }),
    chips: dedupeChips([
      ...scoreSetupChips,
      ...buildBriefChips({
        primaryInsightChip: insightPresentation?.briefChip || null,
        focusUsedMs,
        goalMs,
        deltaMs,
        peakWindow,
        isManaged,
        tTabs,
      }),
    ]).slice(0, 2),
    action: displayedPrimaryAction,
  };

  return {
    brief,
    primaryAction: displayedPrimaryAction,
    actions,
  };
}
