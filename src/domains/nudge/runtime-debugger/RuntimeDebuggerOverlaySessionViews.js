import { getRuntimeDebuggerMeasurementGuide } from './RuntimeDebuggerMeasurementGuide.js';

const PROBE_STATE_COPY = Object.freeze({
  measured: '측정됨',
  armed_idle: '대기 중',
  insufficient: '표본 부족',
  inactive: '비활성',
  unavailable: '사용 불가',
  broken: '계측 오류',
});

const PROBE_REASON_COPY = Object.freeze({
  canonical_activation_absent: '현재 canonical 활성 키에 포함되지 않았습니다.',
  probe_owner_unavailable: '계측 소유자가 이 페이지에 로드되지 않았습니다.',
  activation_state_unavailable: '계측 소유자 오류로 현재 활성 상태를 확인할 수 없습니다.',
  active_probe_contract_incomplete: '활성 상태지만 observer/계측 계약이 준비되지 않았습니다.',
  baseline_coverage_missing: '계측 소유자가 기준점 뒤에 로드됐습니다. 새 기준점을 설정해야 합니다.',
  no_session_operation: 'baseline 이후 실제 처리 작업이 아직 없습니다.',
  insufficient_session_operations: '판정에 필요한 세션 작업 수가 부족합니다.',
  measurement_valid: 'baseline 이후 실제 처리 작업이 측정됐습니다.',
});

const PROBE_TO_TAB = Object.freeze({
  observerHub: 'protection',
  socialMetrics: 'social',
  visual: 'visual',
  textShuffle: 'text',
  shortForm: 'short',
  videoObservation: 'video-observer',
  clickGate: 'click',
  videoSkip: 'video',
  feedFlow: 'feed',
  sentinel: 'sentinel',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(value) {
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : '0';
}

function fmtMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0ms';
  return `${num.toFixed(num >= 10 ? 1 : 2)}ms`;
}

function row(label, value) {
  return `<span class="k">${escapeHtml(label)}</span><span class="v">${escapeHtml(value)}</span>`;
}

function fmtDuration(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function getRuntimeDebuggerCaptureKindCopy(captureKind) {
  if (captureKind === 'reload') return '새로고침';
  if (captureKind === 'idle') return '대기';
  return '실시간';
}

export function getRuntimeDebuggerProbeStateCopy(status) {
  return PROBE_STATE_COPY[status] || status || '판정 전';
}

export function getRuntimeDebuggerProbeReason(probe = {}) {
  if (probe.reason) return PROBE_REASON_COPY[probe.reason] || probe.reason;
  if (Array.isArray(probe.reasons) && probe.reasons.length > 0) return probe.reasons.join(', ');
  return '아직 세션 판정이 없습니다.';
}

export function findRuntimeDebuggerProbe(probeResults, probeId) {
  if (!Array.isArray(probeResults)) return null;
  return probeResults.find((entry) => entry?.probeId === probeId) || null;
}

export function renderRuntimeDebuggerMeasurementGuide(tabId, state = {}) {
  const guide = getRuntimeDebuggerMeasurementGuide(tabId);
  const probe = guide.probeId
    ? findRuntimeDebuggerProbe(state.probeResults, guide.probeId)
    : null;
  const status = probe?.status || 'neutral';
  const statusCopy = probe ? getRuntimeDebuggerProbeStateCopy(status) : '안내';
  const currentReason = probe ? getRuntimeDebuggerProbeReason(probe) : null;
  return `
    <div class="guide-heading">
      <div>
        <div class="guide-title">${escapeHtml(guide.title)}</div>
        <div class="guide-purpose">${escapeHtml(guide.purpose)}</div>
      </div>
      <span class="guide-state" data-state="${escapeHtml(status)}">현재 · ${escapeHtml(statusCopy)}</span>
    </div>
    ${currentReason ? `<div class="guide-current">${escapeHtml(currentReason)}</div>` : ''}
    <ol class="guide-steps">
      ${guide.steps.map((step) => `
        <li>
          <b>${escapeHtml(step.label)}</b>
          <span>${escapeHtml(step.text)}</span>
        </li>
      `).join('')}
    </ol>
    <div class="guide-validity">
      <b>유효 캡처 신호</b>
      <ul>
        ${guide.validSignals.map((signal) => `<li>${escapeHtml(signal)}</li>`).join('')}
      </ul>
    </div>
    <div class="guide-caution"><b>주의</b><span>${escapeHtml(guide.caution)}</span></div>
  `;
}

export function renderProbeCard(probe = {}) {
  const status = probe.status || 'unavailable';
  const tab = PROBE_TO_TAB[probe.probeId] || 'log';
  const operationCount = Number(probe.operationCount);
  const metric = probe.summaryMetric
    || (Number.isFinite(operationCount) ? `${fmtNum(operationCount)}회 처리` : '측정 안 됨');
  return `
    <button type="button" class="state-card" data-state="${escapeHtml(status)}" data-tab="${escapeHtml(tab)}">
      <div>
        <div class="name">${escapeHtml(probe.label || probe.probeId || 'unknown')}</div>
        <div class="reason">${escapeHtml(getRuntimeDebuggerProbeReason(probe))}</div>
      </div>
      <div class="metric">${escapeHtml(getRuntimeDebuggerProbeStateCopy(status))}<br>${escapeHtml(metric)}</div>
    </button>
  `;
}

export function renderRuntimeDebuggerOverview(state = {}) {
  const probeResults = Array.isArray(state.probeResults) ? state.probeResults : [];
  const protectionRuntime = state.protection?.summary?.runtime || {};
  return `
    <div class="grid">
      ${row('보호 런타임', protectionRuntime.shouldActivate ? '활성' : '비활성')}
      ${row('active keys', Array.isArray(protectionRuntime.activeFilterKeys) ? protectionRuntime.activeFilterKeys.join(', ') || '-' : '-')}
      ${row('observer flush', fmtNum(state.observer?.flushes))}
      ${row('observer mutations', fmtNum(state.observer?.mutations))}
      ${row('디버거 오류', fmtNum(state.errors?.length))}
    </div>
    <div class="sub">효과별 세션 판정</div>
    <div class="state-list">
      ${probeResults.length
    ? probeResults.map(renderProbeCard).join('')
    : '<div class="empty">세션을 시작하면 활성/대기/측정 상태를 구분해 표시합니다.</div>'}
    </div>
  `;
}

function flattenMetricEntries(value, { prefix = '', depth = 0, output = [] } = {}) {
  if (!value || typeof value !== 'object' || depth > 2 || output.length >= 24) return output;
  Object.entries(value).forEach(([key, item]) => {
    if (output.length >= 24) return;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'number' || typeof item === 'boolean' || typeof item === 'string') {
      output.push([path, item]);
    } else if (!Array.isArray(item) && item && typeof item === 'object') {
      flattenMetricEntries(item, { prefix: path, depth: depth + 1, output });
    }
  });
  return output;
}

function renderRecentOperations(snapshot = {}) {
  const operations = Array.isArray(snapshot.recentOperations)
    ? snapshot.recentOperations.slice(-10).reverse()
    : [];
  if (operations.length === 0) return '<div class="empty">이 세션에서 기록된 작업이 없습니다.</div>';
  return operations.map((entry) => {
    const label = entry.type || entry.operation || entry.source || entry.phase || entry.name || 'operation';
    const duration = Number.isFinite(Number(entry.durationMs)) ? fmtMs(entry.durationMs) : '-';
    const details = Object.entries(entry)
      .filter(([key]) => !['type', 'operation', 'source', 'phase', 'name', 'durationMs', 'ts', 'capturedAt'].includes(key))
      .slice(0, 5)
      .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' ');
    return `
      <div class="item"><span>${escapeHtml(label)}</span><b>${escapeHtml(duration)}</b></div>
      ${details ? `<div class="detail">${escapeHtml(details)}</div>` : ''}
    `;
  }).join('');
}

