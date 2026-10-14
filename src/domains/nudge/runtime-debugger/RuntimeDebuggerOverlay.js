import {
  formatClickBoundarySummary,
  formatEnsoGateReadinessSummary,
  formatSelectorMatchSummary,
  formatYouTubeContractSummary,
  summarizeClickRoutingDecision,
} from './RuntimeDebuggerClickGate.js';
import {
  findRuntimeDebuggerProbe,
  getRuntimeDebuggerCaptureKindCopy,
  getRuntimeDebuggerProbeStateCopy,
  renderProbeCard,
  renderRuntimeDebuggerCaptureStrip,
  renderRuntimeDebuggerEffectProbe,
  renderRuntimeDebuggerMeasurementGuide,
  renderRuntimeDebuggerOverview,
  renderRuntimeDebuggerSessionLog,
} from './RuntimeDebuggerOverlaySessionViews.js';
import { RUNTIME_DEBUGGER_OVERLAY_STYLE } from './RuntimeDebuggerOverlayStyle.js';
import { RUNTIME_DEBUGGER_TAB_TO_PROBE_ID } from './RuntimeDebuggerProbeCatalog.js';
import { registerMediaObservationExcludedNode } from '../media/pageMediaElements.js';
import {
  presentFeedTopologyReadiness,
} from '../feed-flow/topology/feedTopologyReadinessPresentation.js';

const HOST_ID = 'entropy-runtime-debugger';
const PANEL_ID = `${HOST_ID}-panel`;
const PANEL_TITLE_ID = `${HOST_ID}-title`;
const TAB_PANEL_ID = `${HOST_ID}-tabpanel`;
const GUIDE_BUTTON_ID = `${HOST_ID}-guide-toggle`;
const GUIDE_PANEL_ID = `${HOST_ID}-guide`;

function fmtNum(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return String(num);
}

function fmtMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0ms';
  return `${num.toFixed(num >= 10 ? 1 : 2)}ms`;
}

function fmtPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0%';
  return `${Math.round(num * 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value) {
  return `<span class="k">${escapeHtml(label)}</span><span class="v">${escapeHtml(value)}</span>`;
}

function renderObserver(snapshot = {}) {
  const subscribers = Array.isArray(snapshot.subscriberStats)
    ? snapshot.subscriberStats
    : (Array.isArray(snapshot.topSubscribers) ? snapshot.topSubscribers : []);
  const recentFlushes = Array.isArray(snapshot.recentFlushes)
    ? snapshot.recentFlushes.slice(-8).reverse()
    : [];
  return `
    <div class="grid">
      ${row('디버그', snapshot.debugEnabled ? '켜짐' : '꺼짐')}
      ${row('구독자', fmtNum(snapshot.subscriberCount))}
      ${row('옵저버 옵션', snapshot.activeOptions ? JSON.stringify(snapshot.activeOptions) : '-')}
      ${row('플러시', fmtNum(snapshot.flushes))}
      ${row('변이', fmtNum(snapshot.mutations))}
      ${row('추가/텍스트/속성', `${fmtNum(snapshot.addedNodes)} / ${fmtNum(snapshot.textNodes)} / ${fmtNum(snapshot.attributeTargets)}`)}
      ${row('플러시 평균/최대', `${fmtMs(snapshot.avgFlushMs)} / ${fmtMs(snapshot.maxFlushMs)}`)}
      ${row('대기 최대', fmtNum(snapshot.maxPendingMutations))}
      ${row('배치 최대', fmtNum(snapshot.maxBatchMutations))}
    </div>
    <div class="sub">구독자별 동기 전달 비용</div>
    <div class="list">
      ${subscribers.length ? subscribers.map((entry) => `
        <div class="item">
          <span>${escapeHtml(entry.label)}</span>
          <b>${fmtMs(entry.totalMs)} | ${fmtNum(entry.calls)}x | ${fmtNum(entry.matchedFlushes ?? entry.calls)} flush</b>
        </div>
      `).join('') : '<div class="empty">아직 구독자 샘플이 없습니다</div>'}
    </div>
    <div class="sub">최근 flush 상관관계</div>
    <div class="list">
      ${recentFlushes.length ? recentFlushes.map((entry) => `
        <div class="item">
          <span>${escapeHtml(`#${entry.flushId || '-'} mutations=${fmtNum(entry.mutationCount ?? entry.mutations)} subscribers=${fmtNum(entry.subscriberCount)}`)}</span>
          <b>${fmtMs(entry.durationMs ?? entry.flushMs)}</b>
        </div>
      `).join('') : '<div class="empty">최근 flush 기록이 없습니다.</div>'}
    </div>
  `;
}

function renderAuditCollections(audit = {}) {
  const recent = Array.isArray(audit.recentCollections) ? audit.recentCollections.slice(-4).reverse() : [];
  if (recent.length === 0) return '<div class="empty">selector 수집 기록이 아직 없습니다</div>';
  return recent.map((entry) => {
    const selectors = Array.isArray(entry.selectors) ? entry.selectors.slice(0, 3) : [];
    const selectorText = selectors.length
      ? selectors.map((selector) => `${fmtNum(selector.hits)}개 ${escapeHtml(selector.selector)}`).join(' / ')
      : 'hit 없음';
    return `
      <div class="item">
        <span>${escapeHtml(`${entry.group || '-'} ${entry.rootsMode || '-'} roots=${fmtNum(entry.rootCount)} candidates=${fmtNum(entry.resolvedCandidates)} low=${entry.lowYield ? 'Y' : 'N'}`)}</span>
        <b>${escapeHtml(selectorText)}</b>
      </div>
    `;
  }).join('');
}

function renderAuditDecisions(audit = {}) {
  const recent = Array.isArray(audit.recentDecisions) ? audit.recentDecisions.slice(-5).reverse() : [];
  if (recent.length === 0) return '<div class="empty">후보 판단 기록이 아직 없습니다</div>';
  return recent.map((entry) => {
    const target = Array.isArray(entry.target)
      ? entry.target.map((item) => item?.node).filter(Boolean).join(', ')
      : (entry.target?.node || '-');
    return `
      <div class="item">
        <span>${escapeHtml(`${entry.action || '-'} ${entry.matchedKey || '-'} "${entry.text || ''}"`)}</span>
        <b>${escapeHtml(target)}</b>
      </div>
    `;
  }).join('');
}

function renderSocial(snapshot = {}, result = null) {
  if (!snapshot.loaded) {
    return `
      ${result ? renderProbeCard(result) : ''}
      <div class="empty">이 페이지에서는 SocialMetricsManager가 아직 로드되지 않았습니다.</div>
    `;
  }
  const current = snapshot.currentScan || {};
  const stats = snapshot.stats || {};
  const audit = stats.audit || {};
  const decisionCount = Number(audit.decisionCount) || 0;
  const appliedCount = Number(audit.appliedDecisionCount) || 0;
  const appliedTargetCount = Number(audit.appliedTargetDecisionCount) || appliedCount;
  const yieldText = decisionCount > 0 ? fmtPercent(appliedCount / decisionCount) : '-';
  const uniqueApplied = Number(audit.uniqueAppliedTargetDecisions) || 0;
  const repeatRatioText = appliedTargetCount > 0
    ? fmtPercent((Number(audit.repeatedTargetDecisions) || 0) / appliedTargetCount)
    : '-';
  return `
    <div class="scope-actions">
      <span class="scope-title">Social Metrics 스캔</span>
      <button type="button" data-action="social-audit-mode" data-active="${snapshot.auditMode === 'deep' ? 'true' : 'false'}">심층 감사 ${snapshot.auditMode === 'deep' ? '켜짐' : '꺼짐'}</button>
    </div>
    <div class="grid">
      ${row('세션 판정', getRuntimeDebuggerProbeStateCopy(result?.status))}
      ${row('호스트', snapshot.host || 'unknown')}
      ${row('활성', `${snapshot.activeEngagement ? '반응' : '-'} / ${snapshot.activeExposure ? '노출' : '-'}`)}
      ${row('키', (snapshot.activeMetricKeys || []).join(', ') || '-')}
      ${row('계획', fmtNum(snapshot.compiledPlanCount))}
      ${row('옵저버', snapshot.observerAttached ? '연결' : '꺼짐')}
      ${row('큐/대기 root', `${fmtNum(snapshot.queueLength)} / ${fmtNum(snapshot.pendingMutationRootCount)}`)}
      ${row('대기 self-write', `${fmtNum(snapshot.pendingOwnedMutationCount)} / oldest ${snapshot.oldestOwnedMutationAgeMs == null ? '-' : fmtMs(snapshot.oldestOwnedMutationAgeMs)}`)}
      ${row('타이머/idle', `${snapshot.scanTimerScheduled ? '대기' : '-'} / ${snapshot.idleScheduled ? '실행' : '-'}`)}
      ${row('현재 스캔', current.group ? `${current.group} ${fmtNum(current.cursor)}/${fmtNum(current.candidateCount)}` : '-')}
      ${row('root 모드', current.rootsMode || '-')}
    </div>
    <div class="sub">스캔 카운터</div>
    <div class="grid">
      ${row('변이 스케줄', fmtNum(stats.mutationSchedules))}
      ${row('zero-root skip', fmtNum(stats.zeroRootSchedules))}
      ${row('스캔 큐', fmtNum(stats.queuedScans))}
      ${row('전체/root 스캔', `${fmtNum(stats.fullScans)} / ${fmtNum(stats.rootScans)}`)}
      ${row('root relevance skip', fmtNum(stats.skippedIrrelevantScans))}
      ${row('후보 배치', fmtNum(stats.candidateCollections))}
      ${row('후보 최근/최대', `${fmtNum(stats.lastCandidateCount)} / ${fmtNum(stats.maxCandidateCount)}`)}
      ${row('최근 root', fmtNum(stats.lastMutationRootCount))}
      ${row('최대 root', fmtNum(stats.maxMutationRootCount))}
    </div>
    <div class="sub">탐색 효율 감사</div>
    <div class="grid">
      ${row('selector hit/unique', `${fmtNum(audit.selectorHits)} / ${fmtNum(audit.selectorUniqueHits)}`)}
      ${row('selector 시간', `${fmtMs(audit.selectorQueryMs)} + deep probe ${fmtMs(audit.selectorProbeMs)}`)}
      ${row('감사 모드/오버헤드', `${snapshot.auditMode || audit.mode || 'standard'} / ${fmtMs(audit.debugOverheadMs ?? audit.selectorProbeMs)}`)}
      ${row('semantic hit/시간', `${fmtNum(audit.semanticHits)} / ${fmtMs(audit.semanticQueryMs)}`)}
      ${row('판단 hit율', `${fmtNum(appliedCount)}/${fmtNum(decisionCount)} (${yieldText})`)}
      ${row('unique/repeat target', `${fmtNum(uniqueApplied)} / ${fmtNum(audit.repeatedTargetDecisions)} (${repeatRatioText})`)}
      ${row('clear/zero candidates', `${fmtNum(audit.clearedDecisionCount)} / ${fmtNum(audit.zeroCandidateCollections)}`)}
      ${row('저효율 수집', fmtNum(audit.lowYieldCollections))}
    </div>
    <div class="sub">최근 selector 수집</div>
    <div class="list">${renderAuditCollections(audit)}</div>
    <div class="sub">최근 후보 판단</div>
    <div class="list">${renderAuditDecisions(audit)}</div>
  `;
}

function renderFeed(snapshot = {}) {
  const readout = snapshot.readout || {};
  const interaction = snapshot.interaction || null;
  const semantic = snapshot.semantic && typeof snapshot.semantic === 'object'
    ? snapshot.semantic
    : null;
  const episode = snapshot.episode && typeof snapshot.episode === 'object'
    ? snapshot.episode
    : null;
  const admission = episode?.admission || null;
  const cadence = episode?.admissionTransport?.ensoCadence || null;
  const spawnPolicy = admission?.spawnPolicy || null;
  const endpoint = episode?.endpoint || null;
  const grace = episode?.surfaceEntryGrace || null;
  const blockers = Array.isArray(episode?.blockers) ? episode.blockers : [];
  const dryRun = snapshot.dryRun && typeof snapshot.dryRun === 'object'
    ? snapshot.dryRun
    : null;
  const readiness = semantic?.readiness || null;
  const actuationSafety = semantic?.actuationSafety || null;
  const ledger = snapshot.ledger && typeof snapshot.ledger === 'object'
    ? snapshot.ledger
    : {};
  const topologyCost = ledger.counters && typeof ledger.counters === 'object'
    ? ledger.counters
    : {};
  let delay = '-';
  if (interaction?.forwardBoundaryActive) delay = 'endpoint hold';
  else if (interaction?.resistanceActive) delay = `resist ${Math.round((interaction.resistanceFactor || 0) * 100)}%`;
  else if (interaction?.actuationLocked) delay = 'locked';
  else if (interaction?.delayEnabled) delay = `${interaction.delayMs || 0}ms ${interaction.mode || 'inertia'}`;
  else if (interaction) delay = 'off';
  return `
    <div class="scope-actions">
      <span class="scope-title">Feed-flow 진단</span>
      <button type="button" data-action="terminus">터미너스 dry-run</button>
    </div>
    <div class="grid">
      ${row('활성', snapshot.active ? '예' : '아니오')}
      ${row('컨테이너', readout.containerKey || '-')}
      ${row('scrollH', `${fmtNum(readout.lastHeight)}px`)}
      ${row('깊이', fmtPercent(readout.maxDepthRatio))}
      ${row('최근 delta/임계', `${fmtNum(readout.lastDeltaPx)} / ${fmtNum(readout.lastThresholdPx)}px`)}
      ${row('step/수요', `${fmtNum(readout.totalSteps)} (${fmtNum(readout.demandSteps)})`)}
      ${row('skew', readout.pendingStep ? '대기' : (readout.skewRisk ? 'skew' : '정상'))}
      ${row('늦은 확정', fmtNum(readout.lateConfirmedSteps))}
      ${row('스크롤 관성', delay)}
    </div>
    ${semantic ? `
      <div class="sub">의미론 판정</div>
      <div class="grid">
        ${row('판정 / 후보', `${semantic.state || '-'} / ${semantic.candidateState || '-'}${semantic.stale ? ' (stale)' : ''}`)}
        ${row('표면 / 신뢰', `${semantic.surfaceMode || '-'} / ${fmtPercent(semantic.confidence)}`)}
        ${row('경계 감지 신뢰', fmtPercent(semantic.detectorConfidence))}
        ${row('학습 상태', readiness?.status || '-')}
        ${row('학습 형태', readiness?.capability || '-')}
        ${row('topology 권한', `${readiness?.topologyState || '-'} / ${readiness?.topologySource || '-'}`)}
        ${row('shipped health', readiness?.shippedTopologyStatus || '-')}
        ${row('표본 / 신뢰', `${fmtNum(readiness?.sampleCount)} / ${fmtPercent(readiness?.confidence)}`)}
        ${row('프로필', readiness?.profileId || '-')}
        ${row('작동 안전', actuationSafety?.status || '-')}
        ${row('작동 형태', actuationSafety?.capability || '-')}
        ${row('학습 사유', Array.isArray(readiness?.reasons) ? readiness.reasons.join(', ') || '-' : '-')}
        ${row('안전 사유', Array.isArray(actuationSafety?.reasons) ? actuationSafety.reasons.join(', ') || '-' : '-')}
      </div>
      <div class="sub">Topology probe 비용</div>
      <div class="grid">
        ${row('호출 / resolved', `${fmtNum(topologyCost.topologyProbeCount)} / ${fmtNum(topologyCost.topologyProbeResolvedCount)}`)}
        ${row('누적 / 최대', `${fmtMs(topologyCost.topologyProbeTotalMs)} / ${fmtMs(topologyCost.topologyProbeMaxMs)}`)}
        ${row('후보 / future branch', `${fmtNum(topologyCost.topologyProbeCandidateCount)} / ${fmtNum(topologyCost.topologyProbeFutureBranchCount)}`)}
      </div>
    ` : ''}
    ${episode ? `
      <div class="sub">Horizon → Enso</div>
      <div class="grid">
        ${row('단계', `${episode.phase || '-'} / ${episode.managerState || '-'}`)}
        ${row('admission', `${admission?.status || '-'} / ${admission?.admitted === true ? '허용' : '대기'}`)}
        ${row('차단 사유', blockers.length > 0 ? blockers.join(', ') : '-')}
        ${row('피드 표면 grace', grace ? `${fmtMs(grace.remainingMs)} 남음` : '-')}
        ${row('전경 시간 / 선택 간격', cadence ? `${fmtMs(cadence.consumedMs)} / ${fmtMs(cadence.intervalMs)}` : '미관측')}
        ${row('시간 자격', cadence ? `${cadence.reason} / revision ${cadence.revision}` : '미관측')}
        ${row('시간 관측 경과', cadence ? fmtMs(Math.max(0, episode.capturedAt - cadence.observedAt)) : '미관측')}
        ${row('소스 허가', spawnPolicy?.reason || '-')}
        ${row('endpoint', endpoint
          ? `${endpoint.resolutionStatus || '-'} / ${endpoint.leaseState || '-'}${endpoint.boundaryReached ? ' / dry' : ''}`
          : '-')}
        ${row('재요구 capture', endpoint?.controlsLive ? 'live' : '대기')}
        ${row('dry-run', dryRun
          ? `${dryRun.phase || '-'} / ${dryRun.endpoint?.leaseState || '-'}`
          : '-')}
      </div>
    ` : ''}
  `;
}


function formatHistoryDetails(details = {}) {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' ');
}

