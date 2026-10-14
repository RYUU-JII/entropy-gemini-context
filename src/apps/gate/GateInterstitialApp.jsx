import React, {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Favicon from '../../ui-kit/Favicon.jsx';
import ZenPredatorHorizon, { ZenPredatorIntake } from './ZenPredatorHorizon.jsx';
import useGateTabTransferMotion from './useGateTabTransferMotion.js';
import './gatePredator.css';
import { useGatePruningHint } from './useGatePruningHint.js';
import { createRenderBudget } from '../../platform/rendering/renderBudgetContract.js';
import { runtimeSendMessage } from '../../platform/chrome/ChromeService.js';
import {
  MESSAGE_ACTIONS,
} from '../../platform/messaging/contracts/messageTypes.js';
import {
  SOUND_CUE_IDS,
  SOUND_SCENE_IDS,
  enterAppSoundScene,
  exitAppSoundScene,
  playAppSoundCue,
} from '../../domains/sound/index.js';
import { getRuntimeLanguage } from '../../domains/settings/i18n/runtime.js';
import { I18N_RESOURCES } from '../../i18n/resources.js';
import { getThemeColors } from '../../themes/core/friction/context.js';
import { initializeDocumentThemeForThemeId } from '../../themes/core/documentTheme.js';
import { getArtifactColorTokens } from '../../themes/core/tools/artifactColorSystem.js';
import { buildArtifactRenderContext } from '../../themes/core/tools/artifactRenderContext.js';
import {
  ARTIFACT_ACTIVITY_PHASES,
  ARTIFACT_MOTION_MODES,
  ARTIFACT_RENDER_TIERS,
  ARTIFACT_SIMULATION_MODES,
  resolveArtifactRenderState,
} from '../../themes/core/tools/artifactPresentation.js';
import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  assertCanonicalThemeId,
  canonicalizeThemeIdInput,
} from '../../themes/core/ids.js';
import { getThemeWidget, preloadThemeWidgetChunk } from '../../themes/core/registry/index.js';
import { ZEN_SHISHI_POUR_STRIKE_SEC } from '../../themes/plugins/zen/api/shishiOdoshiMotion.js';
import { ZEN_SHISHI_GROUND_PROJECTION } from '../../themes/plugins/zen/api/shishiOdoshiPresentation.js';
import { useZenGateWait } from './useZenGateWait.js';
import { GATE_SHISHI_WAIT_MS, resolveGateShishiWaitMs } from './gateShishiRitual.js';

const TICK_MS = 100;
const ZEN_STRIKE_AFTERGLOW_MS = 120;
const GATE_INTERSTITIAL_SESSION_STALE = 'GATE_INTERSTITIAL_SESSION_STALE';
const TERMINAL_GATE_DECISION_ERRORS = new Set([
  GATE_INTERSTITIAL_SESSION_STALE,
  'GATE_INTERSTITIAL_SESSION_UNAVAILABLE',
  'GATE_INTERSTITIAL_DECISION_ALREADY_SUBMITTED',
]);
const STALE_DETOUR_TARGET_ERRORS = new Set([
  'TAB_CLOSURE_REFUSED:stale_gate_selection_target',
  'TAB_CLOSURE_REFUSED:gate_selection_target_unavailable',
  'TAB_CLOSURE_REFUSED:gate_selection_target_navigating',
]);
const DECISION_CONTINUE = 'continue';
const DECISION_LEAVE = 'leave';
const DEFAULT_LANGUAGE = 'en';
const GATE_ARTIFACT_WIDGET_TYPE = 'Artifact_Gate';
const ZEN_SHISHI_INTERSTITIAL_RENDERER_ID = 'zen_shishi_odoshi';
const ZEN_GATE_ARTIFACT_COLORS = getArtifactColorTokens(THEME_IDS.ZEN, 'gate');
const GATE_SHISHI_ARTIFACT_ACTIVITY = Object.freeze({
  artifactId: 'gate',
  renderTier: ARTIFACT_RENDER_TIERS.simulation,
  phase: ARTIFACT_ACTIVITY_PHASES.active,
  runtimeState: 'engaged',
  weight: 1,
  configuredActive: true,
  isRuntimeActive: true,
  motionMode: ARTIFACT_MOTION_MODES.full,
  simulationMode: ARTIFACT_SIMULATION_MODES.live,
});
const GATE_SHISHI_ARTIFACT_PRESENTATION = Object.freeze({
  themeId: THEME_IDS.ZEN,
  artifactId: 'gate',
  visualKey: 'gate:zen_shishi_odoshi',
  isVisuallyActive: true,
  shouldRenderEffects: true,
  activity: GATE_SHISHI_ARTIFACT_ACTIVITY,
});
const GATE_SHISHI_RENDER_BUDGET = createRenderBudget({
  policyId: 'gate-shishi-fixed',
  targetFps: 60,
  pixelRatioCap: 2,
  maxRenderPixels: 8_294_400,
});
const GATE_SHISHI_RUNTIME_BUDGET = Object.freeze({
  enabled: true,
  renderBudget: GATE_SHISHI_RENDER_BUDGET,
  particleScale: 1,
  targetFps: GATE_SHISHI_RENDER_BUDGET.targetFps,
  vectorEffectScale: 1,
  allowHeavyEffects: true,
});
const GATE_SHISHI_RENDER_STATE = Object.freeze({
  artifactId: 'gate',
  visualKey: 'gate:zen_shishi_odoshi',
  themeId: THEME_IDS.ZEN,
  motionMode: ARTIFACT_MOTION_MODES.full,
  renderTier: ARTIFACT_RENDER_TIERS.simulation,
  activityPhase: ARTIFACT_ACTIVITY_PHASES.active,
  runtimeBudget: GATE_SHISHI_RUNTIME_BUDGET,
});
const GATE_SHISHI_SOUND_CONTEXT = Object.freeze({
  surface: 'gatekeeper',
  protocolScope: 'gate_shishi_odoshi',
  themeId: 'zen',
});