export function renderRuntimeDebuggerEffectProbe({
  title,
  snapshot = {},
  result = null,
  actions = '',
}) {
  const metrics = flattenMetricEntries(snapshot.stats || snapshot.metrics || {});
  return `
    <div class="scope-actions">
      <span class="scope-title">${escapeHtml(title)}</span>
      <div class="scope-action-group">
        ${actions || ''}
        <span class="chip" data-ok="${result?.status === 'measured' ? 'true' : 'false'}">${escapeHtml(getRuntimeDebuggerProbeStateCopy(result?.status))}</span>
      </div>
    </div>
    <div class="grid">
      ${row('활성', snapshot.active === true ? '예' : '아니오')}
      ${row('계측', snapshot.debugEnabled === true ? '켜짐' : '꺼짐')}
      ${snapshot.highlightEnabled !== undefined ? row('하이라이트', snapshot.highlightEnabled ? '켜짐' : '꺼짐') : ''}
      ${row('옵저버', snapshot.observerAttached === true ? '연결' : (snapshot.observerAttached === false ? '해제' : '-'))}
      ${row('작업 변화량', Number.isFinite(Number(result?.operationCount)) ? fmtNum(result.operationCount) : '측정 안 됨')}
      ${row('판정 근거', getRuntimeDebuggerProbeReason(result || {}))}
    </div>
    <div class="sub">누적 계측</div>
    <div class="grid">
      ${metrics.length
    ? metrics.map(([key, value]) => row(key, typeof value === 'number' ? fmtNum(value) : String(value))).join('')
    : row('상태', '계측값 없음')}
    </div>
    <div class="sub">최근 개별 작업</div>
    <div class="list">${renderRecentOperations(snapshot)}</div>
  `;
}