function chip(label, ok) {
  return `<span class="chip" data-ok="${ok === true ? 'true' : 'false'}">${escapeHtml(label)} ${ok === true ? 'Y' : 'N'}</span>`;
}

function renderClickGate(snapshot = {}) {
  const lastDecision = snapshot.lastDecision || null;
  const details = lastDecision?.details && typeof lastDecision.details === 'object' ? lastDecision.details : {};
  const decisions = Array.isArray(snapshot.recentDecisions) ? snapshot.recentDecisions.slice(0, 8) : [];
  const history = Array.isArray(snapshot.recentHistory) ? snapshot.recentHistory.slice(0, 10) : [];
  const eventCounts = snapshot.eventCounts || {};
  const ensoGate = details.ensoGate || {};
  const hotEvents = [
    'click_routing_decision',
    'click_bypassed',
    'click_delayed',
    'enso_gate_started',
    'enso_gate_force_spawned',
    'enso_gate_stroke_retry',
    'enso_gate_debug_stroke_retry',
    'enso_gate_debug_entered',
    'enso_gate_debug_escaped',
    'enso_gate_debug_neutral_release',
    'enso_gate_click_blocked',
    'enso_gate_entered',
    'enso_gate_escaped',
    'click_replayed',
  ].filter((key) => eventCounts[key]);
  const youtube = details.youtube || {};
  return `
    <div class="scope-actions">
      <span class="scope-title">클릭 게이트 판정</span>
      <button type="button" data-action="enso-force-spawn">Enso 강제스폰</button>
      <button type="button" data-action="copy-active-summary">클릭 근거 복사</button>
    </div>
    <div class="grid">
      ${row('상태', snapshot.status || (snapshot.active ? 'active' : 'inactive'))}
      ${row('apply/remove', `${fmtNum(snapshot.applyCount)} / ${fmtNum(snapshot.unmountCount)}`)}
      ${row('마지막 행동', details.action || '-')}
      ${row('이유', details.reason || '-')}
      ${row('Enso 판단', formatEnsoGateReadinessSummary(ensoGate))}
      ${row('raw target', details.rawTarget || '-')}
      ${row('target', details.target || '-')}
      ${row('마지막 오류', snapshot.lastError?.message || snapshot.lastError || '-')}
    </div>
    <div class="sub">핵심 이벤트 카운트</div>
    <div class="list">
      ${hotEvents.length ? hotEvents.map((key) => `
        <div class="item"><span>${escapeHtml(key)}</span><b>${fmtNum(eventCounts[key])}</b></div>
      `).join('') : '<div class="empty">아직 클릭 게이트 이벤트가 없습니다</div>'}
    </div>
    <div class="sub">마지막 클릭 판정</div>
    <div class="list">
      <div class="detail">${escapeHtml(summarizeClickRoutingDecision(lastDecision))}</div>
      <div class="detail">${escapeHtml(Array.isArray(details.domPath) ? details.domPath.join(' > ') : '-')}</div>
    </div>
    <div class="sub">셀렉터 매치 사다리</div>
    <div class="detail">${escapeHtml(formatSelectorMatchSummary(details.selectorMatches))}</div>
    <div class="sub">YouTube 컨트롤 계약</div>
    <div class="chips">
      ${chip('player', youtube.insidePlayer)}
      ${chip('chrome bottom', youtube.insideChromeBottom)}
      ${chip('chrome controls', youtube.insideChromeControls)}
      ${chip('button', youtube.insideButton)}
      ${chip('progress', youtube.insideProgress)}
      ${chip('menu', youtube.insideMenu)}
      ${chip('volume', youtube.insideVolume)}
    </div>
    <div class="detail">${escapeHtml(formatYouTubeContractSummary(youtube))}</div>
    <div class="sub">경계 분류기</div>
    <div class="detail">${escapeHtml(formatClickBoundarySummary(details.clickBoundary))}</div>
    <div class="sub">최근 클릭 라우팅 판정</div>
    <div class="list">
      ${decisions.length ? decisions.map((entry) => {
        const item = entry.details && typeof entry.details === 'object' ? entry.details : {};
        return `
          <div class="item">
            <span>${escapeHtml(`${item.action || '-'} ${item.reason || ''}`)}</span>
            <b>${escapeHtml(entry.ts ? new Date(entry.ts).toLocaleTimeString() : '-')}</b>
          </div>
          <div class="detail">${escapeHtml(`${item.target || '-'} | ${formatSelectorMatchSummary(item.selectorMatches)}`)}</div>
        `;
      }).join('') : '<div class="empty">최근 클릭 라우팅 판정이 없습니다</div>'}
    </div>
    <div class="sub">최근 클릭 타임라인</div>
    <div class="list">
      ${history.length ? history.map((entry) => `
        <div class="item">
          <span>${escapeHtml(`${entry.name || entry.type || '-'}${entry.error ? ` ${entry.error}` : ''}`)}</span>
          <b>${escapeHtml(entry.ts ? new Date(entry.ts).toLocaleTimeString() : '-')}</b>
        </div>
        ${entry.details ? `<div class="detail">${escapeHtml(formatHistoryDetails(entry.details))}</div>` : ''}
      `).join('') : '<div class="empty">최근 클릭 타임라인이 없습니다</div>'}
    </div>
  `;
}