const COPY = Object.freeze({
  en: Object.freeze({
    loadingEyebrow: 'Preparing threshold',
    loadingTitle: 'Opening gate',
    loadingBody: 'Holding this tab before the page renders.',
    invalidTitle: 'Session unavailable',
    invalidBody: 'No valid gate session was found.',
    staleTitle: 'Moving past gate...',
    staleBody: 'Skipping stale gate history entry.',
    closeTabLabel: 'Close tab',
    continueLabel: 'Continue',
    leaveLabel: 'Go back',
    continuePending: 'Continuing...',
    leavePending: 'Going back...',
    decisionHint: 'Choose the next step deliberately.',
    countdownLabel: 'Settling',
    readyLabel: 'Ready to proceed.',
    telemetryLabel: 'Gate telemetry',
    planLabel: 'Plan level',
    severityLabel: 'Severity',
    hostnameLabel: 'Target',
    secondsSuffix: 's',
    triggersNone: 'None',
    activeGateLabel: 'Active Gate',
    metricsLabel: 'Context',
    holdPrefix: 'Hold for',
    holdReady: 'Ready',
    predatorTitle: 'Branch pruning',
    predatorTutorialSelect: 'Choose tabs to close.',
    predatorTutorialSubmit: 'Prune to close. Tap a fragment to return it.',
    predatorExistingLabel: 'Open tabs',
    predatorRemoveLabel: 'Tabs to close',
    predatorEmptyExisting: 'All protected tabs are selected to close.',
    predatorCurrentLabel: 'This entry',
    predatorSourceLabel: 'Source',
    predatorOpenedOrderLabel: 'Opened',
    predatorMoveToRemoveLabel: 'Move to close list',
    predatorMoveToKeepLabel: 'Return to keep list',
    predatorBudgetLockedLabel: 'Choose tabs to close',
    predatorBudgetReadyLabel: 'Ready',
    predatorSubmitLabel: 'Prune',
    predatorSubmitAccessible: 'Close selected tabs',
    predatorSubmitPending: 'Releasing…',
    predatorSelectionError: 'Could not apply the selected tab cleanup.',
    zenPourLabel: 'Pour water to leave',
    zenDecisionHint: 'Wait here to enter. Pour to close this tab.',
    zenReturnLockHint: (time) => `This site stays closed until ${time}. Pour to close this tab.`,
    decisionFailed: 'The choice could not finish. Try the same choice again.',
    retryLabel: 'Try again',
    isolationEndsAtLabel: 'Ends at',
    zenEnteringLabel: 'Entering…',
    zenOpeningLabel: 'Opening…',
    zenLeavingLabel: 'Leaving…',
    gateKind: Object.freeze({
      entryCheckpoint: 'First Strike',
      returnGuard: 'Return Echo',
      detourSpreadGuard: 'Branch Erasure',
      isolation: 'Isolation',
    }),
    heroTitle: Object.freeze({
      entryCheckpoint: 'Set your mind at the threshold.',
      returnGuard: 'You left this place. It is closed for now.',
      detourSpreadGuard: 'Fold the branching cause.',
      isolation: 'The boundary is closed.',
    }),
    heroBody: Object.freeze({
      entryCheckpoint: 'Is this a needed step, or only a familiar one?',
      returnGuard: 'Leaving was the choice. There is nothing to decide again until the site opens.',
      detourSpreadGuard: 'Protected tabs and recently consumed contexts are branching outward. Fold one branch before opening another.',
      isolation: 'Only sites allowed for this session remain open. This page can return when the isolation timer ends.',
    }),
    actionCopy: Object.freeze({
      default: Object.freeze({
        continueLabel: 'Continue',
        continuePending: 'Continuing...',
        leaveLabel: 'Go back',
        leavePending: 'Going back...',
        decisionHint: 'Choose the next step deliberately.',
      }),
      entryCheckpoint: Object.freeze({
        continueLabel: 'Open site',
        continuePending: 'Entering...',
        leaveLabel: 'Return to stillness',
        leavePending: 'Returning to stillness...',
        decisionHint: 'Choose whether to enter or step back.',
      }),
      returnGuard: Object.freeze({
        continueLabel: 'Return when it opens',
        continuePending: 'Returning...',
        leaveLabel: 'Close this tab',
        leavePending: 'Closing...',
        decisionHint: 'The site stays closed until the timer ends.',
      }),
      detourSpreadGuard: Object.freeze({
        continueLabel: 'Keep this tab',
        continuePending: 'Continuing...',
        leaveLabel: 'Close this tab',
        leavePending: 'Closing tab...',
        decisionHint: 'Choose whether to keep this branch open or trim it here.',
      }),
      isolation: Object.freeze({
        continueLabel: 'Return after isolation',
        continuePending: 'Returning...',
        leaveLabel: 'Close this tab',
        leavePending: 'Closing...',
        decisionHint: 'The boundary remains closed until the timer ends.',
      }),
    }),
    severity: Object.freeze({
      low: 'Low',
      mid: 'Elevated',
      high: 'High',
    }),
    metricSummary: Object.freeze({
      entryCheckpoint: (metrics) => (
        metrics.entryDetected === true
          ? 'A new entry into the protected site was detected.'
          : 'The site is waiting at the threshold.'
      ),
      returnGuard: (metrics, language) => {
        const awayMs = Math.max(0, Date.now() - Math.max(0, Math.floor(Number(metrics.lockLeftAt) || 0)));
        return metrics.lockLeftAt > 0
          ? `Left ${formatDurationShort(awayMs, language)} ago.`
          : 'Left a moment ago.';
      },
      detourSpreadGuard: (metrics) => {
        const tabCount = Math.max(0, Math.floor(Number(metrics.protectedTabCount) || 0));
        const contextCount = Math.max(0, Math.floor(Number(metrics.consumedProtectedContextCount) || 0));
        if (tabCount > 0 && contextCount > 0) {
          return `${tabCount} protected tabs are open, with ${contextCount} contexts recently consumed.`;
        }
        return tabCount > 0
          ? `${tabCount} protected tabs are open.`
          : `${contextCount} protected contexts were recently consumed.`;
      },
      isolation: (_metrics, language) => (
        language === 'ko' ? '허용된 사이트 외의 접근을 막고 있습니다.' : 'Access outside the allowed sites is blocked.'
      ),
    }),
    signalLabels: Object.freeze({
      BUDGET_EXCEEDED: 'Budget exceeded',
      ENTRY_CHECKPOINT_REQUIRED: 'Entry checkpoint required',
      RETURN_GUARD_REQUIRED: 'Returned to a site you left',
      REENTRY_AFTER_BLOCK: 'Re-entry after block',
      DETOUR_SPREAD_DETECTED: 'Tab spread detected',
      ISOLATION_SESSION_ACTIVE: 'Isolation session active',
      PROTECTED_TAB_CLUSTER: 'Protected tab cluster',
      PROTECTED_CONTEXT_CONSUMED: 'Protected contexts consumed',
      CONTEXT_SWITCH_SPIKE: 'Context switching spike',
      SITE_TIME_PRESSURE: 'Site time pressure',
      FEED_FLOW_BREAK: 'Feed flow break',
    }),
  }),
  ko: Object.freeze({
    loadingEyebrow: '문턱을 준비하는 중',
    loadingTitle: '게이트 페이지를 여는 중입니다',
    loadingBody: '웹 페이지가 본격적으로 보이기 전에 이 탭을 잠깐 붙잡고 있습니다.',
    invalidTitle: '세션을 찾을 수 없습니다',
    invalidBody: '유효한 게이트 세션이 없습니다.',
    staleTitle: '돌아가는 중...',
    staleBody: '오래된 게이트 기록을 건너뜁니다.',
    closeTabLabel: '탭 닫기',
    continueLabel: '계속하기',
    leaveLabel: '돌아가기',
    continuePending: '진행 중...',
    leavePending: '돌아가는 중...',
    decisionHint: '지금은 한 번 고르고 움직일 차례입니다.',
    countdownLabel: '가라앉는 시간',
    readyLabel: '이제 고를 수 있습니다.',
    telemetryLabel: '게이트 신호',
    planLabel: '계획 레벨',
    severityLabel: '압력',
    hostnameLabel: '대상',
    secondsSuffix: '초',
    triggersNone: '추가 신호 없음',
    activeGateLabel: '활성 게이트',
    metricsLabel: '현재 문맥',
    holdPrefix: '남은 시간',
    holdReady: '선택 가능',
    predatorTitle: '곁가지 절단',
    predatorTutorialSelect: '닫을 탭을 고르세요.',
    predatorTutorialSubmit: '절단하면 닫힙니다. 조각을 누르면 되돌릴 수 있어요.',
    predatorExistingLabel: '열려 있는 탭',
    predatorRemoveLabel: '닫힐 탭',
    predatorEmptyExisting: '모든 보호 탭이 정리 목록으로 이동했습니다.',
    predatorCurrentLabel: '이번 진입',
    predatorSourceLabel: '부모',
    predatorOpenedOrderLabel: '연 순서',
    predatorMoveToRemoveLabel: '지울 탭으로 이동',
    predatorMoveToKeepLabel: '남길 탭으로 복귀',
    predatorBudgetLockedLabel: '닫을 탭을 고르세요',
    predatorBudgetReadyLabel: '정리 준비 완료',
    predatorSubmitLabel: '절단',
    predatorSubmitAccessible: '선택한 탭 닫기',
    predatorSubmitPending: '공허 속으로…',
    predatorSelectionError: '선택한 탭 정리를 반영하지 못했습니다.',
    zenPourLabel: '물을 부어 나가기',
    zenDecisionHint: '여기서 기다리면 접속합니다. 물을 부으면 이 탭을 닫습니다.',
    zenReturnLockHint: (time) => `떠난 자리는 ${time}까지 닫혀 있습니다. 물을 부으면 이 탭을 닫습니다.`,
    decisionFailed: '선택을 마치지 못했습니다. 같은 선택을 다시 시도하세요.',
    retryLabel: '다시 시도',
    isolationEndsAtLabel: '끝나는 시간',
    zenEnteringLabel: '들어갑니다…',
    zenOpeningLabel: '다시 열립니다…',
    zenLeavingLabel: '나갑니다…',
    gateKind: Object.freeze({
      entryCheckpoint: '첫 울림',
      returnGuard: '되돌림 울림',
      detourSpreadGuard: '분기 소거',
      isolation: '격리',
    }),
    heroTitle: Object.freeze({
      entryCheckpoint: '마음을 고릅니다.',
      returnGuard: '떠난 자리는 잠시 닫혀 있습니다.',
      detourSpreadGuard: '갈라지는 원인을 접습니다.',
      isolation: '경계가 닫혀 있습니다.',
    }),
    heroBody: Object.freeze({
      entryCheckpoint: '이 걸음이 맞는지.',
      returnGuard: '떠나기로 한 선택이 이미 있습니다. 다시 열릴 때까지 새로 고를 것은 없습니다.',
      detourSpreadGuard: '보호 탭과 최근 소비한 보호 문맥이 바깥으로 분기하고 있습니다. 하나를 접고 다음 가지를 여세요.',
      isolation: '이번 세션에서 허용한 사이트만 열립니다. 격리 시간이 끝나면 이 페이지로 돌아갈 수 있습니다.',
    }),
    actionCopy: Object.freeze({
      default: Object.freeze({
        continueLabel: '계속하기',
        continuePending: '진행 중...',
        leaveLabel: '돌아가기',
        leavePending: '돌아가는 중...',
        decisionHint: '지금은 한 번 고르고 움직일 차례입니다.',
      }),
      entryCheckpoint: Object.freeze({
        continueLabel: '접속하기',
        continuePending: '접속하는 중...',
        leaveLabel: '고요함 되찾기',
        leavePending: '고요함을 되찾는 중...',
        decisionHint: '지금 접속할지, 여기서 멈출지 고르세요.',
      }),
      returnGuard: Object.freeze({
        continueLabel: '열리면 돌아가기',
        continuePending: '돌아가는 중...',
        leaveLabel: '이 탭 닫기',
        leavePending: '닫는 중...',
        decisionHint: '시간이 끝날 때까지 이 사이트는 닫혀 있습니다.',
      }),
      detourSpreadGuard: Object.freeze({
        continueLabel: '계속 보기',
        continuePending: '계속 보는 중...',
        leaveLabel: '이 탭 닫기',
        leavePending: '탭을 닫는 중...',
        decisionHint: '더 펼칠지, 여기서 줄일지 고르세요.',
      }),
      isolation: Object.freeze({
        continueLabel: '격리 종료 후 돌아가기',
        continuePending: '돌아가는 중...',
        leaveLabel: '이 탭 닫기',
        leavePending: '닫는 중...',
        decisionHint: '격리 시간이 끝날 때까지 경계가 유지됩니다.',
      }),
    }),
    severity: Object.freeze({
      low: '낮음',
      mid: '주의',
      high: '높음',
    }),
    metricSummary: Object.freeze({
      entryCheckpoint: (metrics) => (
        metrics.entryDetected === true
          ? '새 진입이 감지됐습니다.'
          : '문턱에서 잠시 대기 중입니다.'
      ),
      returnGuard: (metrics, language) => {
        const awayMs = Math.max(0, Date.now() - Math.max(0, Math.floor(Number(metrics.lockLeftAt) || 0)));
        return metrics.lockLeftAt > 0
          ? `${formatDurationShort(awayMs, language)} 전에 떠났습니다.`
          : '방금 떠났습니다.';
      },
      detourSpreadGuard: (metrics) => {
        const tabCount = Math.max(0, Math.floor(Number(metrics.protectedTabCount) || 0));
        const contextCount = Math.max(0, Math.floor(Number(metrics.consumedProtectedContextCount) || 0));
        if (tabCount > 0 && contextCount > 0) {
          return `보호 탭 ${tabCount}개와 최근 소비 문맥 ${contextCount}개가 감지되었습니다.`;
        }
        return tabCount > 0
          ? `보호 탭이 ${tabCount}개 열려 있습니다.`
          : `최근 소비한 보호 문맥이 ${contextCount}개입니다.`;
      },
      isolation: () => '허용된 사이트 외의 접근을 막고 있습니다.',
    }),
    signalLabels: Object.freeze({
      BUDGET_EXCEEDED: '예산 초과',
      ENTRY_CHECKPOINT_REQUIRED: '진입 체크 필요',
      RETURN_GUARD_REQUIRED: '떠난 사이트로 복귀',
      REENTRY_AFTER_BLOCK: '차단 직후 재진입',
      DETOUR_SPREAD_DETECTED: '탭 확산 감지',
      ISOLATION_SESSION_ACTIVE: '격리 세션 활성',
      PROTECTED_TAB_CLUSTER: '보호 탭 군집',
      PROTECTED_CONTEXT_CONSUMED: '보호 문맥 소비',
      CONTEXT_SWITCH_SPIKE: '문맥 전환 급증',
      SITE_TIME_PRESSURE: '사이트 시간 압력',
      FEED_FLOW_BREAK: '피드 흐름 이탈',
    }),
  }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getSessionIdFromLocation() {
  try {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('session') || '').trim();
  } catch (_) {
    return '';
  }
}

function skipStaleGateHistory() {
  if (typeof window === 'undefined') return false;
  // Only the top-level Gate document may skip its own stale history entry.
  if (window.parent !== window) return false;
  try {
    if (window.history?.length > 1) {
      window.history.back();
      return true;
    }
  } catch (_) {
  }
  return false;
}

function getCopy(language) {
  return COPY[language] || COPY[DEFAULT_LANGUAGE];
}

function getDictionary(language) {
  return I18N_RESOURCES[language] || I18N_RESOURCES[DEFAULT_LANGUAGE];
}

function formatDurationShort(ms, language) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  if (totalSeconds < 60) {
    return language === 'ko' ? `${totalSeconds}초` : `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) {
    return language === 'ko' ? `${minutes}분` : `${minutes}m`;
  }

  return language === 'ko'
    ? `${minutes}분 ${seconds}초`
    : `${minutes}m ${seconds}s`;
}

// The boundary reopens at a fixed clock time, not after some duration the
// visitor has to keep re-deriving — a wall clock reading is the honest way to
// say "closed until then" without inviting a countdown to be watched.
// The return lock fills the bamboo from the moment the site was left until it
// opens, so the tube is as full as the lock is spent.
function resolveReturnLockFillWindow(session) {
  const startAt = Number(session.metrics?.lockLeftAt);
  const endAt = Number(session.holdUntil);
  if (!Number.isFinite(startAt) || startAt <= 0 || !Number.isFinite(endAt) || endAt <= startAt) {
    throw new Error('GATE_RETURN_LOCK_FILL_WINDOW_INVALID');
  }
  return { startAt, endAt };
}

function formatClockTime(ms) {
  const date = new Date(Math.max(0, Math.floor(Number(ms) || 0)));
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function resolveGateArtifactCopy(session, language) {
  const dictionary = getDictionary(language);
  const toolsDictionary = dictionary?.tools?.artifacts?.gate;
  const childDictionary = toolsDictionary?.children?.[session?.gateKind];
  const copyVariant = session?.gatekeeperCopyVariant === 'zen' ? 'zen' : 'default';
  const artifactTitle = copyVariant === 'zen'
    ? toolsDictionary?.title_zen || toolsDictionary?.title || 'The Hollow Striker'
    : toolsDictionary?.title || 'Gate';
  const artifactSubtitle = copyVariant === 'zen'
    ? toolsDictionary?.subtitle_zen || toolsDictionary?.subtitle || ''
    : toolsDictionary?.subtitle || '';
  const artifactBody = copyVariant === 'zen'
    ? toolsDictionary?.desc_zen || toolsDictionary?.desc || ''
    : toolsDictionary?.desc || '';

  return {
    artifactTitle,
    artifactSubtitle,
    artifactBody,
    childTitle: childDictionary?.title || '',
    childBody: childDictionary?.desc || '',
  };
}

function resolveGateSessionThemeId(themeId) {
  const canonicalThemeId = canonicalizeThemeIdInput(themeId, '');
  if (canonicalThemeId) return canonicalThemeId;

  const rawThemeId = typeof themeId === 'string' ? themeId.trim() : '';
  if (rawThemeId) {
    return assertCanonicalThemeId(rawThemeId, 'gate interstitial session theme');
  }
  return DEFAULT_THEME_ID;
}

function normalizeGateBootstrapString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readGateBootstrapNumber(searchParams, key, fallback = 0) {
  const rawValue = searchParams.get(key);
  if (rawValue === null) {
    return fallback;
  }
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }
  return Math.floor(numericValue);
}

function readGateBootstrapBoolean(searchParams, key) {
  const value = normalizeGateBootstrapString(searchParams.get(key)).toLowerCase();
  return value === '1' || value === 'true';
}

function normalizeGateSessionForPresentation(nextSession) {
  const themeId = resolveGateSessionThemeId(nextSession?.themeId);
  return {
    ...nextSession,
    themeId,
    gatekeeperStyleVariant: nextSession?.gatekeeperStyleVariant || themeId,
  };
}

function applyGateDocumentPresentation(nextSession, activeGateLabel) {
  const normalizedSession = normalizeGateSessionForPresentation(nextSession);
  initializeDocumentThemeForThemeId(normalizedSession.themeId);
  document.documentElement.dataset.gateStyle = normalizedSession.gatekeeperStyleVariant;
  document.title = `${activeGateLabel} - ${normalizedSession.hostname || 'Entropy'}`;
  return normalizedSession;
}

function resolveGateBootstrapSessionFromLocation() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    const sessionId = normalizeGateBootstrapString(searchParams.get('session'));
    const gatekeeperInterstitialRendererId = normalizeGateBootstrapString(searchParams.get('renderer'));
    if (!sessionId || !gatekeeperInterstitialRendererId) {
      return null;
    }

    const themeId = resolveGateSessionThemeId(searchParams.get('theme'));
    const issuedAt = readGateBootstrapNumber(searchParams, 'issuedAt', Date.now());
    return {
      sessionId,
      gateKind: normalizeGateBootstrapString(searchParams.get('kind')),
      interactionId: '',
      originalUrl: '',
      gatePageUrl: url.toString(),
      hostname: normalizeGateBootstrapString(searchParams.get('host')).toLowerCase(),
      severity: normalizeGateBootstrapString(searchParams.get('severity')).toLowerCase() || 'mid',
      planLevel: Math.max(1, readGateBootstrapNumber(searchParams, 'plan', 1)),
      holdDurationMs: readGateBootstrapNumber(searchParams, 'holdDuration', 0),
      holdUntil: readGateBootstrapNumber(searchParams, 'holdUntil', 0),
      issuedAt,
      activeChildIds: [],
      pressureSignals: [],
      directTriggers: [],
      metrics: {},
      themeId,
      gatekeeperStyleVariant: normalizeGateBootstrapString(searchParams.get('style')) || themeId,
      gatekeeperCopyVariant: normalizeGateBootstrapString(searchParams.get('copy')) || 'default',
      gatekeeperRendererId: '',
      gatekeeperInterstitialRendererId,
      status: 'pending',
      resumeRequestedAt: 0,
      lastUpdatedAt: issuedAt,
    };
  } catch (_) {
    return null;
  }
}

function resolveVisualPalette(session) {
  const themeId = resolveGateSessionThemeId(session?.themeId);
  const themeColors = getThemeColors(themeId);
  const styleVariant = session?.gatekeeperStyleVariant || themeId;

  const paletteByStyle = {
    zen: {
      accent: '#d2b274',
      accentSecondary: '#9dc7b5',
      surface: 'rgba(23, 20, 17, 0.76)',
      surfaceStrong: 'rgba(12, 10, 9, 0.84)',
      shell: '#090807',
      text: '#f6efe0',
      muted: 'rgba(246, 239, 224, 0.72)',
      ring: 'rgba(210, 178, 116, 0.34)',
    },
    entropy: {
      accent: '#f97316',
      accentSecondary: '#fb7185',
      surface: 'rgba(22, 18, 16, 0.82)',
      surfaceStrong: 'rgba(11, 9, 8, 0.88)',
      shell: '#090607',
      text: '#fff5ee',
      muted: 'rgba(255, 245, 238, 0.74)',
      ring: 'rgba(249, 115, 22, 0.32)',
    },
    cyberpunk: {
      accent: '#2dd4bf',
      accentSecondary: '#f472b6',
      surface: 'rgba(14, 11, 22, 0.82)',
      surfaceStrong: 'rgba(6, 4, 15, 0.88)',
      shell: '#05040b',
      text: '#effcff',
      muted: 'rgba(239, 252, 255, 0.72)',
      ring: 'rgba(45, 212, 191, 0.34)',
    },
    matrix: {
      accent: '#4ade80',
      accentSecondary: '#22c55e',
      surface: 'rgba(10, 18, 11, 0.82)',
      surfaceStrong: 'rgba(4, 10, 6, 0.88)',
      shell: '#020805',
      text: '#ebfff2',
      muted: 'rgba(235, 255, 242, 0.72)',
      ring: 'rgba(74, 222, 128, 0.32)',
    },
    clinical: {
      accent: '#38bdf8',
      accentSecondary: '#8b5cf6',
      surface: 'rgba(18, 27, 35, 0.8)',
      surfaceStrong: 'rgba(8, 14, 20, 0.88)',
      shell: '#061018',
      text: '#f4fbff',
      muted: 'rgba(244, 251, 255, 0.74)',
      ring: 'rgba(56, 189, 248, 0.28)',
    },
    scp: {
      accent: '#f59e0b',
      accentSecondary: '#ef4444',
      surface: 'rgba(25, 18, 15, 0.82)',
      surfaceStrong: 'rgba(13, 9, 8, 0.88)',
      shell: '#0a0807',
      text: '#fdf3ea',
      muted: 'rgba(253, 243, 234, 0.74)',
      ring: 'rgba(245, 158, 11, 0.3)',
    },
  };

  const palette = paletteByStyle[styleVariant] || paletteByStyle[themeId] || paletteByStyle.zen;
  return {
    ...palette,
    accent: themeColors.accent || palette.accent,
    accentSecondary: themeColors.accentSecondary || palette.accentSecondary,
    text: themeColors.text || palette.text,
    shell: themeColors.background || palette.shell,
    styleVariant,
    themeId,
  };
}

function isZenShishiGateSession(session, palette = null) {
  // The spread guard renders the predator surface and returns before the garden
  // branch is ever reached, so none of the shishi machinery belongs to it.
  if (session?.gateKind === 'detourSpreadGuard') return false;
  const styleVariant = palette?.styleVariant
    || session?.gatekeeperStyleVariant
    || resolveGateSessionThemeId(session?.themeId);
  return styleVariant === 'zen'
    && session?.gatekeeperCopyVariant === 'zen'
    && session?.gatekeeperInterstitialRendererId === ZEN_SHISHI_INTERSTITIAL_RENDERER_ID;
}

function preloadGateBootstrapWidget(session) {
  if (!isZenShishiGateSession(session)) {
    return;
  }

  void preloadThemeWidgetChunk('zen', GATE_ARTIFACT_WIDGET_TYPE)
    .catch((error) => {
      console.warn('[GateInterstitialApp] Hollow Striker widget preload failed:', error?.message || error);
    });
}

const INITIAL_GATE_BOOTSTRAP_SESSION = resolveGateBootstrapSessionFromLocation();
preloadGateBootstrapWidget(INITIAL_GATE_BOOTSTRAP_SESSION);

function buildGateShishiArtifactRuntime(color, { active = true } = {}) {
  const artifactActivity = active
    ? GATE_SHISHI_ARTIFACT_ACTIVITY
    : Object.freeze({
      ...GATE_SHISHI_ARTIFACT_ACTIVITY,
      phase: ARTIFACT_ACTIVITY_PHASES.parked,
      runtimeState: 'resting',
      configuredActive: false,
      isRuntimeActive: false,
      motionMode: ARTIFACT_MOTION_MODES.none,
      simulationMode: ARTIFACT_SIMULATION_MODES.halt,
      shouldRenderEffects: false,
      isInteractive: false,
    });
  const artifactPresentation = active
    ? GATE_SHISHI_ARTIFACT_PRESENTATION
    : Object.freeze({
      ...GATE_SHISHI_ARTIFACT_PRESENTATION,
      activity: artifactActivity,
    });
  const renderState = resolveArtifactRenderState({
    artifactActivity,
    artifactPresentation,
    isActive: active,
    visualActivityWeight: 1,
    shouldAnimate: true,
  });
  const baseContext = buildArtifactRenderContext({
    artifactActivity,
    artifactPresentation,
    artifactRenderState: renderState,
    activityWeight: renderState.visualWeight,
    colorTokens: ZEN_GATE_ARTIFACT_COLORS,
    color,
    groundProjection: ZEN_SHISHI_GROUND_PROJECTION,
    mode: 'gate-interstitial',
    systemMode: 'zen',
    visualKey: 'gate',
  });
  const renderContext = Object.freeze({
    ...baseContext,
    motion: Object.freeze({
      ...baseContext.motion,
      runtime: GATE_SHISHI_RUNTIME_BUDGET,
    }),
  });

  return Object.freeze({ renderContext, renderState });
}

function resolveSignalChips(session, language) {
  const copy = getCopy(language);
  const combinedSignals = [
    ...(Array.isArray(session?.directTriggers) ? session.directTriggers : []),
    ...(Array.isArray(session?.pressureSignals) ? session.pressureSignals : []),
  ];
  const uniqueSignals = [...new Set(combinedSignals.filter(Boolean))].slice(0, 5);
  if (uniqueSignals.length === 0) {
    return [copy.triggersNone];
  }

  return uniqueSignals.map((signal) => copy.signalLabels[signal] || signal.replaceAll('_', ' '));
}

function resolveContextStats(session, language) {
  const copy = getCopy(language);
  const metrics = session?.metrics && typeof session.metrics === 'object' ? session.metrics : {};
  const items = [];

  if (session?.gateKind === 'returnGuard') {
    const lockUntil = Math.max(0, Math.floor(Number(metrics.lockUntil) || 0));
    if (lockUntil > 0) {
      items.push(language === 'ko'
        ? `${formatClockTime(lockUntil)}에 열림`
        : `Opens at ${formatClockTime(lockUntil)}`);
    }
  }

  if (session?.gateKind === 'detourSpreadGuard') {
    const protectedTabCount = Math.max(0, Math.floor(Number(metrics.protectedTabCount) || 0));
    const protectedTabHostCount = Math.max(0, Math.floor(Number(metrics.protectedTabHostCount) || 0));
    const consumedContextCount = Math.max(0, Math.floor(Number(metrics.consumedProtectedContextCount) || 0));
    const switchCount = Math.max(0, Math.floor(Number(metrics.contextSwitchCount) || 0));
    if (protectedTabCount > 0) {
      items.push(language === 'ko' ? `보호 탭 ${protectedTabCount}개` : `${protectedTabCount} protected tabs`);
    }
    if (protectedTabHostCount > 1) {
      items.push(language === 'ko' ? `보호 사이트 ${protectedTabHostCount}곳` : `${protectedTabHostCount} protected sites`);
    }
    if (consumedContextCount > 0) {
      items.push(language === 'ko' ? `소비 문맥 ${consumedContextCount}개` : `${consumedContextCount} consumed contexts`);
    }
    if (switchCount > 0) {
      items.push(language === 'ko' ? `전환 ${switchCount}회` : `${switchCount} context switches`);
    }
  }

  if (session?.gateKind === 'entryCheckpoint' && metrics.entryPassActive === true) {
    items.push(language === 'ko' ? '이전 통과 창 활성' : 'Previous pass window active');
  }

  return items.slice(0, 4);
}

function normalizeGateTabForView(entry = null) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const tabId = Number(source.tabId);
  const hostname = typeof source.hostname === 'string' ? source.hostname.trim().toLowerCase() : '';
  const url = typeof source.url === 'string' ? source.url.trim() : '';
  if (!Number.isInteger(tabId) || tabId < 0 || !hostname || !url) return null;
  const tab = {
    tabId,
    hostname,
    url,
    title: typeof source.title === 'string' ? source.title.trim() : '',
    favIconUrl: typeof source.favIconUrl === 'string' ? source.favIconUrl.trim() : '',
    active: source.active === true,
  };
  if (Number.isInteger(Number(source.windowId)) && Number(source.windowId) >= 0) {
    tab.windowId = Number(source.windowId);
  }
  if (Number.isInteger(Number(source.index)) && Number(source.index) >= 0) {
    tab.index = Number(source.index);
  }
  if (Number.isInteger(Number(source.openerTabId)) && Number(source.openerTabId) >= 0) {
    tab.openerTabId = Number(source.openerTabId);
  }
  return tab;
}

function compareGateTabPlacement(left, right) {
  return (
    (left.windowId ?? Number.MAX_SAFE_INTEGER) - (right.windowId ?? Number.MAX_SAFE_INTEGER)
    || (left.index ?? Number.MAX_SAFE_INTEGER) - (right.index ?? Number.MAX_SAFE_INTEGER)
    || left.tabId - right.tabId
  );
}

function resolveDetourSpreadBudgetState(session) {
  const protectedTabs = (Array.isArray(session?.protectedTabs) ? session.protectedTabs : [])
    .map((entry) => normalizeGateTabForView(entry))
    .filter(Boolean);
  const sessionTabId = Number(session?.tabId);
  const currentTab = protectedTabs.find((entry) => entry.tabId === sessionTabId)
    || normalizeGateTabForView({
      tabId: sessionTabId,
      hostname: session?.hostname,
      url: session?.originalUrl,
      title: session?.hostname,
      favIconUrl: '',
      active: true,
    });
  const unsortedTabs = currentTab && !protectedTabs.some((entry) => entry.tabId === sessionTabId)
    ? [...protectedTabs, currentTab]
    : protectedTabs;
  const sourceTabId = Number.isInteger(currentTab?.openerTabId)
    ? currentTab.openerTabId
    : sessionTabId;
  const sourceTab = unsortedTabs.find((entry) => entry.tabId === sourceTabId) || null;
  const sourceWindowId = sourceTab?.windowId ?? currentTab?.windowId ?? null;
  const resolveGroup = (tab) => {
    if (tab.tabId === sourceTabId) return 0;
    if (tab.openerTabId === sourceTabId) return 1;
    if (sourceWindowId !== null && tab.windowId === sourceWindowId) return 2;
    return 3;
  };
  const sortedTabs = [...unsortedTabs].sort((left, right) => (
    resolveGroup(left) - resolveGroup(right)
    || compareGateTabPlacement(left, right)
  ));
  let openedOrder = 0;
  const allTabs = sortedTabs.map((tab) => {
    const isOpenedFromSource = tab.openerTabId === sourceTabId;
    if (isOpenedFromSource) openedOrder += 1;
    return {
      ...tab,
      isSource: tab.tabId === sourceTabId,
      openedOrder: isOpenedFromSource ? openedOrder : 0,
    };
  });
  const protectedTabThreshold = Math.max(
    0,
    Math.floor(Number(session?.metrics?.protectedTabThreshold) || 0),
  );
  if (protectedTabThreshold < 1) return null;
  const protectedTabBudget = protectedTabThreshold - 1;
  return {
    protectedTabBudget,
    allTabs,
  };
}

function GateTabChip({
  tab,
  current = false,
  pending = false,
  selected = false,
  currentLabel = '',
  sourceLabel = '',
  openedOrderLabel = '',
  actionLabel = '',
  elementRef = null,
  onToggle,
}) {
  const displayLabel = tab?.title || tab?.hostname || '';
  const fallbackLetter = (tab?.hostname || '?').slice(0, 1).toUpperCase();
  return (
    <button
      ref={elementRef}
      type="button"
      className="gate-tab-chip"
      data-current={current ? '1' : '0'}
      data-selected={selected ? '1' : '0'}
      data-source={tab?.isSource ? '1' : '0'}
      aria-label={`${actionLabel}: ${displayLabel}`}
      title={`${actionLabel}: ${displayLabel}`}
      disabled={pending}
      onClick={onToggle}
    >
      <div className="gate-tab-chip__media">
        <span className="gate-tab-chip__favicon" aria-hidden="true">
          <Favicon
            className="gate-tab-chip__favicon-source"
            domain={tab?.hostname}
            fallbackLabel={fallbackLetter}
            imgClassName="gate-tab-chip__favicon-image"
            pageUrl={tab?.url}
            size={36}
            style={{ backgroundColor: 'transparent' }}
          />
        </span>
      </div>

      <div className="gate-tab-chip__body">
        <div className="gate-tab-chip__meta">
          <span className="gate-tab-chip__host">{tab?.hostname}</span>
          {tab?.isSource || current || tab?.openedOrder > 0 ? (
            <span className="gate-tab-chip__badges">
              {tab?.isSource ? <span className="gate-badge gate-badge--source">{sourceLabel}</span> : null}
              {!tab?.isSource && current ? <span className="gate-badge gate-badge--current">{currentLabel}</span> : null}
              {tab?.openedOrder > 0 ? <span className="gate-badge gate-badge--order">{openedOrderLabel} #{tab.openedOrder}</span> : null}
            </span>
          ) : null}
        </div>
        <span className="gate-tab-chip__title" title={displayLabel}>
          {displayLabel}
        </span>
      </div>

      <span className="gate-tab-chip__action-indicator" aria-hidden="true">
        {selected ? '↩' : '↗'}
      </span>
    </button>
  );
}

// Fragments sit just outside the illuminated boundary, within the visible arc.
const ORBIT_ARC_START_DEG = 145;
const ORBIT_ARC_END_DEG = 215;

/*
 * How long the horizon takes to close, and how long the surface is therefore
 * held before handing over to the leaving shell. The work itself is already
 * done by then — the decision message went out the moment the button was
 * pressed and the background acts on it immediately — so this delays nothing
 * but the swap of one view for another. Without the hold the sequence never
 * plays at all: `phase = 'leaving'` replaces the whole scene with a status
 * card on the same tick the response lands.
 */
const PREDATOR_CLOSURE_MS = 1600;

function prefersReducedMotionNow() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Measured from the button press, not from the response, so a slow round trip
// eats into the hold instead of being added to it.
function waitForPredatorClosure(startedAt) {
  if (prefersReducedMotionNow()) {
    return Promise.resolve();
  }
  const remaining = PREDATOR_CLOSURE_MS - (Date.now() - startedAt);
  if (!(remaining > 0)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}

// Stable per-tab offset so a cluster never lands on an even clock face.
function orbitSeatJitterDeg(tabId, stepDeg) {
  const scrambled = (Math.imul(Number(tabId) | 0, 2654435761) >>> 0) / 4294967295;
  return (scrambled - 0.5) * Math.min(stepDeg * 0.55, 9);
}

function resolveOrbitSeat(seatIndex, seatCount, tabId) {
  const span = ORBIT_ARC_END_DEG - ORBIT_ARC_START_DEG;
  const stepDeg = seatCount > 1 ? span / (seatCount - 1) : 0;
  const baseDeg = seatCount > 1
    ? ORBIT_ARC_START_DEG + stepDeg * seatIndex
    : (ORBIT_ARC_START_DEG + ORBIT_ARC_END_DEG) / 2;
  const seatDeg = baseDeg + orbitSeatJitterDeg(tabId, stepDeg);
  const radians = (seatDeg * Math.PI) / 180;
  // A narrow scene exposes the lower-left arc above the tab list.
  const narrowBaseDeg = seatCount > 1 ? 145 + (55 * seatIndex) / (seatCount - 1) : 172.5;
  const narrowRadians = ((narrowBaseDeg + orbitSeatJitterDeg(tabId, stepDeg)) * Math.PI) / 180;
  return {
    '--orbit-u': Math.cos(radians).toFixed(4),
    '--orbit-v': Math.sin(radians).toFixed(4),
    '--orbit-narrow-u': Math.cos(narrowRadians).toFixed(4),
    '--orbit-narrow-v': Math.sin(narrowRadians).toFixed(4),
    '--intake-angle': `${seatDeg}deg`,
    '--intake-narrow-angle': `${narrowBaseDeg + orbitSeatJitterDeg(tabId, stepDeg)}deg`,
    // Bounded stagger keeps every fragment inside the presentation hold.
    '--orbit-delay': `${Math.min(seatIndex, 8) * 20}ms`,
    '--orbit-drift-delay': `${-seatIndex * 1.7}s`,
  };
}

function GateOrbitOrb({
  tab,
  pending = false,
  actionLabel = '',
  elementRef = null,
  seatStyle = null,
  onToggle,
}) {
  const displayLabel = tab?.title || tab?.hostname || '';
  const fallbackLetter = (tab?.hostname || '?').slice(0, 1).toUpperCase();
  return (
    <button
      ref={elementRef}
      type="button"
      className="gate-orbit-orb"
      aria-label={`${actionLabel}: ${displayLabel}`}
      title={`${actionLabel}: ${displayLabel}`}
      disabled={pending}
      style={seatStyle}
      onClick={onToggle}
    >
      <span className="gate-orbit-orb__fragment">
      <span className="gate-orbit-orb__core" aria-hidden="true">
        <Favicon
          className="gate-orbit-orb__favicon-source"
          domain={tab?.hostname}
          fallbackLabel={fallbackLetter}
          imgClassName="gate-orbit-orb__favicon-image"
          pageUrl={tab?.url}
          size={28}
          style={{ backgroundColor: 'transparent' }}
        />
      </span>
      <span className="gate-orbit-orb__return-badge" aria-hidden="true">↩</span>
      <span className="gate-orbit-orb__tooltip" aria-hidden="true">
        <span className="gate-orbit-orb__tooltip-host">{tab?.hostname}</span>
        <span className="gate-orbit-orb__tooltip-title">{displayLabel}</span>
      </span>
      </span>
    </button>
  );
}

export function GateDetourSpreadSurface({
  language = DEFAULT_LANGUAGE,
  pendingDecision = '',
  progress = 0,
  selectedTabIdsToClose = [],
  session,
  tabSelectionError = '',
  onSubmit,
  onToggleTab,
}) {
  const {
    prepareTransfer,
    registerTabNode,
    transferLayerRef,
  } = useGateTabTransferMotion(selectedTabIdsToClose, Boolean(pendingDecision));
  const detourBudgetState = resolveDetourSpreadBudgetState(session);
  if (!detourBudgetState) {
    const error = new Error('GATE_DETOUR_SPREAD_BUDGET_STATE_INVALID');
    error.code = 'GATE_DETOUR_SPREAD_BUDGET_STATE_INVALID';
    throw error;
  }
  if (!Array.isArray(selectedTabIdsToClose)) {
    const error = new Error('GATE_DETOUR_SPREAD_SELECTION_INVALID');
    error.code = 'GATE_DETOUR_SPREAD_SELECTION_INVALID';
    throw error;
  }
  if (typeof onSubmit !== 'function' || typeof onToggleTab !== 'function') {
    const error = new Error('GATE_DETOUR_SPREAD_ACTIONS_INVALID');
    error.code = 'GATE_DETOUR_SPREAD_ACTIONS_INVALID';
    throw error;
  }

  const availableTabIdSet = useMemo(
    () => new Set(detourBudgetState.allTabs.map((tab) => tab.tabId)),
    [detourBudgetState.allTabs],
  );
  const selectedTabIdSet = useMemo(
    () => new Set(selectedTabIdsToClose.filter((tabId) => availableTabIdSet.has(tabId))),
    [availableTabIdSet, selectedTabIdsToClose],
  );
  const keptTabs = useMemo(
    () => detourBudgetState.allTabs.filter((tab) => !selectedTabIdSet.has(tab.tabId)),
    [detourBudgetState.allTabs, selectedTabIdSet],
  );
  const tabsToClose = useMemo(
    () => detourBudgetState.allTabs.filter((tab) => selectedTabIdSet.has(tab.tabId)),
    [detourBudgetState.allTabs, selectedTabIdSet],
  );
  const remainingOverBudgetBy = Math.max(
    0,
    keptTabs.length - detourBudgetState.protectedTabBudget,
  );
  // Capture order is presentation state; tab closure remains background-owned.
  const capturedTabsInOrder = useMemo(() => {
    const tabsById = new Map(detourBudgetState.allTabs.map((tab) => [tab.tabId, tab]));
    return selectedTabIdsToClose
      .filter((tabId) => availableTabIdSet.has(tabId))
      .map((tabId) => tabsById.get(tabId))
      .filter(Boolean);
  }, [availableTabIdSet, detourBudgetState.allTabs, selectedTabIdsToClose]);
  const orbitSeatCount = capturedTabsInOrder.length + remainingOverBudgetBy;
  const orbitSeatStyles = useMemo(() => capturedTabsInOrder.map((tab, seatIndex) => (
    resolveOrbitSeat(seatIndex, orbitSeatCount, tab.tabId)
  )), [capturedTabsInOrder, orbitSeatCount]);
  const selectionReady = tabsToClose.length > 0 && remainingOverBudgetBy === 0;
  const selectionPending = Boolean(pendingDecision);
  const idleHint = useGatePruningHint(selectedTabIdsToClose.join(','), selectionReady, selectionPending);
  // Bootstrap carries no experience claim. The authorized background query
  // supplies a boolean before first-use guidance is shown.
  const showTutorial = session.pruningTutorialCompleted === false && !selectionPending;
  const predatorStatus = `${keptTabs.length}/${detourBudgetState.protectedTabBudget}`;

  const copy = getCopy(language);
  const palette = resolveVisualPalette(session);

  return (
    <div
      className="gate-page gate-page--predator"
      data-gate-style={palette.styleVariant}
      data-theme-id={palette.themeId}
      data-gate-kind={session.gateKind}
      data-presentation="blocking"
      data-ready={selectionReady ? '1' : '0'}
      data-pending={selectionPending ? '1' : '0'}
      data-idle-hint={idleHint ? '1' : '0'}
      style={{
        '--gate-accent': palette.accent,
        '--gate-accent-secondary': palette.accentSecondary,
        '--gate-surface': palette.surface,
        '--gate-surface-strong': palette.surfaceStrong,
        '--gate-shell': '#020202',
        '--gate-text': palette.text,
        '--gate-muted': palette.muted,
        '--gate-ring': palette.ring,
        '--gate-progress': `${progress}`,
      }}
    >
      <main className="gate-predator-stage">
        <header className="zen-predator-heading">
          <h1 id="gate-predator-title">{copy.predatorTitle}</h1>
        </header>

        <section className="gate-predator-monolith" aria-label={copy.predatorExistingLabel}>
          <div className="gate-predator-monolith__header">
            <div className="gate-predator-monolith__tag-group">
              <span className="gate-predator-monolith__title">{copy.predatorExistingLabel}</span>
            </div>
            <strong
              className="gate-predator-monolith__quota"
              data-over={remainingOverBudgetBy > 0 ? '1' : '0'}
              aria-label={predatorStatus}
            >
              <span className="gate-predator-monolith__quota-count" aria-hidden="true">
                {keptTabs.length}
              </span>
              <span className="gate-predator-monolith__quota-budget" aria-hidden="true">
                /{detourBudgetState.protectedTabBudget}
              </span>
            </strong>
          </div>

          <div className="gate-predator-monolith__list">
            {keptTabs.length > 0 ? keptTabs.map((tab) => (
              <GateTabChip
                key={tab.tabId}
                tab={tab}
                current={tab.tabId === Number(session.tabId)}
                currentLabel={copy.predatorCurrentLabel}
                sourceLabel={copy.predatorSourceLabel}
                openedOrderLabel={copy.predatorOpenedOrderLabel}
                actionLabel={copy.predatorMoveToRemoveLabel}
                elementRef={(node) => registerTabNode(tab.tabId, node)}
                pending={selectionPending}
                onToggle={() => { prepareTransfer(tab.tabId); onToggleTab(tab.tabId); }}
              />
            )) : (
              <p className="gate-predator-monolith__empty">{copy.predatorEmptyExisting}</p>
            )}
          </div>

          <div className="gate-predator-monolith__console">
            <div
              className="gate-predator-monolith__status"
              data-ready={selectionReady ? '1' : '0'}
              data-required={remainingOverBudgetBy}
              role="status"
              aria-live="polite"
              aria-label={selectionReady
                ? copy.predatorBudgetReadyLabel
                : `${copy.predatorBudgetLockedLabel}: ${remainingOverBudgetBy}`}
            >
              <span className="gate-predator-monolith__status-dot" aria-hidden="true" />
              <span className="gate-predator-monolith__status-text">
                {showTutorial && !selectionReady ? (
                  <><span className="zen-pruning-guide__step">01 / 02</span>{copy.predatorTutorialSelect}</>
                ) : !selectionReady ? `${copy.predatorBudgetLockedLabel} · ${remainingOverBudgetBy}` : null}
              </span>
            </div>
          </div>
        </section>

        <section
          className="gate-predator-colossus"
          data-collapsing={selectionPending ? '1' : '0'}
          aria-label={`${copy.predatorRemoveLabel}: ${tabsToClose.length}`}
        >
          <ZenPredatorHorizon seatStyles={orbitSeatStyles} />
          <span className="gate-predator-colossus__ember" aria-hidden="true">
            <span key={selectedTabIdsToClose.join(',')} className="zen-predator-core" />
          </span>
          <span className="zen-predator-afterimage" aria-hidden="true" />
          <div className="zen-predator-intake-field" aria-hidden="true">
            {capturedTabsInOrder.map((tab, seatIndex) => (
              <ZenPredatorIntake key={tab.tabId} seatStyle={orbitSeatStyles[seatIndex]} />
            ))}
          </div>
          <div className="gate-predator-orbit-field">
            <div className="gate-predator-orbit-field__cluster">
              {capturedTabsInOrder.map((tab, seatIndex) => (
                <GateOrbitOrb
                  key={tab.tabId}
                  tab={tab}
                  actionLabel={copy.predatorMoveToKeepLabel}
                  elementRef={(node) => registerTabNode(tab.tabId, node)}
                  pending={selectionPending}
                  seatStyle={orbitSeatStyles[seatIndex]}
                  onToggle={() => { prepareTransfer(tab.tabId); onToggleTab(tab.tabId); }}
                />
              ))}
            </div>
          </div>
          <div className="zen-pruning-action">
            <button
              type="button"
              className="zen-pruning-action__button"
              onClick={onSubmit}
              disabled={!selectionReady || selectionPending}
              aria-label={`${copy.predatorSubmitAccessible}: ${tabsToClose.length}`}
              aria-describedby={showTutorial && selectionReady ? 'zen-pruning-guide' : undefined}
            >
              <span className="zen-pruning-action__mark" aria-hidden="true" />
              <span>{selectionPending ? copy.predatorSubmitPending : copy.predatorSubmitLabel}</span>
              <span className="zen-pruning-action__count" aria-hidden="true">{String(tabsToClose.length).padStart(2, '0')}</span>
            </button>
            {showTutorial && selectionReady ? (
              <p id="zen-pruning-guide" className="zen-pruning-guide" role="status">
                <span className="zen-pruning-guide__step">02 / 02</span>{copy.predatorTutorialSubmit}
              </p>
            ) : null}
            {tabSelectionError ? <p className="gate-predator-rail__error" role="alert">{tabSelectionError}</p> : null}
          </div>
        </section>

        {/* Transfer Motion Layer */}
        <div
          ref={transferLayerRef}
          className="gate-predator-transfer-layer"
          aria-hidden="true"
        />
      </main>
    </div>
  );
}

// A torii strung with shimenawa: a declarative boundary marker, not a device
// to operate. Isolation offers no decision — there is nothing to hold, no
// strike to wait for, only the closed threshold and the clock time it reopens
// at. The shishi-odoshi ritual's "dry" variant tried to say this by omission
// (see gateShishiRitual.js) and needed the reader to already know the object
// well enough to read absence as meaning; this says it directly instead.
export function GateIsolationBoundarySurface({
  language = DEFAULT_LANGUAGE,
  onClose,
  pendingDecision = '',
  decisionFailed = false,
  session,
}) {
  const copy = getCopy(language);
  const palette = resolveVisualPalette(session);
  const actionCopy = copy.actionCopy.isolation || copy.actionCopy.default;
  const isClosing = pendingDecision === DECISION_LEAVE;
  const endsAtTime = formatClockTime(session.holdUntil);

  return (
    <div
      className="gate-page gate-torii"
      data-gate-style={palette.styleVariant}
      data-theme-id={palette.themeId}
      data-gate-kind={session.gateKind}
      style={{
        '--gate-accent': palette.accent,
        '--gate-shell': palette.shell,
        '--gate-text': palette.text,
        '--gate-muted': palette.muted,
      }}
    >
      <div className="gate-torii__ground" aria-hidden="true" />

      <main className="gate-torii__field">
        <div className="gate-torii__structure" aria-hidden="true">
          <span className="gate-torii__pillar gate-torii__pillar--left" />
          <span className="gate-torii__pillar gate-torii__pillar--right" />
          <span className="gate-torii__nuki" />
          <span className="gate-torii__kasagi" />
          <span className="gate-torii__shimenawa" />
          <span className="gate-torii__shide gate-torii__shide--1" />
          <span className="gate-torii__shide gate-torii__shide--2" />
          <span className="gate-torii__shide gate-torii__shide--3" />
          <span className="gate-torii__plaque">
            <span className="gate-torii__plaque-label">{copy.isolationEndsAtLabel}</span>
            <span className="gate-torii__plaque-time">{endsAtTime}</span>
          </span>
        </div>

        <div className="gate-torii__inscription">
          <p className="gate-torii__host">{session.hostname}</p>
          <h1 className="gate-torii__line">{copy.heroTitle.isolation}</h1>
          <p className="gate-torii__instruction">{copy.heroBody.isolation}</p>

          <button
            type="button"
            className="gate-button gate-torii__close"
            disabled={isClosing}
            onClick={onClose}
          >
            {isClosing ? actionCopy.leavePending : decisionFailed ? copy.retryLabel : actionCopy.leaveLabel}
          </button>
          {decisionFailed ? <p className="gate-decision-error" role="alert">{copy.decisionFailed}</p> : null}
        </div>
      </main>
    </div>
  );
}

function resolveHeroText(session, language) {
  const copy = getCopy(language);
  const artifactCopy = resolveGateArtifactCopy(session, language);
  const heroTitle = copy.heroTitle[session?.gateKind] || artifactCopy.childTitle || artifactCopy.artifactTitle;
  const heroBody = artifactCopy.childBody || copy.heroBody[session?.gateKind] || artifactCopy.artifactBody;
  const gateLabel = copy.gateKind[session?.gateKind] || session?.gateKind || '';
  return {
    eyebrow: artifactCopy.artifactTitle,
    subtitle: artifactCopy.artifactSubtitle,
    gateLabel,
    heroTitle,
    heroBody,
  };
}

function resolveActionCopy(session, language) {
  const copy = getCopy(language);
  const actionCopy = copy.actionCopy?.[session?.gateKind] || copy.actionCopy?.default || {};

  return {
    continueLabel: actionCopy.continueLabel || copy.continueLabel,
    continuePending: actionCopy.continuePending || copy.continuePending,
    leaveLabel: actionCopy.leaveLabel || copy.leaveLabel,
    leavePending: actionCopy.leavePending || copy.leavePending,
    decisionHint: actionCopy.decisionHint || copy.decisionHint,
  };
}

function GateStatusShell({
  eyebrow,
  title,
  body,
  loading = false,
  actionLabel = '',
  onAction = null,
}) {
  return (
    <div className="gate-page gate-page--status">
      <div className="gate-status-card">
        <p className="gate-status-card__eyebrow">{eyebrow}</p>
        <h1 className="gate-status-card__title">{title}</h1>
        <p className="gate-status-card__body">{body}</p>
        {loading ? <div className="gate-status-card__pulse" aria-hidden="true" /> : null}
        {actionLabel && typeof onAction === 'function' ? (
          <div className="gate-status-card__actions" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="gate-button gate-button--primary"
              onClick={onAction}
            >
              <span className="gate-button__content">
                <span className="gate-button__label">{actionLabel}</span>
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GateBootShell() {
  return (
    <div className="gate-page gate-page--boot" aria-hidden="true">
      <div className="gate-page__backdrop">
        <div className="gate-page__mist gate-page__mist--a" />
      </div>
    </div>
  );
}

export default function GateInterstitialApp() {
  const [language] = useState(() => getRuntimeLanguage() || DEFAULT_LANGUAGE);
  const [bootstrapSession] = useState(() => INITIAL_GATE_BOOTSTRAP_SESSION);
  const [sessionId] = useState(() => bootstrapSession?.sessionId || getSessionIdFromLocation());
  const [session, setSession] = useState(() => bootstrapSession);
  const [phase, setPhase] = useState(() => (bootstrapSession ? 'ready' : 'loading'));
  const [error, setError] = useState('');
  const [isSessionAuthorized, setIsSessionAuthorized] = useState(false);
  const [pendingDecision, setPendingDecision] = useState('');
  const [failedDecision, setFailedDecision] = useState('');
  const [selectedTabIdsToClose, setSelectedTabIdsToClose] = useState([]);
  const [tabSelectionError, setTabSelectionError] = useState('');
  const [sessionRefreshError, setSessionRefreshError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [shishiResetToken, setShishiResetToken] = useState(0);
  const [shishiPourStartedAtMs, setShishiPourStartedAtMs] = useState(null);
  const [shishiPourDecision, setShishiPourDecision] = useState(DECISION_LEAVE);
  const isDecisionAfterglow = shishiPourStartedAtMs !== null;
  const documentEpochRef = useRef(0);
  const shishiDecisionTimerRef = useRef([]);
  const decisionInFlightRef = useRef(false);
  const shishiLeaveChosenRef = useRef(false);
  const cancelShishiDecisionTimer = useCallback(() => {
    shishiDecisionTimerRef.current.forEach((timer) => window.clearTimeout(timer));
    shishiDecisionTimerRef.current = [];
  }, []);
  const interactiveShishi = Boolean(session && isZenShishiGateSession(session)
    && ['entryCheckpoint', 'returnGuard'].includes(session.gateKind));
  const canPour = Boolean(phase === 'ready' && isSessionAuthorized && interactiveShishi
    && !pendingDecision && !failedDecision && !isDecisionAfterglow);
  const shishiWaitMs = isSessionAuthorized && interactiveShishi
    ? resolveGateShishiWaitMs(session) : GATE_SHISHI_WAIT_MS;
  const shishiEnterReady = useZenGateWait({
    enabled: canPour, sessionId, waitMs: shishiWaitMs, resetToken: shishiResetToken,
  });
  const copy = getCopy(language);
  const resetGatePresentation = useCallback(() => {
    setShishiPourStartedAtMs(null);
    setShishiPourDecision(DECISION_LEAVE);
    shishiLeaveChosenRef.current = false;
    decisionInFlightRef.current = false;
    setShishiResetToken((token) => token + 1);
    setSelectedTabIdsToClose([]);
    setTabSelectionError('');
    setSessionRefreshError('');
    setFailedDecision('');
  }, []);

  const applyRefreshedSession = useCallback((nextSession) => {
    setSession((current) => {
      if (current?.gateKind === 'detourSpreadGuard') {
        const previousUrls = new Map(current.protectedTabs.map((tab) => [tab.tabId, tab.url]));
        const nextUrls = new Map(nextSession.protectedTabs.map((tab) => [tab.tabId, tab.url]));
        setSelectedTabIdsToClose((selected) => {
          const retained = selected.filter((tabId) => previousUrls.has(tabId)
            && previousUrls.get(tabId) === nextUrls.get(tabId));
          return retained.length === selected.length ? selected : retained;
        });
      }
      return { ...current, ...nextSession };
    });
  }, []);

  const submitDecision = useCallback(async (decision) => {
    if (!sessionId || !session || pendingDecision || decisionInFlightRef.current) {
      return;
    }

    decisionInFlightRef.current = true;
    cancelShishiDecisionTimer();
    setFailedDecision('');
    setError('');
    setPendingDecision(decision);
    const documentEpoch = documentEpochRef.current;
    const response = await runtimeSendMessage({
      action: MESSAGE_ACTIONS.SUBMIT_GATE_INTERSTITIAL_DECISION,
      sessionId,
      decision,
    }).catch((submissionError) => ({
      success: false,
      error: submissionError?.message || 'GATE_INTERSTITIAL_DECISION_FAILED',
    }));
    if (documentEpoch !== documentEpochRef.current) return;

    if (response?.success) {
      if (decision === DECISION_LEAVE) {
        setPhase('leaving');
      }
      return;
    }

    decisionInFlightRef.current = false;
    if (response?.error === 'GATE_INTERVENTION_HOLD_ACTIVE') {
      setNow(Date.now());
      setPendingDecision('');
      return;
    }

    const failure = typeof response?.error === 'string' ? response.error : 'GATE_INTERSTITIAL_DECISION_FAILED';
    setPendingDecision('');
    if (response?.stale || TERMINAL_GATE_DECISION_ERRORS.has(failure) || failure.startsWith('TAB_CLOSURE_REFUSED:')) {
      setError(failure);
      setPhase('invalid');
      return;
    }
    console.error('[GateDecision] Choice failed:', failure);
    setFailedDecision(decision);
  }, [cancelShishiDecisionTimer, pendingDecision, session, sessionId]);

  // The bamboo concludes both ways with one gesture: pouring (Leave), or a
  // return lock running out, where the filled tube tips by itself (Continue).
  const beginShishiPour = useCallback((decision) => {
    if (!canPour || shishiLeaveChosenRef.current || decisionInFlightRef.current) return;
    shishiLeaveChosenRef.current = true;
    setShishiPourDecision(decision);
    const startedAtMs = performance.now();
    setShishiPourStartedAtMs(startedAtMs);
    const documentEpoch = documentEpochRef.current;
    // One canonical timeline owns the cue and conclusion; rendering never grants a choice.
    const strikeMs = ZEN_SHISHI_POUR_STRIKE_SEC * 1000;
    shishiDecisionTimerRef.current = [
      window.setTimeout(() => {
        if (documentEpoch !== documentEpochRef.current) return;
        playAppSoundCue(SOUND_CUE_IDS.ZEN_SHISHI_ODOSHI_CLACK, {
          ...GATE_SHISHI_SOUND_CONTEXT, intensity: 0.76,
        });
      }, Math.max(0, startedAtMs + strikeMs - performance.now())),
      window.setTimeout(() => {
        if (documentEpoch !== documentEpochRef.current) return;
        void submitDecision(decision);
      }, Math.max(0, startedAtMs + strikeMs + ZEN_STRIKE_AFTERGLOW_MS - performance.now())),
    ];
  }, [canPour, submitDecision]);
  const beginShishiLeave = useCallback(() => beginShishiPour(DECISION_LEAVE), [beginShishiPour]);

  useEffect(() => {
    let holdTimer = null;
    const documentEpoch = documentEpochRef.current;
    const enterAfterWaiting = () => {
      window.clearTimeout(holdTimer);
      holdTimer = null;
      if (documentEpoch !== documentEpochRef.current) return;
      if (!shishiEnterReady || !canPour || shishiLeaveChosenRef.current) return;
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const remainingHoldMs = session.holdUntil - Date.now();
      if (remainingHoldMs > 0) {
        holdTimer = window.setTimeout(enterAfterWaiting, remainingHoldMs);
        return;
      }
      if (session.gateKind === 'returnGuard') beginShishiPour(DECISION_CONTINUE);
      else void submitDecision(DECISION_CONTINUE);
    };
    window.addEventListener('focus', enterAfterWaiting);
    document.addEventListener('visibilitychange', enterAfterWaiting);
    enterAfterWaiting();
    return () => {
      window.clearTimeout(holdTimer);
      window.removeEventListener('focus', enterAfterWaiting);
      document.removeEventListener('visibilitychange', enterAfterWaiting);
    };
  }, [beginShishiPour, canPour, shishiEnterReady, session?.gateKind, session?.holdUntil, submitDecision]);

  const submitDetourSelection = useCallback(async () => {
    if (!sessionId || !session || pendingDecision) {
      return;
    }
    const detourBudgetState = resolveDetourSpreadBudgetState(session);
    if (!detourBudgetState) {
      return;
    }
    const availableTabIds = new Set(detourBudgetState.allTabs.map((tab) => tab.tabId));
    const selectedTabIds = selectedTabIdsToClose.filter((tabId) => availableTabIds.has(tabId));
    const remainingProtectedTabCount = detourBudgetState.allTabs.length - selectedTabIds.length;
    if (!selectedTabIds.length || remainingProtectedTabCount > detourBudgetState.protectedTabBudget) {
      return;
    }

    const decision = selectedTabIds.includes(Number(session.tabId))
      ? DECISION_LEAVE
      : DECISION_CONTINUE;
    setTabSelectionError('');
    setPendingDecision(decision);
    const closureStartedAt = Date.now();
    const documentEpoch = documentEpochRef.current;
    const response = await runtimeSendMessage({
      action: MESSAGE_ACTIONS.SUBMIT_GATE_INTERSTITIAL_DECISION,
      sessionId,
      decision,
      tabIdsToClose: selectedTabIds,
    }).catch((submissionError) => ({
      success: false,
      error: submissionError?.message || 'GATE_INTERSTITIAL_PROTECTED_TAB_SELECTION_FAILED',
    }));
    if (documentEpoch !== documentEpochRef.current) return;

    if (response?.success) {
      if (response.decision === DECISION_LEAVE) {
        await waitForPredatorClosure(closureStartedAt);
        if (documentEpoch !== documentEpochRef.current) return;
        setPhase('leaving');
      } else {
        setPhase('leaving');
      }
      return;
    }

    console.error('[GatePruning] Selection failed:', response?.error || 'GATE_INTERSTITIAL_PROTECTED_TAB_SELECTION_FAILED');
    setTabSelectionError(copy.predatorSelectionError);
    if (STALE_DETOUR_TARGET_ERRORS.has(response?.error)
      || response?.error === 'GATE_INTERSTITIAL_PROTECTED_TAB_BUDGET_NOT_CLEARED'
      || response?.error === 'GATE_INTERSTITIAL_PROTECTED_TAB_SELECTION_INVALID') {
      const refreshed = await runtimeSendMessage({ action: MESSAGE_ACTIONS.GET_GATE_INTERSTITIAL_SESSION, sessionId })
        .catch((refreshError) => ({ success: false, error: refreshError.message }));
      if (documentEpoch !== documentEpochRef.current) return;
      if (refreshed?.success && refreshed.session) applyRefreshedSession(refreshed.session);
    }
    setPendingDecision('');
  }, [
    applyRefreshedSession,
    copy.predatorSelectionError,
    pendingDecision,
    selectedTabIdsToClose,
    session,
    sessionId,
  ]);

  const handleCloseTab = useCallback(() => {
    try {
      window.close();
    } catch (_) {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let requestSerial = 0;

    async function loadSession() {
      const serial = ++requestSerial;
      const response = await runtimeSendMessage({
        action: MESSAGE_ACTIONS.GET_GATE_INTERSTITIAL_SESSION,
        sessionId,
      }).catch((loadError) => ({
        success: false,
        error: loadError?.message || 'GATE_SESSION_LOAD_FAILED',
      }));

      if (cancelled || serial !== requestSerial) {
        return;
      }

      if (response?.success && response.session) {
        const nextSession = response.session;
        try {
          const authorizedSession = applyGateDocumentPresentation(nextSession, copy.activeGateLabel);
          if (isZenShishiGateSession(authorizedSession)
            && ['entryCheckpoint', 'returnGuard'].includes(authorizedSession.gateKind)) {
            resolveGateShishiWaitMs(authorizedSession);
            if (!Number.isFinite(authorizedSession.holdUntil) || authorizedSession.holdUntil < 0) {
              throw new Error('ZEN_GATE_HOLD_UNTIL_INVALID');
            }
          }
          setSession(authorizedSession);
          setIsSessionAuthorized(true);
          setPhase(response.resuming ? 'leaving' : 'ready');
        } catch (themeError) {
          setError(themeError?.code || themeError?.message || 'GATE_INTERSTITIAL_THEME_INVALID');
          setPhase('invalid');
        }
        return;
      }

      if (response?.stale === true || response?.error === GATE_INTERSTITIAL_SESSION_STALE) {
        setError('');
        setPhase('stale');
        return;
      }

      setError(typeof response?.error === 'string' ? response.error : 'GATE_INTERSTITIAL_SESSION_UNAVAILABLE');
      setPhase('invalid');
    }

    const handlePageHide = () => {
      // A BFCache document can retain its React tree and outstanding messages.
      // Invalidate the old response before a later restore reauthorizes it.
      requestSerial += 1;
      setIsSessionAuthorized(false);
      documentEpochRef.current += 1;
      cancelShishiDecisionTimer();
    };
    const handlePageShow = (event) => {
      if (!event.persisted) return;
      // A fast revalidation can batch loading -> ready into one render. Reset
      // explicitly so the prior strike/selection never survives that batching.
      resetGatePresentation();
      setPendingDecision('');
      setPhase('loading');
      void loadSession();
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    void loadSession();
    return () => {
      cancelled = true;
      documentEpochRef.current += 1;
      cancelShishiDecisionTimer();
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [cancelShishiDecisionTimer, copy.activeGateLabel, resetGatePresentation, sessionId]);

  useEffect(() => {
    if (phase !== 'ready' || !isSessionAuthorized || window.parent !== window) return undefined;
    let reported = false;
    let cancelled = false;
    const reportPresentation = () => {
      if (reported || document.visibilityState !== 'visible') return;
      reported = true;
      void runtimeSendMessage({ action: MESSAGE_ACTIONS.INTERVENTION_ADMISSION, operation: 'gate_presented', sessionId })
        .then((receipt) => {
          if (receipt?.accepted !== true) throw new Error('GATE_ADMISSION_PRESENTATION_UNCONFIRMED');
        }).catch((error) => {
          console.error('[GateAdmission]', error);
          if (!cancelled) { setError(error.message); setPhase('invalid'); }
        });
    };
    const frame = requestAnimationFrame(reportPresentation);
    document.addEventListener('visibilitychange', reportPresentation);
    return () => { cancelled = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', reportPresentation); };
  }, [isSessionAuthorized, phase, sessionId]);

  useEffect(() => {
    if (phase !== 'stale') {
      return undefined;
    }
    const skipped = skipStaleGateHistory();
    if (!skipped) {
      setPhase('invalid');
      return undefined;
    }
    const documentEpoch = documentEpochRef.current;
    const fallbackTimerId = window.setTimeout(() => {
      if (documentEpoch !== documentEpochRef.current) return;
      setPhase('invalid');
    }, 700);
    return () => window.clearTimeout(fallbackTimerId);
  }, [phase, sessionId]);

  useEffect(() => {
    if (phase !== 'ready' || !isSessionAuthorized || pendingDecision || !['isolation', 'detourSpreadGuard'].includes(session?.gateKind) || !sessionId) {
      return undefined;
    }
    let cancelled = false;
    const refreshIsolationSession = async () => {
      const documentEpoch = documentEpochRef.current;
      const response = await runtimeSendMessage({
        action: MESSAGE_ACTIONS.GET_GATE_INTERSTITIAL_SESSION,
        sessionId,
      }).catch((refreshError) => ({
        success: false,
        error: refreshError?.message || 'ISOLATION_GATE_REFRESH_FAILED',
      }));
      if (cancelled || documentEpoch !== documentEpochRef.current) return;
      if (response?.success && response.session) {
        setSessionRefreshError('');
        if (response.resuming) { setPhase('leaving'); return; }
        applyRefreshedSession(response.session);
        return;
      }
      console.error('[GatePruning] Session refresh failed:', response?.error || 'GATE_SESSION_REFRESH_FAILED');
      setSessionRefreshError(copy.predatorSelectionError);
    };
    const timerId = window.setInterval(refreshIsolationSession, 1000);
    void refreshIsolationSession();
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [applyRefreshedSession, copy.predatorSelectionError, isSessionAuthorized, phase, pendingDecision, session?.gateKind, sessionId]);

  useEffect(() => {
    if (phase !== 'ready' || !session) {
      return;
    }

    try {
      const normalizedSession = applyGateDocumentPresentation(session, copy.activeGateLabel);
      if (
        normalizedSession.themeId !== session.themeId
        || normalizedSession.gatekeeperStyleVariant !== session.gatekeeperStyleVariant
      ) {
        setSession(normalizedSession);
      }
    } catch (themeError) {
      setError(themeError?.code || themeError?.message || 'GATE_INTERSTITIAL_THEME_INVALID');
      setPhase('invalid');
    }
  }, [copy.activeGateLabel, phase, session]);

  useEffect(() => {
    preloadGateBootstrapWidget(session);
  }, [session]);

  // Ordinary theme countdowns retain their existing wall-clock policy.
  useEffect(() => {
    if (phase !== 'ready' || !session || isZenShishiGateSession(session)
      || session.gateKind === 'isolation') return undefined;
    const intervalId = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [phase, session]);

  useEffect(resetGatePresentation, [resetGatePresentation, sessionId, phase]);

  useEffect(() => {
    if (phase !== 'ready' || !session) {
      return undefined;
    }

    const palette = resolveVisualPalette(session);
    const isShishiGate = isZenShishiGateSession(session, palette);

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (session.gateKind === 'detourSpreadGuard') {
        if (event.key === 'Escape' && selectedTabIdsToClose.length > 0) {
          event.preventDefault();
          setSelectedTabIdsToClose([]);
          setTabSelectionError('');
        }
        return;
      }

      if (event.key === 'Escape') {
        if (pendingDecision === DECISION_CONTINUE) {
          return;
        }
        event.preventDefault();
        if (interactiveShishi) beginShishiLeave();
        else void submitDecision(DECISION_LEAVE);
        return;
      }

      if (!isShishiGate) {
        if (event.key !== 'Enter') {
          return;
        }
        const holdUntil = Math.max(0, Math.floor(Number(session.holdUntil) || 0));
        if (
          holdUntil > Date.now()
          || pendingDecision
        ) {
          return;
        }
        event.preventDefault();
        void submitDecision(DECISION_CONTINUE);
        return;
      }

      // Enter/Space pours only when the bamboo itself has keyboard focus.
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [beginShishiLeave, interactiveShishi, pendingDecision, phase, selectedTabIdsToClose.length, session, submitDecision]);

  const readyPalette = session ? resolveVisualPalette(session) : null;
  const readyIsShishiGate = session ? isZenShishiGateSession(session, readyPalette) : false;
  const readyShishiWaterColor = readyIsShishiGate
    ? ZEN_GATE_ARTIFACT_COLORS.artifact.color
    : readyPalette?.accentSecondary;
  const gateShishiArtifactRuntime = useMemo(
    () => (
      readyIsShishiGate
        ? buildGateShishiArtifactRuntime(
          readyShishiWaterColor,
          { active: true },
        )
        : null
    ),
    [readyIsShishiGate, readyShishiWaterColor],
  );

  useEffect(() => {
    if (!readyIsShishiGate || !isDecisionAfterglow || phase !== 'ready' || pendingDecision) {
      exitAppSoundScene(SOUND_SCENE_IDS.ZEN_SHISHI_ODOSHI_WATER_LOOP);
      return undefined;
    }
    enterAppSoundScene(SOUND_SCENE_IDS.ZEN_SHISHI_ODOSHI_WATER_LOOP, GATE_SHISHI_SOUND_CONTEXT);
    return () => exitAppSoundScene(SOUND_SCENE_IDS.ZEN_SHISHI_ODOSHI_WATER_LOOP);
  }, [isDecisionAfterglow, pendingDecision, phase, readyIsShishiGate]);

  if (phase === 'loading' || (phase === 'ready' && session?.gateKind === 'detourSpreadGuard' && !isSessionAuthorized)) {
    return <GateBootShell />;
  }

  if (phase === 'invalid' || phase === 'leaving' || phase === 'stale' || !session) {
    const actionCopy = resolveActionCopy(session, language);
    const title = phase === 'leaving'
      ? actionCopy.leavePending
      : (phase === 'stale' ? copy.staleTitle : copy.invalidTitle);
    const body = phase === 'invalid'
      ? `${copy.invalidBody}${error ? ` (${error})` : ''}`
      : (phase === 'stale' ? copy.staleBody : actionCopy.decisionHint);

    return (
      <GateStatusShell
        eyebrow={copy.activeGateLabel}
        title={title}
        body={body}
        loading={phase === 'leaving' || phase === 'stale'}
        actionLabel={phase === 'invalid' ? (copy.closeTabLabel || '탭 닫기') : ''}
        onAction={handleCloseTab}
      />
    );
  }

  const heroText = resolveHeroText(session, language);
  const actionCopy = resolveActionCopy(session, language);
  const palette = readyPalette || resolveVisualPalette(session);
  const isShishiGate = readyIsShishiGate;
  const isDetourSpreadGate = session.gateKind === 'detourSpreadGuard';
  const detourBudgetState = isDetourSpreadGate
    ? resolveDetourSpreadBudgetState(session)
    : null;
  if (isDetourSpreadGate && !detourBudgetState) {
    return (
      <GateStatusShell
        eyebrow={copy.activeGateLabel}
        title={copy.invalidTitle}
        body={`${copy.invalidBody} (GATE_INTERSTITIAL_PROTECTED_TAB_BUDGET_INVALID)`}
      />
    );
  }
  const ShishiOdoshiWidget = isShishiGate ? getThemeWidget('zen', 'Artifact_Gate') : null;
  const returnLockFillWindow = isShishiGate && session.gateKind === 'returnGuard'
    ? resolveReturnLockFillWindow(session)
    : null;
  const msRemaining = Math.max(0, Math.floor(Number(session.holdUntil) || 0) - now);
  const holdDurationMs = Math.max(0, Math.floor(Number(session.holdDurationMs) || 0));
  const progress = holdDurationMs > 0
    ? clamp((holdDurationMs - msRemaining) / holdDurationMs, 0, 1)
    : 1;
  // Timed countdown + button path (non-shishi gates only).
  const continueReady = msRemaining === 0;
  const continueDisabled = !continueReady || Boolean(pendingDecision);
  const holdLabel = msRemaining > 0
    ? `${copy.holdPrefix} ${formatDurationShort(msRemaining, language)}`
    : copy.holdReady;
  const countdownCaption = msRemaining > 0
    ? `${Math.ceil(msRemaining / 1000)}${copy.secondsSuffix}`
    : copy.readyLabel;
  const signalChips = resolveSignalChips(session, language);
  const contextStats = resolveContextStats(session, language);
  const severityLabel = copy.severity[session.severity] || session.severity || copy.severity.low;
  const metricsSummaryResolver = copy.metricSummary[session.gateKind];
  const metricsSummary = typeof metricsSummaryResolver === 'function'
    ? metricsSummaryResolver(session.metrics || {}, language)
    : '';
  const continueButtonLabel = pendingDecision === DECISION_CONTINUE
    ? actionCopy.continuePending
    : failedDecision === DECISION_CONTINUE ? copy.retryLabel : actionCopy.continueLabel;
  const leaveButtonLabel = pendingDecision === DECISION_LEAVE ? actionCopy.leavePending
    : failedDecision === DECISION_LEAVE ? copy.retryLabel : actionCopy.leaveLabel;
  const actionHint = actionCopy.decisionHint;

  if (isDetourSpreadGate && detourBudgetState) {
    const selectionPending = Boolean(pendingDecision);
    const toggleTabSelection = (tabId) => {
      if (selectionPending) return;
      setTabSelectionError('');
      setSelectedTabIdsToClose((currentIds) => (
        currentIds.includes(tabId)
          ? currentIds.filter((candidateId) => candidateId !== tabId)
          : [...currentIds, tabId]
      ));
    };

    return (
      <GateDetourSpreadSurface
        language={language}
        pendingDecision={pendingDecision}
        progress={progress}
        selectedTabIdsToClose={selectedTabIdsToClose}
        session={session}
        tabSelectionError={tabSelectionError || sessionRefreshError}
        onSubmit={() => void submitDetourSelection()}
        onToggleTab={toggleTabSelection}
      />
    );
  }

  if (isShishiGate && session.gateKind === 'isolation') {
    return (
      <GateIsolationBoundarySurface
        language={language}
        pendingDecision={pendingDecision}
        decisionFailed={Boolean(failedDecision)}
        session={session}
        onClose={() => void submitDecision(DECISION_LEAVE)}
      />
    );
  }

  // Only the garden and destination are visible. The bamboo is the action;
  // waiting on the foreground document admits entry without another control.
  if (isShishiGate) {
    const isReturnLock = session.gateKind === 'returnGuard';
    const isOpening = pendingDecision === DECISION_CONTINUE
      || (isDecisionAfterglow && shishiPourDecision === DECISION_CONTINUE);
    const zenStatusLabel = failedDecision ? '' : isOpening
      ? (isReturnLock ? copy.zenOpeningLabel : copy.zenEnteringLabel)
      : ((pendingDecision === DECISION_LEAVE || isDecisionAfterglow) ? copy.zenLeavingLabel : '');

    return (
      <div
        className="gate-page gate-zen"
        data-gate-style={palette.styleVariant}
        data-theme-id={palette.themeId}
        data-gate-kind={session.gateKind}
        data-stage={isDecisionAfterglow ? 'pouring' : 'waiting'}
        data-enter-ready={shishiEnterReady ? '1' : '0'}
        data-pending={pendingDecision ? '1' : '0'}
        style={{
          '--gate-accent': palette.accent,
          '--gate-accent-secondary': palette.accentSecondary,
          '--gate-shell': palette.shell,
          '--gate-text': palette.text,
          '--gate-muted': palette.muted,
        }}
      >
        <div className="gate-zen__ground" aria-hidden="true">
          <div className="gate-zen__sand" />
          <div className="gate-zen__rake" />
        </div>

        <main className="gate-zen__field">
          <button type="button" className="gate-zen__stage gate-zen__pour"
            aria-label={copy.zenPourLabel} aria-keyshortcuts="Escape"
            disabled={!canPour} onClick={beginShishiLeave}>
            <div className="gate-zen__tube" aria-hidden="true">
              <Suspense fallback={<div className="gate-zen__tube-fallback" />}>
                {ShishiOdoshiWidget ? (
                  <ShishiOdoshiWidget
                    key={`${sessionId}:${shishiResetToken}`}
                    isActive
                    color={readyShishiWaterColor}
                    initialFill={0}
                    heldFillWindow={returnLockFillWindow}
                    pourRequested={isDecisionAfterglow}
                    pourStartedAtMs={shishiPourStartedAtMs}
                    artifactRenderContext={gateShishiArtifactRuntime?.renderContext}
                    artifactRenderState={gateShishiArtifactRuntime?.renderState}
                  />
                ) : <div className="gate-zen__tube-fallback" />}
              </Suspense>
            </div>
          </button>

          <div className="gate-zen__inscription">
            <p className="gate-zen__host">{session.hostname}</p>
            <p className="gate-zen__hint">
              {session.gateKind === 'returnGuard'
                ? copy.zenReturnLockHint(formatClockTime(session.holdUntil))
                : copy.zenDecisionHint}
            </p>
            <p className="gate-zen__status" role="status" aria-live="polite" aria-atomic="true">
              {zenStatusLabel}
            </p>
            {failedDecision ? <>
              <p className="gate-decision-error" role="alert">{copy.decisionFailed}</p>
              <button type="button" className="gate-button gate-zen__retry"
                onClick={() => void submitDecision(failedDecision)}>{copy.retryLabel}</button>
            </> : null}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="gate-page"
      data-gate-style={palette.styleVariant}
      data-theme-id={palette.themeId}
      data-gate-kind={session.gateKind}
      data-ready={continueReady ? '1' : '0'}
      style={{
        '--gate-accent': palette.accent,
        '--gate-accent-secondary': palette.accentSecondary,
        '--gate-surface': palette.surface,
        '--gate-surface-strong': palette.surfaceStrong,
        '--gate-shell': palette.shell,
        '--gate-text': palette.text,
        '--gate-muted': palette.muted,
        '--gate-ring': palette.ring,
        '--gate-progress': `${progress}`,
      }}
    >
      <div className="gate-page__backdrop" aria-hidden="true">
        <div className="gate-page__mist gate-page__mist--a" />
        <div className="gate-page__mist gate-page__mist--b" />
        <div className="gate-page__sand" />
        <div className="gate-page__enso" />
        <div className="gate-page__pond" />
      </div>

      <main className="gate-shell">
        <section className="gate-copy-panel">
          <div className="gate-copy-panel__header">
            <p className="gate-copy-panel__eyebrow">{heroText.eyebrow}</p>
            <div className="gate-copy-panel__row">
              <span className="gate-copy-panel__pill">{heroText.gateLabel}</span>
              <span className="gate-copy-panel__pill">{session.hostname}</span>
              <span className="gate-copy-panel__pill">{copy.planLabel} {session.planLevel}</span>
            </div>
          </div>

          <div className="gate-copy-panel__body">
            <p className="gate-copy-panel__subtitle">{heroText.subtitle}</p>
            <h1 className="gate-copy-panel__title">{heroText.heroTitle}</h1>
            <p className="gate-copy-panel__lead">{heroText.heroBody}</p>
            {metricsSummary ? <p className="gate-copy-panel__detail">{metricsSummary}</p> : null}
          </div>

          <div className="gate-countdown-card" aria-live="polite">
            <div className="gate-countdown-card__head">
              <span>{copy.countdownLabel}</span>
              <strong>{holdLabel}</strong>
            </div>
            <div className="gate-countdown-card__track">
              <span className="gate-countdown-card__fill" />
            </div>
            <p className="gate-countdown-card__caption">
              {countdownCaption}
            </p>
          </div>

          <div className="gate-copy-panel__footer">
            <div className="gate-actions">
              <button
                type="button"
                className="gate-button gate-button--secondary"
                onClick={() => void submitDecision(DECISION_LEAVE)}
                disabled={pendingDecision === DECISION_CONTINUE}
              >
                <span className="gate-button__content">
                  <span className="gate-button__label">{leaveButtonLabel}</span>
                </span>
              </button>
              <button
                type="button"
                className="gate-button gate-button--primary"
                onClick={() => void submitDecision(DECISION_CONTINUE)}
                disabled={continueDisabled}
              >
                <span className="gate-button__content">
                  <span className="gate-button__label">{continueButtonLabel}</span>
                </span>
              </button>
            </div>

            <p className="gate-copy-panel__hint">{actionHint}</p>
            {failedDecision ? <p className="gate-decision-error" role="alert">{copy.decisionFailed}</p> : null}
          </div>
        </section>
      </main>

      <section className="gate-visual-panel" aria-hidden="true">
        <div className="gate-garden-card">
          <div className="gate-garden-card__halo" />
          <div className="gate-garden-card__rails">
            <span />
            <span />
            <span />
          </div>
          <div className="gate-garden-card__pivot" />
          <div className="gate-garden-card__bamboo">
            <span className="gate-garden-card__bamboo-neck" />
            <span className="gate-garden-card__bamboo-body" />
          </div>
          <div className="gate-garden-card__stone">
            <span className="gate-garden-card__stone-ripple gate-garden-card__stone-ripple--a" />
            <span className="gate-garden-card__stone-ripple gate-garden-card__stone-ripple--b" />
          </div>
        </div>

        <div className="gate-meta-card">
          <div className="gate-meta-card__section">
            <span className="gate-meta-card__label">{copy.telemetryLabel}</span>
            <div className="gate-chip-list">
              {signalChips.map((chip) => (
                <span key={chip} className="gate-chip">{chip}</span>
              ))}
            </div>
          </div>

          <div className="gate-meta-card__grid">
            <div className="gate-stat">
              <span className="gate-stat__label">{copy.hostnameLabel}</span>
              <strong className="gate-stat__value">{session.hostname}</strong>
            </div>
            <div className="gate-stat">
              <span className="gate-stat__label">{copy.severityLabel}</span>
              <strong className="gate-stat__value">{severityLabel}</strong>
            </div>
            <div className="gate-stat">
              <span className="gate-stat__label">{copy.activeGateLabel}</span>
              <strong className="gate-stat__value">{heroText.gateLabel}</strong>
            </div>
            <div className="gate-stat">
              <span className="gate-stat__label">{copy.metricsLabel}</span>
              <strong className="gate-stat__value">{contextStats[0] || copy.triggersNone}</strong>
            </div>
          </div>

          {contextStats.length > 1 ? (
            <div className="gate-chip-list gate-chip-list--quiet">
              {contextStats.slice(1).map((item) => (
                <span key={item} className="gate-chip gate-chip--quiet">{item}</span>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
