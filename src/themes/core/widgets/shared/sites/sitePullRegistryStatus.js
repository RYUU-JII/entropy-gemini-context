import {
  TARGET_BEHAVIOR_FEEDBACK_SURFACES,
  assertTargetBehaviorSurfaceItemContract,
  isKnownTargetBehaviorBadgeId,
  resolveTargetBehaviorBadgeCopy,
} from './TargetBehaviorProfile.js';

const MINUTE_MS = 60_000;

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function resolveRiskBandLabel(riskBand, t) {
  if (riskBand === 'high') return t('target_profile.band_high', {});
  if (riskBand === 'elevated') return t('target_profile.band_elevated', {});
  if (riskBand === 'watch') return t('target_profile.band_watch', {});
  return t('target_profile.band_low', {});
}

function resolveToneWeight(tone = 'neutral') {
  if (tone === 'danger') return 4;
  if (tone === 'warning') return 3;
  if (tone === 'positive') return 1;
  return 2;
}

function resolveRiskWeight(riskBand = 'low') {
  if (riskBand === 'high') return 5;
  if (riskBand === 'elevated') return 4;
  if (riskBand === 'watch') return 3;
  return 1;
}

function resolveBucketId({
  profile,
  goalMinutes,
  scoreSetupDraft,
  badgeItems = badgeSurfaceItems(profile),
}) {
  if (badgeItems.some((badge) => (
    patternId(badge) === 'goal_exceeded' || patternId(badge) === 'goal_exceeded_repeated'
  ))) {
    return 'over';
  }
  if (profile?.riskBand === 'high' || profile?.riskBand === 'elevated') return 'rising';
  if (badgeItems.some((badge) => patternId(badge) === 'rising_trend' || patternId(badge) === 'personal_spike')) {
    return 'rising';
  }
  if (goalMinutes <= 0 || scoreSetupDraft?.status) return 'unset';
  if (profile?.riskBand === 'watch') return 'near';
  return 'quiet';
}

function patternId(item) {
  return item?.patternId || item?.id || '';
}

function surfaceItems(profile, surface) {
  const items = profile?.feedbackSurfaces?.[surface];
  return Array.isArray(items) ? items : [];
}

function badgeSurfaceItems(profile) {
  return surfaceItems(profile, TARGET_BEHAVIOR_FEEDBACK_SURFACES.BADGE)
    .map((item) => {
      assertTargetBehaviorSurfaceItemContract(item, TARGET_BEHAVIOR_FEEDBACK_SURFACES.BADGE);
      return item;
    });
}

function buildDraftChip({ scoreSetupDraft, scoreSetupMinDays, t }) {
  if (!scoreSetupDraft?.status) return null;
  if (scoreSetupDraft.status === 'ready' && Number(scoreSetupDraft.suggestedMinutes) > 0) {
    const suggestedMinutes = Math.round(Number(scoreSetupDraft.suggestedMinutes));
    return {
      id: 'score_setup_ready',
      label: `${t('score_setup.inline_ready', {})} · ${suggestedMinutes}${t('standard_panel.minute_suffix', {})}`,
      tone: 'warning',
    };
  }
  return {
    id: 'score_setup_observing',
    label: t('score_setup.inline_observing_progress', {
      days: scoreSetupDraft.activeDays || 0,
      minDays: scoreSetupMinDays,
    }),
    tone: 'neutral',
  };
}

export function buildSitePullRegistryStatus({
  intel = null,
  goalMinutes = 0,
  exposureMinutes = 0,
  scoreSetupDraft = null,
  scoreSetupMinDays = 3,
  t,
} = {}) {
  if (typeof t !== 'function') return null;

  const profile = intel?.sitePullProfile && typeof intel.sitePullProfile === 'object'
    ? intel.sitePullProfile
    : null;
  const riskBand = profile?.riskBand || '';
  const score = Math.round(toNumber(profile?.score));
  const riskWeight = resolveRiskWeight(riskBand);
  const riskTone = profile?.tone || (riskBand === 'high' ? 'danger' : riskBand === 'elevated' ? 'warning' : 'neutral');
  const draftChip = goalMinutes <= 0
    ? buildDraftChip({ scoreSetupDraft, scoreSetupMinDays, t })
    : null;
  const badgeItems = badgeSurfaceItems(profile);
  const badgeChips = badgeItems
    .map((badge) => ({
      id: patternId(badge),
      label: resolveTargetBehaviorBadgeCopy(badge, t).label,
      tone: badge?.tone || badge?.severity || 'neutral',
    }))
    .filter((badge) => badge.id && isKnownTargetBehaviorBadgeId(badge.id) && badge.label)
    .filter((badge) => !['no_activity', 'insufficient_data', 'goal_kept'].includes(badge.id))
    .sort((left, right) => resolveToneWeight(right.tone) - resolveToneWeight(left.tone))
    .slice(0, 2);
  const riskChip = profile && riskBand && riskBand !== 'low'
    ? {
      id: `risk_${riskBand}`,
      label: resolveRiskBandLabel(riskBand, t),
      tone: riskTone,
    }
    : null;
  const chips = [
    goalMinutes <= 0
      ? {
        id: 'goal_unset',
        label: t('score_setup.inline_unset', {}),
        tone: 'neutral',
      }
      : null,
    draftChip,
    riskChip,
    ...badgeChips,
  ].filter(Boolean);
  const stateChip = riskChip || draftChip || badgeChips[0] || null;
  const bucketId = resolveBucketId({
    profile,
    goalMinutes,
    scoreSetupDraft,
    badgeItems,
  });
  const rankScore = (bucketId === 'over' ? 6000
    : bucketId === 'rising' ? 5000
      : bucketId === 'near' ? 4000
        : bucketId === 'unset' ? 3000
          : 1000)
    + (riskWeight * 120)
    + score
    + exposureMinutes;

  return {
    bucketId,
    score: rankScore,
    riskBand: riskBand || 'low',
    stateLabel: stateChip?.label || '',
    stateTone: stateChip?.tone || 'neutral',
    chips,
    todayMinutes: exposureMinutes,
    confidence: toNumber(profile?.confidence),
    hasProfile: Boolean(profile),
    detail: profile
      ? `${t('target_profile.score_label', {})} ${score}/100`
      : '',
  };
}

export function formatRegistryUsageValue({
  exposureMs = 0,
  goalMinutes = 0,
  t,
} = {}) {
  if (typeof t !== 'function') return '';
  const exposureMinutes = Math.round(toNumber(exposureMs) / MINUTE_MS);
  const suffix = t('standard_panel.minute_suffix', {});
  if (goalMinutes > 0) return `${exposureMinutes}${suffix} / ${goalMinutes}${suffix}`;
  return exposureMinutes > 0 ? `${exposureMinutes}${suffix}` : '';
}