const VIDEO_SKIP_SEEK_DECISION_EVENTS = Object.freeze([
  'seek_allowed_unattributed',
  'seek_detected_user',
  'seek_allowed_cooldown_started',
  'seek_ignored_small_delta',
  'seek_blocked_hard_block',
  'seek_blocked_cooldown',
  'seek_blocked_delayed_programmatic_followup',
  'seek_blocked_delayed_programmatic_replay',
  'seek_blocked_during_revert',
]);

function findLastVideoSeekDecision(feature = {}) {
  const history = Array.isArray(feature.history) ? feature.history : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry?.type === 'event' && VIDEO_SKIP_SEEK_DECISION_EVENTS.includes(entry.name)) {
      return entry;
    }
  }
  return null;
}

function formatSeekDecisionDetails(details = {}) {
  if (!details || typeof details !== 'object') return '';
  const frame = details.frame && typeof details.frame === 'object' ? details.frame : {};
  const event = details.seekingEvent && typeof details.seekingEvent === 'object' ? details.seekingEvent : {};
  const parts = [
    details.reason ? `reason=${details.reason}` : '',
    Number.isFinite(Number(details.delta)) ? `delta=${details.delta}` : '',
    Number.isFinite(Number(details.from)) && Number.isFinite(Number(details.to))
      ? `range=${details.from}->${details.to}`
      : '',
    typeof details.userGestureRecent === 'boolean' ? `gestureRecent=${details.userGestureRecent}` : '',
    typeof details.mediaSeekGestureRecent === 'boolean' ? `mediaSeekRecent=${details.mediaSeekGestureRecent}` : '',
    details.gestureAgeMs !== null && details.gestureAgeMs !== undefined ? `gestureAgeMs=${details.gestureAgeMs}` : '',
    details.lastGesture?.type ? `lastGesture=${details.lastGesture.type}` : '',
    typeof details.lastGesture?.mediaSeekContext === 'boolean' ? `mediaContext=${details.lastGesture.mediaSeekContext}` : '',
    event.type ? `event=${event.type}${event.isTrusted === true ? ':trusted' : ':untrusted'}` : '',
    typeof frame.topFrame === 'boolean' ? `topFrame=${frame.topFrame}` : '',
    frame.frameElementTagName ? `frame=${frame.frameElementTagName}` : '',
    details.policyMode ? `policy=${details.policyMode}` : '',
    Number.isFinite(Number(details.targetTime)) ? `target=${details.targetTime}` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

function renderVideoSkip(snapshot = {}) {
  const feature = snapshot.features?.videoSkipGuard || {};
  const summary = snapshot.summary?.features?.videoSkipGuard || {};
  const history = Array.isArray(feature.history) ? feature.history.slice(-12).reverse() : [];
  const eventCounts = feature.eventCounts || {};
  const lastSeekDecision = findLastVideoSeekDecision(feature);
  const hotEvents = [
    'manager_apply',
    'manager_remove',
    'no_html_video_observed',
    'existing_video_scan',
    'video_attached',
    'video_handlers_attached',
    'video_detached_stale',
    'video_detached_pruned',
    'seeking',
    'seek_allowed_unattributed',
    'seek_ignored_small_delta',
    'seek_detected_user',
    'seek_allowed_cooldown_started',
    'seek_blocked_hard_block',
    'seek_blocked_cooldown',
    'seek_blocked_delayed_programmatic_followup',
    'seek_blocked_delayed_programmatic_replay',
    'revert_scheduled',
    'revert_completed',
    'media_adapter_seek_requested',
    'revert_position_retry_requested',
  ].filter((key) => eventCounts[key]);
  return `
    <div class="grid">
      ${row('상태', feature.active ? 'active' : (summary.status || 'inactive'))}
      ${row('apply/remove', `${fmtNum(feature.applyCount)} / ${fmtNum(feature.unmountCount)}`)}
      ${row('마지막 이벤트', feature.lastEvent?.name || summary.lastEventName || '-')}
      ${row('마지막 오류', feature.lastError?.message || summary.lastError || '-')}
      ${row('힌트', Array.isArray(summary.hints) ? summary.hints.join(', ') || '-' : '-')}
      ${row('제약', Array.isArray(summary.limits) ? summary.limits.join(', ') || '-' : '-')}
    </div>
    <div class="sub">핵심 이벤트 카운트</div>
    <div class="list">
      ${hotEvents.length ? hotEvents.map((key) => `
        <div class="item"><span>${escapeHtml(key)}</span><b>${fmtNum(eventCounts[key])}</b></div>
      `).join('') : '<div class="empty">아직 스킵가드 이벤트가 없습니다</div>'}
    </div>
    <div class="sub">마지막 seek 판단</div>
    <div class="list">
      ${lastSeekDecision ? `
        <div class="item">
          <span>${escapeHtml(lastSeekDecision.name || '-')}</span>
          <b>${escapeHtml(lastSeekDecision.ts ? new Date(lastSeekDecision.ts).toLocaleTimeString() : '-')}</b>
        </div>
        <div class="detail">${escapeHtml(formatSeekDecisionDetails(lastSeekDecision.details))}</div>
      ` : '<div class="empty">아직 seek 판단 이벤트가 없습니다</div>'}
    </div>
    <div class="sub">최근 타임라인</div>
    <div class="list">
      ${history.length ? history.map((entry) => `
        <div class="item">
          <span>${escapeHtml(`${entry.name || entry.type || '-'}${entry.error ? ` ${entry.error}` : ''}`)}</span>
          <b>${escapeHtml(entry.ts ? new Date(entry.ts).toLocaleTimeString() : '-')}</b>
        </div>
        ${entry.details ? `<div class="detail">${escapeHtml(formatHistoryDetails(entry.details))}</div>` : ''}
      `).join('') : '<div class="empty">최근 스킵가드 타임라인이 없습니다</div>'}
    </div>
  `;
}

function renderSentinelStartFailureDiagnostics(diagnostics) {
  if (!diagnostics) return '<div class="sub">START diagnostics unavailable</div>';
  const value = (key) => diagnostics[key] === null ? 'unavailable' : diagnostics[key];
  return `<div class="grid">
    ${row('runtimeStage', value('runtimeStage'))}
    ${row('lastError', value('lastError'))}
    ${row('hostConnected', value('hostConnected'))}
    ${row('hostChannelAuthenticated', value('hostChannelAuthenticated'))}
    ${row('workerBootReady', value('workerBootReady'))}
    ${row('workerFirstFrameReady', value('workerFirstFrameReady'))}
  </div>`;
}

function renderSentinel(snapshot = {}) {
  const timeline = snapshot.timeline || {};
  const events = Array.isArray(timeline.events) ? timeline.events.slice(-10).reverse() : [];
  const lastLaunch = snapshot.lastLaunch || null;
  const game = snapshot.game || snapshot.telemetry?.globalSentinel || null;
  const lastLaunchLabel = lastLaunch
    ? `${lastLaunch.protocolLabel || lastLaunch.protocolScope} ${lastLaunch.success ? 'ok' : lastLaunch.error}`
    : '-';
  return `
    <div class="inline-actions">
      <button type="button" data-action="sentinel-site">Site Furin</button>
      <button type="button" data-action="sentinel-global">Global Sentinel</button>
    </div>
    <div class="grid">
      ${row('timeline', snapshot.loaded ? 'loaded' : (snapshot.pending ? 'loading' : 'idle'))}
      ${row('entries', fmtNum(timeline.totalEntries))}
      ${row('last update', snapshot.lastUpdatedAt ? new Date(snapshot.lastUpdatedAt).toLocaleTimeString() : '-')}
      ${row('error', snapshot.error || '-')}
      ${row('last launch', lastLaunchLabel)}
    </div>
    ${lastLaunch?.success === false ? renderSentinelStartFailureDiagnostics(lastLaunch.startFailureDiagnostics) : ''}
    <div class="sub">Global Sentinel Game</div>
    <div class="grid">
      ${row('phase', game?.gamePhase || '-')}
      ${row('scope', game?.protocolScope || '-')}
      ${row('sync pressure', game ? fmtPercent(game.syncPressure) : '-')}
      ${row('fracture', game ? fmtPercent(game.fracture) : '-')}
      ${row('repair amount', game ? fmtPercent(game.fractureRepairAmount) : '-')}
      ${row('repair pressure', game ? fmtNum(game.fractureRepairPressure) : '-')}
      ${row('repair elapsed', game ? fmtMs(game.fractureRepairElapsedMs) : '-')}
      ${row('last hit eff.', game ? fmtPercent(game.lastHitEfficiency) : '-')}
      ${row('last fracture', game ? fmtPercent(game.lastFractureImpulse) : '-')}
      ${row('impact serial', game ? fmtNum(game.fractureImpactSerial) : '-')}
    </div>
    <div class="sub">최근 Sentinel Protocol</div>
    <div class="list">
      ${events.length ? events.map((entry) => `
        <div class="item">
          <span>${escapeHtml(`${entry.phase || '-'} ${entry.status || '-'} ${entry.source || '-'}`)}</span>
          <b>${escapeHtml(entry.error || entry.protocolScope || entry.reason || '-')}</b>
          ${entry.error && entry.reason ? `<span>${escapeHtml(`reason=${entry.reason}`)}</span>` : ''}
          ${entry.startFailureDiagnostics ? renderSentinelStartFailureDiagnostics(entry.startFailureDiagnostics) : ''}
        </div>
      `).join('') : '<div class="empty">timeline 이벤트가 없습니다</div>'}
    </div>
  `;
}

export class RuntimeDebuggerOverlay {
  constructor({ documentRef = typeof document !== 'undefined' ? document : null } = {}) {
    this._document = documentRef;
    this._host = null;
    this._root = null;
    this._refs = null;
    this._releaseMediaObservationExclusion = null;
    this._callbacks = {};
    this._open = false;
    this._guideOpen = false;
    this._guideMarkup = '';
    this._activeTab = 'observer';
    this._lastState = null;
    this._boundClick = (event) => this._handleClick(event);
    this._boundKeydown = (event) => this._handleKeydown(event);
  }

  mount(callbacks = {}) {
    this._callbacks = callbacks || {};
    if (this._host) return true;
    if (!this._document?.documentElement) return false;
    let host = null;
    let root = null;
    try {
      host = this._document.createElement('div');
      host.id = HOST_ID;
      this._releaseMediaObservationExclusion = registerMediaObservationExcludedNode(host);
      host.setAttribute('aria-label', 'Entropy runtime debugger');
      root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : null;
      if (!root) throw new Error('RUNTIME_DEBUGGER_SHADOW_ROOT_REQUIRED');

      const style = this._document.createElement('style');
      style.textContent = RUNTIME_DEBUGGER_OVERLAY_STYLE;
      const launcher = this._document.createElement('button');
      launcher.className = 'launcher';
      launcher.type = 'button';
      launcher.dataset.action = 'toggle';
      launcher.dataset.open = 'false';
      launcher.setAttribute('aria-controls', PANEL_ID);
      launcher.setAttribute('aria-expanded', 'false');
      launcher.setAttribute('title', '런타임 비용 관측을 시작합니다');
      launcher.innerHTML = `
        <span class="dot" aria-hidden="true"></span>
        <span data-k="launcher-label">관측 시작</span>
        <span class="readiness-badge" data-k="feed-readiness" data-tone="neutral">피드 대기</span>
      `;

      const panel = this._document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'panel';
      panel.dataset.open = 'false';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('aria-labelledby', PANEL_TITLE_ID);
      panel.innerHTML = `
        <div class="header">
          <div class="title-block">
            <div class="title" id="${PANEL_TITLE_ID}">런타임 디버거</div>
            <div class="session-label" data-k="session-label">세션 대기</div>
          </div>
          <div class="actions" aria-label="관측 제어">
            <button type="button" data-action="pause" title="샘플 읽기만 잠시 멈춥니다">일시정지</button>
            <button type="button" data-action="reset" data-kind="primary" title="누적 카운터는 유지하고 현재 값을 새 기준점으로 잡습니다">새 기준점</button>
            <button type="button" data-action="reload-observe" title="새로고침 전부터 관측을 이어갑니다">새로고침 관측</button>
          </div>
        </div>
        <div class="capture-strip" data-k="capture-strip"></div>
        <div class="tabs" role="tablist" aria-label="런타임 진단 범위">
          <button type="button" id="${HOST_ID}-tab-observer" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="observer">개요</button>
          <button type="button" id="${HOST_ID}-tab-protection" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="protection">옵저버</button>
          <button type="button" id="${HOST_ID}-tab-social" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="social">소셜</button>
          <button type="button" id="${HOST_ID}-tab-visual" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="visual">비주얼</button>
          <button type="button" id="${HOST_ID}-tab-text" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="text">텍스트</button>
          <button type="button" id="${HOST_ID}-tab-short" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="short">숏폼</button>
          <button type="button" id="${HOST_ID}-tab-video-observer" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="video-observer">영상 옵저버</button>
          <button type="button" id="${HOST_ID}-tab-click" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="click">클릭</button>
          <button type="button" id="${HOST_ID}-tab-video" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="video">스킵</button>
          <button type="button" id="${HOST_ID}-tab-feed" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="feed">피드</button>
          <button type="button" id="${HOST_ID}-tab-sentinel" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="sentinel">센티넬</button>
          <button type="button" id="${HOST_ID}-tab-log" role="tab" aria-controls="${TAB_PANEL_ID}" data-tab="log">로그</button>
        </div>
        <div class="export-bar" aria-label="진단 내보내기">
          <span class="label" data-k="export-label">개요</span>
          <button type="button" id="${GUIDE_BUTTON_ID}" data-action="measurement-guide" aria-controls="${GUIDE_PANEL_ID}" aria-expanded="false" title="현재 항목의 실제 측정 순서를 확인합니다">측정 힌트</button>
          <span class="spacer"></span>
          <button type="button" data-action="copy-active-log" title="현재 항목의 구조화 로그를 복사합니다">개별 로그</button>
          <button type="button" data-action="copy-active-summary" title="현재 항목의 에이전트 진단용 요약을 복사합니다">항목 요약</button>
          <button type="button" data-action="copy-summary" data-kind="primary" title="모든 항목의 에이전트 진단용 리포트를 복사합니다">전체 리포트</button>
          <button type="button" data-action="copy" title="세션 전체 JSON을 복사합니다">원본 JSON</button>
        </div>
        <div class="guide-panel" id="${GUIDE_PANEL_ID}" role="region" aria-labelledby="${GUIDE_BUTTON_ID}" hidden data-k="guide"></div>
        <div class="body" id="${TAB_PANEL_ID}" role="tabpanel" tabindex="0" data-k="body"></div>
        <div class="status" role="status" aria-live="polite" data-k="status"></div>
      `;

      root.appendChild(style);
      root.appendChild(launcher);
      root.appendChild(panel);
      root.addEventListener('click', this._boundClick);
      root.addEventListener('keydown', this._boundKeydown);
      this._document.documentElement.appendChild(host);

      this._host = host;
      this._root = root;
      this._refs = {
        launcher,
        launcherLabel: launcher.querySelector('[data-k="launcher-label"]'),
        feedReadiness: launcher.querySelector('[data-k="feed-readiness"]'),
        panel,
        pause: panel.querySelector('[data-action="pause"]'),
        tabs: Array.from(panel.querySelectorAll('[data-tab]')),
        sessionLabel: panel.querySelector('[data-k="session-label"]'),
        captureStrip: panel.querySelector('[data-k="capture-strip"]'),
        exportLabel: panel.querySelector('[data-k="export-label"]'),
        activeLog: panel.querySelector('[data-action="copy-active-log"]'),
        activeSummary: panel.querySelector('[data-action="copy-active-summary"]'),
        guideButton: panel.querySelector('[data-action="measurement-guide"]'),
        guidePanel: panel.querySelector('[data-k="guide"]'),
        body: panel.querySelector('[data-k="body"]'),
        status: panel.querySelector('[data-k="status"]'),
      };
      this.render(this._lastState || {});
      return true;
    } catch (error) {
      try {
        root?.removeEventListener?.('click', this._boundClick);
        root?.removeEventListener?.('keydown', this._boundKeydown);
        if (host?.parentNode) host.parentNode.removeChild(host);
      } catch (cleanupError) {
        if (error && typeof error === 'object') {
          error.mountCleanupError = String(cleanupError?.message || cleanupError || 'MOUNT_CLEANUP_FAILED');
        }
      }
      this._host = null;
      this._root = null;
      this._refs = null;
      this._releaseMediaObservationExclusion?.();
      this._releaseMediaObservationExclusion = null;
      throw error;
    }
  }

  unmount() {
    try {
      if (this._root) this._root.removeEventListener('click', this._boundClick);
      if (this._root) this._root.removeEventListener('keydown', this._boundKeydown);
      if (this._host?.parentNode) this._host.parentNode.removeChild(this._host);
      return true;
    } finally {
      this._releaseMediaObservationExclusion?.();
      this._releaseMediaObservationExclusion = null;
      this._host = null;
      this._root = null;
      this._refs = null;
      this._callbacks = {};
      this._guideOpen = false;
      this._guideMarkup = '';
    }
  }

  setOpen(open) {
    this._open = open === true;
    if (!this._open) this._guideOpen = false;
    if (this._refs?.launcher) {
      this._refs.launcher.dataset.open = this._open ? 'true' : 'false';
      this._refs.launcher.setAttribute('aria-expanded', this._open ? 'true' : 'false');
      this._refs.launcher.setAttribute(
        'title',
        this._open ? '현재 런타임 관측 세션을 종료합니다' : '런타임 비용 관측을 시작합니다',
      );
    }
    if (this._refs?.launcherLabel) {
      this._refs.launcherLabel.textContent = this._open ? '관측 종료' : '관측 시작';
    }
    if (this._refs?.panel) {
      this._refs.panel.dataset.open = this._open ? 'true' : 'false';
      this._refs.panel.setAttribute('aria-hidden', this._open ? 'false' : 'true');
    }
  }

  setStatus(text) {
    if (this._refs?.status) this._refs.status.textContent = text || '';
  }

  render(state = {}) {
    this._lastState = state;
    if (!this._refs) return;
    this.setOpen(state.open === true);
    this._activeTab = state.activeTab || this._activeTab;
    this._refs.tabs.forEach((tab) => {
      const active = tab.dataset.tab === this._activeTab;
      tab.dataset.active = active ? 'true' : 'false';
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active) this._refs.body?.setAttribute('aria-labelledby', tab.id);
    });
    if (this._refs.pause) {
      this._refs.pause.textContent = state.paused ? '재개' : '일시정지';
      this._refs.pause.dataset.active = state.paused ? 'true' : 'false';
    }
    if (this._refs.sessionLabel) {
      const session = state.sessionView || {};
      this._refs.sessionLabel.textContent = state.open
        ? `${getRuntimeDebuggerCaptureKindCopy(session.captureKind)} · 기준점 ${session.startedAt ? new Date(session.startedAt).toLocaleTimeString() : '-'}`
        : '세션 대기 · 기준점을 잡아 실제 변화량만 측정합니다';
    }
    if (this._refs.captureStrip) {
      this._refs.captureStrip.innerHTML = renderRuntimeDebuggerCaptureStrip(state);
    }
    if (this._refs.feedReadiness) {
      const presentation = presentFeedTopologyReadiness(
        state.feed?.semantic?.readiness || null,
        { locale: this._document?.documentElement?.lang || 'ko' },
      );
      this._refs.feedReadiness.textContent = presentation.label;
      this._refs.feedReadiness.dataset.tone = presentation.tone;
      this._refs.feedReadiness.setAttribute('aria-label', presentation.ariaLabel);
      this._refs.feedReadiness.title = presentation.ariaLabel;
    }
    if (this._refs.exportLabel) {
      const activeButton = this._refs.tabs.find((tab) => tab.dataset.tab === this._activeTab);
      this._refs.exportLabel.textContent = activeButton?.textContent || this._activeTab;
    }
    const itemExportAvailable = Boolean(RUNTIME_DEBUGGER_TAB_TO_PROBE_ID[this._activeTab]);
    if (this._refs.activeLog) {
      this._refs.activeLog.disabled = !itemExportAvailable;
      this._refs.activeLog.title = itemExportAvailable
        ? '현재 항목의 구조화 로그를 복사합니다'
        : '개별 진단 탭을 선택해야 합니다';
    }
    if (this._refs.activeSummary) {
      this._refs.activeSummary.disabled = !itemExportAvailable;
      this._refs.activeSummary.title = itemExportAvailable
        ? '현재 항목의 에이전트 진단용 요약을 복사합니다'
        : '개별 진단 탭을 선택해야 합니다';
    }
    this._renderGuide(state);

    if (this._activeTab === 'protection') {
      this._refs.body.innerHTML = renderObserver(state.observer || {});
    } else if (this._activeTab === 'click') {
      this._refs.body.innerHTML = renderClickGate(state.clickGate || {});
    } else if (this._activeTab === 'video') {
      this._refs.body.innerHTML = renderVideoSkip(state.protection || {});
    } else if (this._activeTab === 'social') {
      this._refs.body.innerHTML = renderSocial(
        state.social || {},
        findRuntimeDebuggerProbe(state.probeResults, 'socialMetrics'),
      );
    } else if (this._activeTab === 'visual') {
      this._refs.body.innerHTML = renderRuntimeDebuggerEffectProbe({
        title: 'Visual Artifact / Media',
        snapshot: state.effects?.visual || {},
        result: findRuntimeDebuggerProbe(state.probeResults, 'visual'),
      });
    } else if (this._activeTab === 'text') {
      const textSnapshot = state.effects?.textShuffle || {};
      const isHighlightOn = textSnapshot.highlightEnabled === true;
      this._refs.body.innerHTML = renderRuntimeDebuggerEffectProbe({
        title: 'Text Shuffle',
        snapshot: textSnapshot,
        result: findRuntimeDebuggerProbe(state.probeResults, 'textShuffle'),
        actions: `
          <button type="button" data-action="text-shuffle-highlight" data-active="${isHighlightOn ? 'true' : 'false'}" title="셔플된 텍스트의 라벨(SHUF)과 하이라이트 표시를 켜거나 끕니다">
            셔플 하이라이트 ${isHighlightOn ? '켜짐' : '꺼짐'}
          </button>
        `,
      });
    } else if (this._activeTab === 'short') {
      this._refs.body.innerHTML = renderRuntimeDebuggerEffectProbe({
        title: 'Short-form Block',
        snapshot: state.effects?.shortForm || {},
        result: findRuntimeDebuggerProbe(state.probeResults, 'shortForm'),
      });
    } else if (this._activeTab === 'video-observer') {
      this._refs.body.innerHTML = renderRuntimeDebuggerEffectProbe({
        title: 'Video Element Observer',
        snapshot: state.effects?.videoObservation || {},
        result: findRuntimeDebuggerProbe(state.probeResults, 'videoObservation'),
      });
    } else if (this._activeTab === 'feed') {
      this._refs.body.innerHTML = renderFeed(state.feed || {});
    } else if (this._activeTab === 'sentinel') {
      this._refs.body.innerHTML = renderSentinel(state.sentinel || {});
    } else if (this._activeTab === 'log') {
      this._refs.body.innerHTML = renderRuntimeDebuggerSessionLog(
        state.samples || [],
        state.errors || [],
        state.events || [],
      );
    } else {
      this._refs.body.innerHTML = renderRuntimeDebuggerOverview(state);
    }

    const terminus = this._refs.body.querySelector('[data-action="terminus"]');
    if (terminus) {
      terminus.dataset.active = state.terminusDryRun ? 'true' : 'false';
    }
  }

  _renderGuide(state = {}) {
    if (!this._refs?.guideButton || !this._refs?.guidePanel) return;
    this._refs.guideButton.setAttribute('aria-expanded', this._guideOpen ? 'true' : 'false');
    this._refs.guideButton.dataset.active = this._guideOpen ? 'true' : 'false';
    this._refs.guideButton.textContent = this._guideOpen ? '힌트 닫기' : '측정 힌트';
    this._refs.guidePanel.hidden = !this._guideOpen;
    if (!this._guideOpen) return;
    const markup = renderRuntimeDebuggerMeasurementGuide(
      this._activeTab,
      state,
    );
    if (markup === this._guideMarkup) return;
    this._refs.guidePanel.innerHTML = markup;
    this._guideMarkup = markup;
  }

  _handleClick(event) {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!(target instanceof Element)) return;
    const action = target.getAttribute('data-action');
    const tab = target.getAttribute('data-tab');
    if (action || tab) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (tab) {
      this._activeTab = tab;
      this._callbacks.onTab?.(tab);
      return;
    }
    if (action === 'measurement-guide') {
      this._guideOpen = !this._guideOpen;
      this._renderGuide(this._lastState || {});
    } else if (action === 'toggle') this._callbacks.onToggle?.();
    else if (action) this._callbacks.onAction?.(action);
  }

  _handleKeydown(event) {
    if (event.key === 'Escape' && this._guideOpen) {
      event.preventDefault();
      event.stopPropagation();
      this._guideOpen = false;
      this._renderGuide(this._lastState || {});
      this._refs?.guideButton?.focus();
      return;
    }
    if (event.key === 'Escape' && this._open) {
      event.preventDefault();
      event.stopPropagation();
      this._callbacks.onToggle?.();
      return;
    }

    const target = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    if (!(target instanceof Element)) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const currentIndex = this._refs?.tabs.indexOf(target) ?? -1;
    if (currentIndex < 0) return;
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = this._refs.tabs.length - 1;
    else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % this._refs.tabs.length;
    else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + this._refs.tabs.length) % this._refs.tabs.length;
    }
    const nextTab = this._refs.tabs[nextIndex];
    if (!nextTab) return;
    event.preventDefault();
    event.stopPropagation();
    nextTab.focus();
    this._activeTab = nextTab.dataset.tab;
    this._callbacks.onTab?.(this._activeTab);
  }
}

export default RuntimeDebuggerOverlay;
