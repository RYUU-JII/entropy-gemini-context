import { isPolicyFeatureKey } from '../../domains/protection/protocol/features/featureCatalog.js';
import {
  FILTER_EXECUTION_SOURCES,
  normalizeFilterExecutionSource,
} from '../../domains/protection/contracts/filterExecutionContracts.js';
import { normalizeDomain } from '../domain.js';

const FILTER_LABEL_KEYS = Object.freeze({
  blur: 'blur',
  saturation: 'saturation',
  brightness: 'brightness',
  contrast: 'contrast',
  colorSaturation: 'color_saturation',
  textRhythm: 'text_rhythm',
  textShadow: 'text_shadow',
  clickDelay: 'click_delay',
  ensoGate: 'enso_gate',
  scrollFriction: 'scroll_friction',
  inputDelay: 'input_delay',
  inputVisualBrake: 'input_visual_brake',
  navigationButtonLock: 'navigation_button_lock',
  socialMetrics: 'social_metrics',
  infiniteScrollGuard: 'infinite_scroll',
  shortFormBlock: 'short_form',
  videoSkipGuard: 'video_skip',
  temporal: 'temporal',
  hideIcons: 'hide_icons',
});

const ARTIFACT_LABEL_KEYS = Object.freeze({
  loopBreaker: 'loop_breaker',
  timeAnchor: 'time_anchor',
  sentinelFlare: 'sentinel_flare',
  memoryPurge: 'memory_purge',
  entryCheckpoint: 'entry_checkpoint',
  returnGuard: 'return_guard',
  detourSpreadGuard: 'detour_spread_guard',
});

const FILTER_SOURCE_LABEL_KEYS = Object.freeze({
  [FILTER_EXECUTION_SOURCES.USER_CONFIG]: 'user_config',
  [FILTER_EXECUTION_SOURCES.POLICY]: 'policy',
  [FILTER_EXECUTION_SOURCES.RUNTIME_ARTIFACT]: 'runtime_artifact',
});

export function buildPopupDashboardPath({ domain } = {}) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return 'src/pages/dashboard.html';
  }

  return `src/pages/dashboard.html?tab=sites&domain=${encodeURIComponent(normalizedDomain)}`;
}

export function formatPopupDurationShort(ms, t) {
  const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60000));
  if (totalMinutes < 60) {
    return t('popup.format.minutes_short', { count: totalMinutes });
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return t('popup.format.hours_minutes_short', { hours, minutes });
}

export function formatPopupPercent(ratio, t) {
  const value = Math.max(0, Math.round((Number(ratio) || 0) * 100));
  return t('popup.format.percent', { value });
}

export function resolvePopupGoalMinutes(snapshot) {
  return snapshot.protection.goalMinutes;
}

function resolveFilterLabel(filter, t) {
  const key = FILTER_LABEL_KEYS[filter?.key] || 'unknown';
  const label = t(`popup.diagnostics.filters.${key}`);
  const band = filter?.band;
  const filterLabel = band
    ? t('friction_profiles.label', { label, band: t(`friction_profiles.${band}`) })
    : label;
  const source = normalizeFilterExecutionSource(
    filter?.source,
    FILTER_EXECUTION_SOURCES.USER_CONFIG,
  );
  const sourceKey = FILTER_SOURCE_LABEL_KEYS[source];
  if (!sourceKey) return filterLabel;
  return t('popup.diagnostics.filter_source', {
    label: filterLabel,
    source: t(`popup.diagnostics.filter_sources.${sourceKey}`),
  });
}

export function buildPopupDiagnostics({ snapshot, statusMeta, t }) {
  const protection = snapshot?.protection || {};
  const filters = Array.isArray(protection.activeFilters) ? protection.activeFilters : [];
  const activeArtifacts = Array.isArray(protection.activeArtifacts) ? protection.activeArtifacts : [];
  const standbyArtifacts = Array.isArray(protection.standbyArtifacts) ? protection.standbyArtifacts : [];
  const activeFilterLabels = filters.map((filter) => resolveFilterLabel(filter, t));
  const activeArtifactLabels = activeArtifacts.map((artifactId) => (
    t(`popup.diagnostics.artifacts.${ARTIFACT_LABEL_KEYS[artifactId] || 'unknown'}`)
  ));
  const standbyArtifactLabels = standbyArtifacts.map((artifactId) => (
    t(`popup.diagnostics.artifacts.${ARTIFACT_LABEL_KEYS[artifactId] || 'unknown'}`)
  ));

  if (!snapshot?.site?.supported) {
    return {
      tone: 'muted',
      title: t('popup.diagnostics.title'),
      summary: t('popup.diagnostics.summary_unavailable'),
      rows: [
        {
          label: t('popup.diagnostics.rows.policy'),
          value: statusMeta?.label || t('popup.state.unavailable'),
        },
      ],
    };
  }

  if (!protection.isProtected) {
    return {
      tone: 'muted',
      title: t('popup.diagnostics.title'),
      summary: t('popup.diagnostics.summary_unprotected'),
      rows: [
        {
          label: t('popup.diagnostics.rows.policy'),
          value: t('popup.state.not_protected'),
        },
      ],
    };
  }

  const toolLabels = [...activeArtifactLabels, ...standbyArtifactLabels];

  return {
    tone: statusMeta?.tone || 'ok',
    title: t('popup.diagnostics.title'),
    summary: activeFilterLabels.length
      ? t('popup.diagnostics.summary_filters', { count: activeFilterLabels.length })
      : t('popup.diagnostics.summary_idle'),
    rows: [
      {
        label: t('popup.diagnostics.rows.policy'),
        value: t('popup.diagnostics.level', { level: Number(protection.level || 1) }),
      },
      {
        label: t('popup.diagnostics.rows.filters'),
        value: activeFilterLabels.length
          ? activeFilterLabels.slice(0, 4).join(', ')
          : t('popup.diagnostics.none'),
      },
      {
        label: t('popup.diagnostics.rows.tools'),
        value: toolLabels.length
          ? toolLabels.slice(0, 3).join(', ')
          : t('popup.diagnostics.none'),
      },
    ],
  };
}

