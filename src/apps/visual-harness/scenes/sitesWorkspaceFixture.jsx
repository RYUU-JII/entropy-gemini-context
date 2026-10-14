import { buildSitePullInterpretation } from '../../../domains/stats/insights/sitePull/sitePullInterpretation.js';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { buildTargetPanelViewModel } from '../../dashboard/tabs/sites/presentation/targetPanelViewModel.js';
import { resolveSiteGoalChange } from '../../../domains/settings/config/siteGoalPolicy.js';
import SitesWorkspace from '../../dashboard/tabs/sites/components/SitesWorkspace.jsx';
import SitesSiteCap from '../../dashboard/tabs/sites/components/SitesSiteCap.jsx';
import SitesHud from '../../dashboard/tabs/sites/components/SitesHud.jsx';
import { SitesWorkspaceNotices } from '../../dashboard/tabs/sites/components/SitesWorkspaceFeedback.jsx';
import { getThemeWidget } from '../../../themes/core/registry/index.js';
import { resolveSitesRecordingPolicy, resolveDomainUsageRecording, resolveTimeCapAvailability } from '../../../domains/settings/config/dataCollectionPolicy.js';
import { buildStatsDashboardPolicyFingerprint } from '../../../domains/stats/analysis/policySnapshot.js';
import SitesPolicyDetail from '../../dashboard/tabs/sites/components/SitesPolicyDetail.jsx';
import { SitesWorkspaceHeader, SitesNotebookHeader } from '../../dashboard/tabs/sites/components/SitesWorkspaceHeader.jsx';
import SitesRegistrationEditor from '../../dashboard/tabs/sites/components/SitesRegistrationEditor.jsx';
import { useAppTranslation } from '../../../ui-kit/hooks/useAppTranslation.js';