function getSampleTimestamp(sample = {}) {
  return sample.capturedAt || sample.wallTime || sample.ts || null;
}

function summarizeSampleDelta(sample = {}) {
  const entries = flattenMetricEntries(sample.delta || {}).slice(0, 3);
  return entries.length
    ? entries.map(([key, value]) => `${key} +${fmtNum(value)}`).join(' | ')
    : '상태 변화';
}

export function renderRuntimeDebuggerSessionLog(samples = [], errors = [], events = []) {
  const recent = samples.slice(-8).reverse();
  const recentErrors = errors.slice(-6).reverse();
  const recentEvents = Array.isArray(events) ? events.slice(-10).reverse() : [];
  const firstTimestamp = recent.length ? getSampleTimestamp(recent[recent.length - 1]) : null;
  const lastTimestamp = recent.length ? getSampleTimestamp(recent[0]) : null;
  return `
    <div class="grid">
      ${row('변화 샘플', fmtNum(samples.length))}
      ${row('개별 이벤트', fmtNum(events.length))}
      ${row('디버거 오류', fmtNum(errors.length))}
      ${row('구간', firstTimestamp && lastTimestamp ? `${new Date(firstTimestamp).toLocaleTimeString()} - ${new Date(lastTimestamp).toLocaleTimeString()}` : '-')}
    </div>
    <div class="sub">최근 디버거 오류</div>
    <div class="list">
      ${recentErrors.length ? recentErrors.map((entry) => `
        <div class="item"><span>${escapeHtml(`${entry.phase || '-'} ${entry.error || ''}`)}</span><b>${escapeHtml(entry.ts ? new Date(entry.ts).toLocaleTimeString() : '-')}</b></div>
      `).join('') : '<div class="empty">디버거 오류가 없습니다</div>'}
    </div>
    <div class="sub">최근 개별 작업</div>
    <div class="list">
      ${recentEvents.length ? recentEvents.map((entry) => `
        <div class="item"><span>${escapeHtml(`${entry.probeId || '-'} ${entry.type || 'event'}`)}</span><b>${escapeHtml(getSampleTimestamp(entry) ? new Date(getSampleTimestamp(entry)).toLocaleTimeString() : '-')}</b></div>
        ${entry.details ? `<div class="detail">${escapeHtml(JSON.stringify(entry.details))}</div>` : ''}
      `).join('') : '<div class="empty">개별 작업 이벤트가 아직 없습니다.</div>'}
    </div>
    <div class="sub">최근 변화 샘플</div>
    <div class="list">
      ${recent.length ? recent.map((entry) => `
        <div class="item"><span>${escapeHtml(getSampleTimestamp(entry) ? new Date(getSampleTimestamp(entry)).toLocaleTimeString() : '-')}</span><b>${escapeHtml(summarizeSampleDelta(entry))}</b></div>
      `).join('') : '<div class="empty">변화 샘플이 아직 없습니다</div>'}
    </div>
  `;
}

export function renderRuntimeDebuggerCaptureStrip(state = {}) {
  const session = state.sessionView || {};
  const sampleCount = Number(session.sampleCount ?? state.samples?.length) || 0;
  const probeResults = Array.isArray(state.probeResults) ? state.probeResults : [];
  const measuredCount = probeResults.filter((entry) => entry?.status === 'measured').length;
  const brokenCount = probeResults.filter((entry) => entry?.status === 'broken').length;
  const insufficientCount = probeResults.filter((entry) => entry?.status === 'insufficient').length;
  const unavailableCount = probeResults.filter((entry) => entry?.status === 'unavailable').length;
  const idleCount = probeResults.filter((entry) => entry?.status === 'armed_idle').length;
  let validity = '활성 항목 없음';
  if (brokenCount > 0) validity = `계측 오류 ${brokenCount}`;
  else if (measuredCount > 0) validity = `측정 ${measuredCount}${idleCount > 0 ? ` · 대기 ${idleCount}` : ''}`;
  else if (insufficientCount > 0) validity = `표본 부족 ${insufficientCount}`;
  else if (unavailableCount > 0) validity = `사용 불가 ${unavailableCount}`;
  else if (idleCount > 0) validity = `처리 대기 ${idleCount}`;
  const captureKind = getRuntimeDebuggerCaptureKindCopy(session.captureKind);
  return `
    <div class="capture-cell"><span>관측 방식</span><b>${escapeHtml(captureKind)}</b></div>
    <div class="capture-cell"><span>경과</span><b>${escapeHtml(fmtDuration(session.durationMs))}</b></div>
    <div class="capture-cell"><span>샘플 읽기</span><b>${escapeHtml(fmtNum(sampleCount))}</b></div>
    <div class="capture-cell"><span>측정 상태</span><b>${escapeHtml(validity)}</b></div>
  `;
}