export function buildPopupEffects({ snapshot, t }) {
  if (!snapshot.site.supported || !snapshot.protection.isProtected) return [];
  const { activeFilters, activeArtifacts } = snapshot.protection;
  const effects = [];
  const seen = new Set();
  for (const [category, entries, labels] of [
    ['filter', activeFilters, FILTER_LABEL_KEYS],
    ['artifact', activeArtifacts, ARTIFACT_LABEL_KEYS],
  ]) {
    for (const entry of entries) {
      const rawId = category === 'filter' ? entry.key : entry;
      if (category === 'filter' && isPolicyFeatureKey(rawId)) continue;
      const key = labels[rawId];
      if (!key) throw new Error('POPUP_EFFECT_LABEL_REQUIRED: ' + rawId);
      const id = category + ':' + rawId;
      if (seen.has(id)) continue;
      seen.add(id);
      effects.push({
        id,
        category,
        label: t('popup.diagnostics.' + (category === 'filter' ? 'filters.' : 'artifacts.') + key),
        description: t('popup.effect_descriptions.' + key),
      });
    }
  }
  return effects;
}

export function resolvePopupStatusMeta({ snapshot, t }) {
  const supported = !!snapshot?.site?.supported;
  const isProtected = !!snapshot?.protection?.isProtected;
  const todayMs = Number(snapshot?.metrics?.todayMs || 0);
  const activeGoalMinutes = resolvePopupGoalMinutes(snapshot);
  const progressRatio = activeGoalMinutes > 0 ? todayMs / (activeGoalMinutes * 60000) : 0;
  const level = Number(snapshot?.protection?.level || 1);
  const activeArtifacts = Array.isArray(snapshot?.protection?.activeArtifacts)
    ? snapshot.protection.activeArtifacts
    : [];

  if (!supported) {
    return {
      tone: 'muted',
      label: t('popup.state.unavailable'),
      detail: t('popup.state_detail.unavailable'),
    };
  }

  if (!isProtected) {
    return {
      tone: 'muted',
      label: t('popup.state.not_protected'),
      detail: t('popup.state_detail.not_protected'),
    };
  }

  if (progressRatio >= 1) {
    return {
      tone: 'alert',
      label: t('popup.state.over_goal'),
      detail: t('popup.state_detail.over_goal'),
    };
  }

  if (progressRatio >= 0.85) {
    return {
      tone: 'warn',
      label: t('popup.state.near_goal'),
      detail: t('popup.state_detail.near_goal'),
    };
  }

  if (activeArtifacts.length > 0) {
    return {
      tone: 'active',
      label: t('popup.state.active_now'),
      detail: t('popup.state_detail.tightening'),
    };
  }

  if (level >= 3) {
    return {
      tone: 'active',
      label: t('popup.state.tightening'),
      detail: t('popup.state_detail.tightening'),
    };
  }

  return {
    tone: 'ok',
    label: t('popup.state.protected'),
    detail: t('popup.state_detail.protected'),
  };
}

export function resolvePopupDisplayDomain({ snapshot, hostname, isReady, t }) {
  return snapshot.site.hostname || hostname || (isReady ? t('popup.labels.unsupported_page') : '...');
}

export function resolvePopupGoalControlState({
  snapshot,
  isSaving,
  messageCode,
  t,
}) {
  const savedGoalMinutes = resolvePopupGoalMinutes(snapshot);
  const isSupported = !!snapshot?.site?.supported;
  const isProtected = !!snapshot?.protection?.isProtected;
  const isLocked = !isProtected;
  const mode = !isSupported
    ? 'unsupported'
    : isLocked
      ? (isSaving ? 'starting' : 'locked')
      : 'active';

  let assistTone = 'muted';
  let assistText = '';

  if (messageCode === 'permission_required') {
    assistTone = 'warn';
    assistText = t('popup.messages.permission_hint');
  } else if (messageCode === 'protect_error') {
    assistTone = 'alert';
    assistText = t('popup.messages.protect_error');
  }

  let actionLabel = '';
  let actionDisabled = false;

  if (!isSupported) {
    actionLabel = t('popup.actions.unsupported');
    actionDisabled = true;
  } else if (isLocked) {
      actionLabel = isSaving ? t('popup.actions.starting_protection')
        : snapshot.access.requiresDashboardRegistration ? t('popup.actions.start_in_dashboard') : t('popup.actions.start_protection');
      if (snapshot.access.requiresDashboardRegistration && !assistText) assistText = t('popup.messages.registration_in_dashboard');
    actionDisabled = isSaving;
  } else {
    actionLabel = '';
    actionDisabled = true;
  }

  return {
    actionDisabled,
    actionLabel,
    assistText,
    assistTone,
    mode,
    savedGoalMinutes,
    showEditor: mode !== 'locked' && mode !== 'starting' && mode !== 'unsupported',
    showStartSurface: mode === 'locked' || mode === 'starting',
  };
}