export function WorkspaceSpecimen({ themeId, average, variant, scenario = 'ready' }) {
  const { t } = useAppTranslation('sites');
  const hostRef = useRef(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  useEffect(() => { if (scenario === 'notice') setNoticeVisible(true); }, [scenario]);
  const longDomain = 'a-very-long-research-and-reading-domain.example.com';
  const initialDomain = scenario === 'long' ? longDomain : scenario === 'narrow' ? 'facebook.com' : 'youtube.com';
  const [selected, setSelected] = useState(scenario === 'empty' ? '' : initialDomain);
  const [mode, setMode] = useState(scenario === 'empty' ? 'ledger' : 'notebook');
  const [registration, setRegistration] = useState(null);
  const registrationDraft = useRef({});
  const select = (domain) => { setSelected(domain); setRegistration(null); setMode('notebook'); };
  const [scope, setScope] = useState('all');
  const [membership, setMembership] = useState({ [initialDomain]: scenario === 'exception' ? 'allowed' : 'blocked' });
  const [goals, setGoals] = useState({ [initialDomain]: scenario === 'overflow' ? 600 : 60 });
  const [globalGoal, setGlobalGoal] = useState(120);
  const sites = scenario === 'empty' ? [] : [initialDomain, 'instagram.com', 'reddit.com', 'x.com', ...Array.from({ length: 44 }, (_, index) => `reading-${index + 1}.example.com`)];
  const policy = Object.fromEntries(sites.map((domain, index) => [domain, membership[domain] || ['tracked', 'tracked', 'allowed', 'blocked'][index % 4]]));
  const selectedType = policy[selected] || 'unmanaged';
  const settings = { blockedUrls: sites.filter((domain) => policy[domain] === 'blocked'), siteGoals: goals,
    protectionPresetAssignments: { globalPresetId: null, sitePresetIds: {} }, trackingExcludedUrls: scenario === 'excluded' ? [initialDomain] : [],
    dataCollectionMode: scenario === 'recording-off' ? 'off' : scenario === 'protected-only' ? 'protected_sites' : 'all_sites_minimal', insightsConsent: scenario === 'recording-off' ? 'later' : 'all_sites' };
  const recording = resolveSitesRecordingPolicy(settings);
  const registry = { averageWindow: { ...average, basis: 'completed-activity-days-recorded' }, byDomain: Object.fromEntries(sites.map((domain, index) => [domain, {
    domain, type: policy[domain], usageAverage: index === 6 ? { averageMs: null, totalMs: null, observedDayCount: 0, status: 'collecting' } : { averageMs: (index === 1 ? 140 : index === 2 ? 70 : index === 5 ? 0 : Math.max(1, 44 - index)) * 60000, totalMs: (index === 1 ? 140 : index === 2 ? 70 : index === 5 ? 0 : Math.max(1, 44 - index)) * 60000 * 7, observedDayCount: index === 4 ? 3 : 7, status: index === 4 ? 'partial' : 'recorded' }, usage: { basis: 'activity-day-observed', observedMs: (42 - index % 36) * 60000 },
    protectionBudget: { chargedMs: (30 - index % 24) * 60000, goalMinutes: goals[domain] || 60, ratio: .5, remainingMs: 30 * 60000, overMs: 0, state: 'within' },
  }])) };
  for (const entry of Object.values(registry.byDomain)) {
    entry.recording = resolveDomainUsageRecording(entry.domain, settings);
    entry.capAvailability = resolveTimeCapAvailability(entry.domain, settings);
    if (!entry.recording.enabled) { entry.usage.observedMs = null; entry.usageAverage = { averageMs: null, totalMs: null, observedDayCount: 0, status: 'disabled' }; }
  }
  registry.entries = Object.values(registry.byDomain).filter((entry) => entry.type === 'blocked' || entry.recording.enabled);
  const intel = useMemo(() => !selected ? null : makeIntel({
    domain: selected, type: selectedType, isReady: true, limitMinutes: goals[selected] || 60,
    registryEntry: registry.byDomain[selected],
    sitePullProfile: scenario === 'observing' ? null : makePrimaryBehaviorProfile(),
    baselineSeries: Array.from({ length: 14 }, (_, index) => ({ dateStr: `2026-08-${String(18 + index).padStart(2, '0')}`, observed: index !== 4, activeMs: [24, 36, 28, 16, 0, 32, 40, 12, 24, 44, 18, 20, 36, 28][index] * 60000 })),
    weeklySeries: Array.from({ length: 7 }, (_, index) => ({ dateStr: `2026-09-0${index + 1}`, label: ['월', '화', '수', '목', '금', '토', '일'][index], observed: true, activeMs: [32, 44, 26, 18, 56, 36, 42][index] * 60000, overLimit: false })),
    recurringTimeEvidence: { available: true, startHour: 20, endHourExclusive: 23, repeatedDayCount: 12, observedDayCount: 21, share: .62 },
  }), [selected, selectedType, goals, scenario]);
  const viewModel = useMemo(() => buildTargetPanelViewModel({ intel, weeklyFallbackLabels: ['일','월','화','수','목','금','토'] }), [intel]);
  const Registry = getThemeWidget(themeId, 'SitesRegistry');
  const Detail = getThemeWidget(themeId, 'SitesTargetPanel');
  const save = async (domain, requestedMinutes) => {
    const result = resolveSiteGoalChange({ currentMinutes: goals[domain] || 60, requestedMinutes });
    setGoals((values) => ({ ...values, [domain]: result.appliedMinutes }));
    return { ...result, ok: true };
  };
  return <div ref={hostRef} style={{ height: '100%' }}><SitesWorkspace variant={themeId === 'zen' ? 'open' : 'standard'} mode={mode} minimal={themeId === 'zen'}
    notices={<SitesWorkspaceNotices variant={themeId === 'zen' ? 'paper' : 'standard'}
      errorMessage={noticeVisible ? '사이트 규칙을 저장하지 못했습니다. 초안은 유지됩니다.' : ''}
      errorActionLabel="다시 시도" onErrorAction={() => setNoticeVisible(false)} />}
    toolbar={<SitesWorkspaceHeader t={t} mode={mode} minimal={themeId === 'zen'} onBack={() => { setRegistration(null); setMode('ledger'); }} globalCap={<SitesHud admissionStatus="ready" recording={recording} variant={variant} totalExposure={42 * 60000} globalExposureAverage={recording.effectiveScope === 'off' ? { ...average, averageMs: null, observedDayCount: 0, status: 'disabled' } : average} globalGoal={globalGoal} onGlobalGoalChange={async (value) => setGlobalGoal(value)} compact={themeId === 'zen'} />} />}
    notebookHeader={<SitesNotebookHeader domain={registration?.domain || selected} title={registration ? registration.domain || t('registry.add_protected') : selected} domains={registration ? [] : sites} isOpen={mode === 'notebook'} onSelect={select} t={t} minimal={themeId === 'zen'} />}
    siteCap={!registration && selectedType === 'blocked' && <SitesSiteCap admissionStatus="ready" capAvailability={registry.byDomain[selected]?.capAvailability} domain={selected} type={selectedType} goalMinutes={goals[selected] || 60} onGoalChange={save} minimal={themeId === 'zen'} />}
    registryPane={<Registry layout="ledger" policyFingerprint={buildStatsDashboardPolicyFingerprint(settings)} recording={recording} onOpenRecordingSettings={() => {}} onManageExclusions={() => {}} world={themeId} blockedTargets={sites.filter((domain) => policy[domain] === 'blocked')} allowedTargets={sites.filter((domain) => policy[domain] === 'allowed')}
      trackedTargets={sites.filter((domain) => policy[domain] === 'tracked')} siteRegistry={registry} siteIntels={intel ? { [selected]: intel } : {}} labels={{}}
      activeScope={scope} selectedDomain={selected} onScopeChange={(next) => { setScope(next); if (next !== 'all' && policy[selected] !== next) setSelected(sites.find((domain) => policy[domain] === next) || ''); }}
      onSelectBlocked={select} onSelectAllowed={select} onSelectTracked={select}
      onRequestRegistration={(request) => { registrationDraft.current = { domainDraft: request.domain }; setRegistration(request); setMode('notebook'); }} />}
    detailPane={registration ? <SitesRegistrationEditor {...registration} initialDomain={registration.domain} presentationState={registrationDraft.current} t={t} onRegister={async () => ({ ok: false, message: t('errors.save_failed') })} onRegistered={select} onCancel={() => { setRegistration(null); setMode('ledger'); }} /> : selected && !registry.byDomain[selected].recording.enabled ? <SitesPolicyDetail entry={registry.byDomain[selected]} onSettings={() => {}} onProtect={() => {}} /> : <Detail intel={intel} targetPanelViewModel={viewModel} onProtect={() => setMembership((current) => ({ ...current, [selected]: 'blocked' }))} onAllow={() => setMembership((current) => ({ ...current, [selected]: 'allowed' }))}
      onExclude={() => setSelected('')} releaseControl={selected && selectedType !== 'tracked' ? { type: selectedType, phase: 'idle', blockedByOtherPending: false, onRequest: () => {}, onCancel: () => {} } : null} />} /></div>;
}

function makeIntel(overrides = {}) {
  const intel = {
    domain: 'x.com',
    type: 'blocked',
    totalMs: 50 * 60 * 1000,
    todayTotal: 50 * 60 * 1000,
    weeklySeries: [
      { label: 'Mon', activeMs: 12 * 60 * 1000, overLimit: false, observed: true, dateStr: '2026-02-23' },
      { label: 'Tue', activeMs: 16 * 60 * 1000, overLimit: true, observed: true, dateStr: '2026-02-24' },
      { label: 'Wed', activeMs: 0, overLimit: false, observed: true, dateStr: '2026-02-25' },
    ],
    todayHourly: Array.from({ length: 24 }, (_, hour) => (hour === 9 ? 50 * 60 * 1000 : 0)),
    habitHourly: Array.from({ length: 24 }, (_, hour) => (hour === 21 ? 7 * 60 * 1000 : 0)),
    limitMinutes: 35,
    registryEntry: {
      usage: {
        observedMs: 50 * 60 * 1000,
      },
      protectionBudget: {
        chargedMs: 20 * 60 * 1000,
        goalMinutes: 35,
        ratio: 20 / 35,
        remainingMs: 15 * 60 * 1000,
        overMs: 0,
        state: 'within',
      },
    },
    ...overrides,
  };
  const weeklySeries = Array.isArray(intel.weeklySeries) ? intel.weeklySeries : [];
  if (weeklySeries.length === 0) return intel;
  const observedSeries = weeklySeries.filter((entry) => entry.observed === true);
  let streakDays = 0;
  for (let index = weeklySeries.length - 1; index >= 0; index -= 1) {
    if (weeklySeries[index]?.observed !== true || Number(weeklySeries[index]?.activeMs) <= 0) break;
    streakDays += 1;
  }
  return {
    ...intel,
    weeklyTotal: observedSeries.reduce((sum, entry) => sum + Math.max(0, Number(entry.activeMs) || 0), 0),
    activeDays: observedSeries.filter((entry) => Number(entry.activeMs) > 0).length,
    overLimitDays: observedSeries.filter((entry) => entry.overLimit === true).length,
    streakDays,
  };
}

// Shaped after the published personal-baseline contract: the Zone B comparison
// band reads its percentiles from the `active_ms` metric, so a fixture without
// that metric is not a valid baseline.
function makePersonalBaseline({ status = 'stable', stats = null } = {}) {
  return {
    status,
    metrics: {
      active_ms: {
        id: 'active_ms',
        sample: { observedCount: 21 },
        stats: stats || {
          p25DailyMs: 6 * 60 * 1000,
          medianDailyMs: 12 * 60 * 1000,
          p75DailyMs: 24 * 60 * 1000,
          p90DailyMs: 40 * 60 * 1000,
        },
      },
    },
  };
}

function makePrimaryBehaviorProfile() {
  const pattern = {
    id: 'quick_return_loop',
    patternId: 'quick_return_loop',
    role: 'user_feedback',
    recommendationFamily: 'checking_cooldown',
    tone: 'warning',
    confidence: 0.92,
    evidence: {
      todaySwitchBackWithin10m: 4,
      todaySwitchIns: 8,
      todayQuickReturnRate: 0.5,
    },
  };
  const surfaceItem = (surface) => ({
    ...pattern,
    surface,
    surfaceItemId: `${pattern.id}:${surface}`,
    visibility: 'visible',
    surfaceVisibility: 'visible',
    claimVisibility: 'primary_claim',
    decisionQuality: { status: 'supported', score: .72, nearBoundary: false },
  });
  const profile = {
    score: 68,
    confidence: 0.72,
    riskBand: 'elevated',
    tone: 'warning',
    feedbackSurfaces: {
      badge: [surfaceItem('badge')],
      detail: [surfaceItem('detail')],
      recap: [],
      diagnostic: [],
    },
    contributionBreakdown: [
      {
        id: 'time_pressure',
        feature: 'timePressure',
        contribution: 18,
        weight: 22,
        confidence: 0.8,
      },
      {
        id: 'checking_loop',
        feature: 'checkingLoop',
        contribution: 9,
        weight: 12,
        confidence: 0.7,
      },
    ],
    dataCoverage: {
      hasUsageFacts: true,
      hasEntryFacts: true,
      hasSessionFacts: true,
      hasEstimatedSessionFacts: false,
      hasTransitionEdgeFacts: true,
    },
    personalBaseline: makePersonalBaseline(),
    recommendedNudge: null,
  };
  profile.interpretation = buildSitePullInterpretation({
    featureVector: { todayObserved: true, hasAnyActivity: true, weeklySeries: [], baselineCurrentDateStr: '2026-09-07', baselineSeries: [] },
    feedbackSurfaces: profile.feedbackSurfaces, hasInterventionFacts: false,
  });
  return profile;
}
