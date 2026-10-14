import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bug, ListChecks, RefreshCw, X } from 'lucide-react';

import {
    DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
    ZEN_HOME_GARDEN_BED_MATERIAL_STYLES,
} from '../../model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import {
    DEFAULT_ZEN_BONSAI_PRESENTATION_STYLE,
    listZenBonsaiPresentationStyles,
} from '../../model/bonsai/rendering/zenBonsaiPresentationStyle.js';

const CATEGORY_LABELS = Object.freeze({
    user_rule: '사용자 제한',
    site_rule: '사이트 제한',
    unmanaged_review: '미관리 사용',
    recovery: '회복 크레딧',
    observation: '관측',
    maturity: '성장',
});

const SUBJECT_LABELS = Object.freeze({
    global_goal: '전체 제한',
    unmanaged_sites: '미관리 사이트',
    score_coverage: '점수 커버리지',
    score_criteria: '점수 기준',
    activity: '활동 없음',
    browsing_pattern: '탭 전환 패턴',
    recovery_credit: '회복 크레딧',
});

const TYPE_HINT_LABELS = Object.freeze({
    registered_site: '보호 사이트 등록',
    calibration_days: '증거일',
    protected_visits: '보호 사이트 방문',
    active_days: '활성 보호일',
    friction_successes: '프릭션 완료',
    today_protected_minutes: '오늘 보호 시간',
    weekly_protected_average: '주간 보호 평균',
});

const VITALITY_TIER_LABELS = Object.freeze({
    thriving: '무성',
    steady: '안정',
    strained: '지친',
    withered: '시듦',
});

const PRESENTATION_STYLE_OPTIONS = Object.freeze(
    listZenBonsaiPresentationStyles().map((style) => Object.freeze({
        id: style.id,
        label: style.label,
    })),
);

const GARDEN_BED_OPTIONS = Object.freeze([
    Object.freeze({
        id: ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.GLAZED_CERAMIC,
        label: '유약 도자',
    }),
    Object.freeze({
        id: ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.POLISHED_GRANITE,
        label: '연마 화강암',
    }),
    Object.freeze({
        id: ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.CHARRED_WOOD,
        label: '탄화 목재',
    }),
    Object.freeze({
        id: ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.WET_SLATE,
        label: '젖은 슬레이트',
    }),
]);

const formatNumber = (value, digits = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '--';
    return numeric.toFixed(digits).replace(/\.0$/, '');
};

const formatSignedPoints = ({
    deduction = 0,
    credit = 0,
    points = null,
} = {}) => {
    const normalizedPoints = Number(points);
    if (Number.isFinite(normalizedPoints) && Math.abs(normalizedPoints) > 0) {
        return normalizedPoints > 0
            ? `+${formatNumber(normalizedPoints)}점`
            : `-${formatNumber(Math.abs(normalizedPoints))}점`;
    }
    const safeDeduction = Number(deduction) || 0;
    const safeCredit = Number(credit) || 0;
    if (safeDeduction > 0 && safeCredit > 0) {
        return `-${formatNumber(safeDeduction)} / +${formatNumber(safeCredit)}점`;
    }
    if (safeDeduction > 0) return `-${formatNumber(safeDeduction)}점`;
    if (safeCredit > 0) return `+${formatNumber(safeCredit)}점`;
    return '0점';
};

const formatPercent = (ratio) => {
    const numeric = Number(ratio);
    if (!Number.isFinite(numeric)) return '--';
    return `${Math.round(Math.max(0, Math.min(1, numeric)) * 100)}%`;
};

const formatSubject = (entry = null) => {
    const subject = entry?.subject || '';
    if (!subject) return '근거 없음';
    return SUBJECT_LABELS[subject] || subject;
};

const formatImpactDetail = (impact = null) => {
    const metrics = impact?.metrics || {};
    if (impact?.dominantType === 'site_limit_over_limit') {
        return `${formatNumber(metrics.usedMinutes)}분 사용 / 제한 ${formatNumber(metrics.limitMinutes)}분`;
    }
    if (impact?.dominantType === 'site_limit_within_limit') {
        return `${formatNumber(metrics.remainingMinutes)}분 여유`;
    }
    if (impact?.dominantType === 'global_goal_over_limit') {
        return `전체 제한 ${formatNumber(metrics.goalMinutes)}분, 초과 ${formatNumber(metrics.overMinutes)}분`;
    }
    if (impact?.dominantType === 'global_goal_within_limit') {
        return `전체 제한 안쪽, ${formatNumber(metrics.remainingMinutes)}분 여유`;
    }
    if (impact?.dominantType === 'unmanaged_review_usage') {
        return `미관리 사용 ${formatNumber(metrics.activeMinutes)}분`;
    }
    if (impact?.dominantType === 'score_coverage_low') {
        return `커버리지 ${formatPercent(metrics.coverageRatio)}`;
    }
    return CATEGORY_LABELS[impact?.dominantCategory] || impact?.dominantCategory || '관측';
};

const formatRecoveryHint = (hint = null) => {
    const metrics = hint?.metrics || {};
    if (hint?.type === 'site_limit_over_limit') {
        return `${formatSubject(hint)} 사용을 ${formatNumber(metrics.limitMinutes)}분 안쪽으로 낮추면 약 ${formatNumber(hint.recoverablePoints)}점 회복 여지가 있습니다.`;
    }
    if (hint?.type === 'global_goal_over_limit') {
        return `전체 보호 사용을 ${formatNumber(metrics.goalMinutes)}분 안쪽으로 낮추면 약 ${formatNumber(hint.recoverablePoints)}점 회복 여지가 있습니다.`;
    }
    if (hint?.type === 'unmanaged_review_usage') {
        return `미관리 사이트 ${formatNumber(metrics.activeMinutes)}분을 줄이거나 규칙으로 분류하면 압박이 낮아집니다.`;
    }
    if (hint?.type === 'score_coverage_low') {
        return `점수 커버리지를 ${formatPercent(metrics.minDisplayRatio)} 이상으로 올리면 부분 점수 판정이 안정됩니다.`;
    }
    if (hint?.type === 'credit_available') {
        return `남은 회복 크레딧 약 ${formatNumber(hint.recoverablePoints)}점이 아직 적용 여지로 남아 있습니다.`;
    }
    if (hint?.source === 'growth_readiness') {
        const label = TYPE_HINT_LABELS[hint.type] || hint.type || '성장 근거';
        const unit = hint.unit === 'minutes' ? '분' : '';
        return `${label}: ${formatNumber(hint.value)}${unit} / ${formatNumber(hint.target)}${unit}까지 쌓으면 성장 점수가 회복됩니다.`;
    }
    return '큰 감점 근거는 없습니다. 보호 시간과 성공 기록을 유지하면 회복됩니다.';
};

function DebugMetric({
    label,
    value,
}) {
    return (
        <div className="min-w-0">
            <p className="truncate text-[9px] font-semibold text-stone-500">
                {label}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-black tabular-nums text-stone-800">
                {value}
            </p>
        </div>
    );
}

function DebugForceSlider({
    label,
    min = 0,
    step = 1,
    liveValue = null,
    forcedValue = null,
    onForce = null,
    onReset = null,
    unscoredValue = 0,
}) {
    const sliderId = useId();
    const sliderRef = useRef(null);
    const liveNumeric = liveValue === null ? null : Number(liveValue);
    const forcedNumeric = Number(forcedValue);
    const forced = forcedValue !== null && Number.isFinite(forcedNumeric);
    const effectiveValue = forced
        ? forcedNumeric
        : (liveNumeric === null ? unscoredValue : liveNumeric);

    return (
        <div className="rounded-lg border border-stone-900/8 bg-white/42 px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
                <label htmlFor={sliderId} className="text-[10px] font-black text-stone-700">
                    {label}
                </label>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black tabular-nums text-[#263D32]">
                        {!forced && liveNumeric === null ? '미평가' : `${formatNumber(effectiveValue)}%`}
                    </span>
                    {forced ? (
                        <button
                            type="button"
                            onClick={() => { onReset(); sliderRef.current?.focus({ preventScroll: true }); }}
                            className="rounded-full border border-amber-900/15 bg-amber-950/8 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-amber-900 transition hover:bg-amber-950/14"
                            aria-label={`${label} force 해제`}
                        >
                            Forced · Reset
                        </button>
                    ) : (
                        <span className="rounded-full border border-stone-900/8 bg-stone-900/4 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-stone-500">
                            {liveNumeric === null ? '기본 표현' : 'Live'}
                        </span>
                    )}
                </div>
            </div>
            <input
                ref={sliderRef}
                id={sliderId}
                type="range"
                min={min}
                max="100"
                step={step}
                value={effectiveValue}
                onChange={(event) => onForce?.(Number(event.target.value))}
                aria-label={`${label} force`}
                className="mt-2 h-1.5 w-full cursor-pointer accent-[#2D4F1E]"
                disabled={typeof onForce !== 'function'}
            />
        </div>
    );
}

export function ZenBonsaiDebugPanel({
    debugSnapshot = null,
    experience = null,
    actionPolicy = null,
    debugControls = null,
    isHomeEmbedded = false,
    onRerollBonsai = null,
    rerollBonsaiLabel = '분재 형태 다시 만들기',
}) {
    const [localOpen, setLocalOpen] = useState(false);
    const [rerollBusy, setRerollBusy] = useState(false);
    const [rerollError, setRerollError] = useState(null);
    const launcherRef = useRef(null), closeRef = useRef(null), wasOpen = useRef(false);
    const placement = debugControls?.panelPlacement;
    const docked = placement?.kind === 'external';
    const open = docked ? placement.expanded : localOpen;
    const setOpen = docked ? placement.onExpandedChange : setLocalOpen;
    const panelId = useId();
    const debugReady = Boolean(debugSnapshot && typeof debugSnapshot === 'object');
    useEffect(() => {
        if (open && (!wasOpen.current || document.activeElement === document.body)) {
            closeRef.current?.focus({ preventScroll: true });
        }
        else if (!open && wasOpen.current) launcherRef.current?.focus({ preventScroll: true });
        wasOpen.current = open;
    }, [open, debugReady, placement?.target]);
    if (!debugReady && debugControls === null) {
        return null;
    }

    const anchorClassName = isHomeEmbedded ? 'right-3 top-3' : 'right-5 top-5';
    const activation = debugSnapshot?.activation || {};
    const scoring = debugSnapshot?.scoring || {};
    const pressure = debugSnapshot?.pressure || {};
    const domainImpacts = Array.isArray(debugSnapshot?.topDomainImpacts)
        ? debugSnapshot.topDomainImpacts
        : [];
    const scoreImpacts = Array.isArray(debugSnapshot?.topScoreImpacts)
        ? debugSnapshot.topScoreImpacts
        : [];
    const impactRows = domainImpacts.length ? domainImpacts : scoreImpacts;
    const impactTitle = domainImpacts.length ? '도메인 영향 Top 5' : '점수 영향 Top 5';
    const categories = Array.isArray(debugSnapshot?.categories) ? debugSnapshot.categories : [];
    const recoveryHints = Array.isArray(debugSnapshot?.recoveryHints) ? debugSnapshot.recoveryHints : [];
    const formula = `${formatNumber(scoring.baseScore, 0)} - ${formatNumber(scoring.totalDeduction)} + ${formatNumber(scoring.totalCreditApplied)} = ${formatNumber(activation.score, 0)}`;
    const bonsaiRelease = debugControls?.bonsaiRelease || null;
    const activationControls = debugControls?.activation || {};
    const growthControls = debugControls?.growth || {};
    const bloomControls = debugControls?.bloom || {};
    const gardenBedMaterialStyle = debugControls?.gardenBedMaterialStyle
        || DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE;
    const presentationStyle = debugControls?.presentationStyle
        || DEFAULT_ZEN_BONSAI_PRESENTATION_STYLE;
    const renderLifeState = debugControls?.lifeState || {};
    const actualAlphaControls = debugControls?.actualAlpha || {};
    const actualAlphaObservation = actualAlphaControls.observation || null;
    const actualAlphaBounds = actualAlphaObservation?.observedAlphaBounds || null;
    const actualAlphaOverflow = actualAlphaObservation?.overflowPx || null;
    const actualAlphaCensoredEdges = actualAlphaObservation?.censoredEdges || null;
    const censoredEdgeLabels = actualAlphaCensoredEdges
        ? Object.entries(actualAlphaCensoredEdges)
            .filter(([, censored]) => censored === true)
            .map(([edge]) => edge)
        : [];
    const rerollAvailable = actionPolicy?.reroll?.available === true
        && typeof onRerollBonsai === 'function';

    const content = (
        <div className={docked ? 'pointer-events-auto w-full' : `pointer-events-auto absolute ${anchorClassName} z-30 flex flex-col items-end gap-2`}
            onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } }}>
            {(!docked || !open) && <button
                ref={launcherRef}
                type="button"
                aria-label="분재 디버그"
                aria-controls={open ? panelId : undefined}
                aria-expanded={open}
                title="분재 디버그"
                onClick={() => setOpen((current) => !current)}
                className={docked
                    ? 'flex h-16 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface/95 text-[9px] font-semibold text-on-surface shadow-md backdrop-blur-xl hover:border-accent hover:text-accent'
                    : 'inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-900/14 bg-white/58 px-2.5 text-[9px] font-black text-stone-700 shadow-sm backdrop-blur-md hover:bg-white/82'}
                data-testid="zen-bonsai-debug-toggle"
            >
                <Bug className="h-3.5 w-3.5" strokeWidth={2} />
                {docked ? '분재' : 'Debug'}
            </button>}

            {open && (
                <div
                    id={panelId}
                    className={`${docked ? 'max-h-[calc(100vh-64px)] w-full' : 'max-h-[min(76vh,620px)] w-[min(360px,calc(100vw-32px))]'} overflow-y-auto overscroll-contain rounded-xl border border-stone-900/12 bg-[#FFFDF8]/96 px-3 py-2.5 text-stone-800 shadow-xl backdrop-blur-md`}
                    role="dialog"
                    aria-label="분재 디버그"
                    data-testid="zen-bonsai-debug-panel"
                    data-tree-seed={debugControls?.treeSeed}
                    data-identity-revision={debugControls?.identityRevision}
                >
                    <div className="sticky -top-2.5 z-10 mb-3 flex items-center justify-between border-b border-stone-900/10 bg-[#FFFDF8] py-2">
                        <span className="flex items-center gap-2 text-xs font-semibold"><Bug className="h-4 w-4" />분재 디버그</span>
                        <button ref={closeRef} type="button" aria-label="분재 디버그 닫기" onClick={() => setOpen(false)}
                            className="rounded-full p-1.5 hover:bg-stone-100"><X className="h-4 w-4" /></button>
                    </div>
                    {!debugReady ? <p role="status" className="py-4 text-xs text-stone-500">현재 분재 자료를 준비 중입니다.</p> : <>
                    {rerollAvailable && <div className="mb-3">
                        <button type="button" disabled={rerollBusy} aria-label={rerollBonsaiLabel}
                            onClick={async () => {
                                setRerollBusy(true); setRerollError(null);
                                try { await onRerollBonsai(); }
                                catch (error) { setRerollError(error instanceof Error ? error.message : String(error)); }
                                finally {
                                    setRerollBusy(false);
                                    // Chrome blurs a focused button when it becomes
                                    // disabled. Restore panel focus after that command,
                                    // without stealing it from another active control.
                                    if (document.activeElement === document.body) closeRef.current?.focus({ preventScroll: true });
                                }
                            }}
                            className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold disabled:opacity-40">
                            <RefreshCw className={`h-3.5 w-3.5 ${rerollBusy ? 'animate-spin' : ''}`} />{rerollBusy ? '씨앗 저장 중' : rerollBonsaiLabel}
                        </button>
                        <p className="mt-1 text-[9px] text-stone-500">씨앗 {debugControls?.treeSeed} · identity {debugControls?.identityRevision} · 저장된 수형을 변경합니다.</p>
                        {rerollError && <p role="alert" className="mt-1 text-xs text-red-700">{rerollError}</p>}
                    </div>}
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-[10px] font-black text-stone-500">
                                분재 디버그
                            </p>
                            <p className="mt-1 text-[26px] font-black leading-none tabular-nums text-[#263D32]">
                                {formatPercent(experience?.maturity?.visibleProgress)}
                                <span className="ml-1.5 text-[10px] font-bold text-stone-500">
                                    성장
                                </span>
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="shrink-0 rounded-full border border-stone-900/10 bg-white/55 px-2 py-1 text-[9px] font-bold tabular-nums text-stone-500">
                                {bonsaiRelease
                                    ? `유효 사용일 ${bonsaiRelease.qualifiedUseDayCount}/${bonsaiRelease.targetDayCount}`
                                    : 'Live evidence'}
                            </span>
                            <span className="text-[9px] font-bold tabular-nums text-stone-500">
                                목표 {formatPercent(experience?.maturity?.targetProgress)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-3 space-y-1.5 border-t border-stone-900/10 pt-2.5">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-black text-stone-600">
                                외형 미리보기
                            </p>
                            <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-stone-400">
                                local · non-persistent
                            </p>
                        </div>
                        {typeof growthControls.onForce === 'function' && (
                            <DebugForceSlider
                                label="렌더 성장도"
                                min={50}
                                step={0.1}
                                liveValue={growthControls.livePercent}
                                forcedValue={growthControls.forcedPercent}
                                onForce={growthControls.onForce}
                                onReset={growthControls.onReset}
                            />
                        )}
                        {typeof bloomControls.onForce === 'function' && (
                            <DebugForceSlider
                                label="개화도"
                                liveValue={bloomControls.livePercent}
                                forcedValue={bloomControls.forcedPercent}
                                onForce={bloomControls.onForce}
                                onReset={bloomControls.onReset}
                            />
                        )}
                        <DebugForceSlider
                            label="활성화도"
                            unscoredValue={100}
                            liveValue={activationControls.livePercent}
                            forcedValue={activationControls.forcedPercent}
                            onForce={activationControls.onForce}
                            onReset={activationControls.onReset}
                        />
                        <p className="text-[9px] text-stone-500" data-testid="zen-bonsai-activation-receipt"
                            data-requested={activationControls.forcedPercent === null ? 'live' : activationControls.forcedPercent}
                            data-rendered-ratio={activationControls.rendered?.activationRatio === null ? 'unscored' : activationControls.rendered?.activationRatio}
                            data-rendered-signal={activationControls.rendered?.expressedActivation}>
                            완료 프레임 표현 {activationControls.rendered?.expressedActivation == null
                                ? '관측 대기' : `${formatPercent(activationControls.rendered.expressedActivation)}`}
                            {activationControls.livePercent === null ? ' · 미평가 기본 표현은 억제하지 않습니다.' : ''}
                        </p>
                        <p className="text-[9px] leading-relaxed text-stone-500">
                            성장 50%는 초기 수형, 100%는 완성 수형입니다. 실제 꽃은 완성 직전에 펼쳐집니다.
                            개화는 꽃의 표현량, 활성화는 사용 습관에 따른 생기입니다. 각 Reset으로 실제 기록 값에 복귀합니다.
                        </p>
                    </div>

                    <div className="mt-3 border-t border-stone-900/10 pt-2.5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black text-stone-600">
                                    렌더 활력
                                </p>
                                <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-stone-400">
                                    그림이 실제로 읽는 값 · 위 활성화도 압박과 별개
                                </p>
                            </div>
                            <span className="shrink-0 rounded-full border border-stone-900/10 bg-white/55 px-2 py-1 text-[9px] font-bold text-stone-500">
                                {VITALITY_TIER_LABELS[renderLifeState.vitalityTier]
                                    || renderLifeState.vitalityTier || '--'}
                            </span>
                        </div>
                        <div className="mt-1.5 grid grid-cols-3 gap-2">
                            <DebugMetric label="성장" value={formatPercent(renderLifeState.growth)} />
                            <DebugMetric label="활력" value={formatPercent(renderLifeState.vitality)} />
                            <DebugMetric label="스트레스" value={formatPercent(renderLifeState.stress)} />
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                            <DebugMetric label="건조(붓)" value={formatPercent(renderLifeState.dryness)} />
                            <DebugMetric label="처짐" value={formatPercent(renderLifeState.branchSag)} />
                            <DebugMetric label="개화" value={formatPercent(renderLifeState.bloom)} />
                        </div>
                    </div>

                    {debugControls?.presentationStyleEditable === true && <div className="mt-3 border-t border-stone-900/10 pt-2.5">
                        <p className="text-[10px] font-black text-stone-600">
                            표현 스타일
                        </p>
                        <div
                            className="mt-1.5 grid grid-cols-2 gap-1.5"
                            role="group"
                            aria-label="표현 스타일"
                        >
                            {PRESENTATION_STYLE_OPTIONS.map((option) => {
                                const selected = presentationStyle === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => debugControls?.onPresentationStyleChange?.(option.id)}
                                        className={`h-8 rounded-lg border px-2 text-[9px] font-black transition ${selected
                                            ? 'border-[#2D4F1E]/30 bg-[#2D4F1E]/10 text-[#2D4F1E] shadow-sm'
                                            : 'border-stone-900/8 bg-white/38 text-stone-500 hover:bg-white/70 hover:text-stone-700'
                                        }`}
                                        data-testid={`zen-bonsai-presentation-style-${option.id}`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>}

                    <div className="mt-3 border-t border-stone-900/10 pt-2.5">
                        <p className="text-[10px] font-black text-stone-600">
                            화단 디자인
                        </p>
                        {debugControls?.gardenBedMaterialEditable === true ? <div
                            className="mt-1.5 grid grid-cols-2 gap-1.5"
                            role="group"
                            aria-label="화단 디자인"
                        >
                            {GARDEN_BED_OPTIONS.map((option) => {
                                const selected = gardenBedMaterialStyle === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => debugControls?.onGardenBedMaterialStyleChange?.(option.id)}
                                        className={`h-8 rounded-lg border px-2 text-[9px] font-black transition ${selected
                                            ? 'border-[#2D4F1E]/30 bg-[#2D4F1E]/10 text-[#2D4F1E] shadow-sm'
                                            : 'border-stone-900/8 bg-white/38 text-stone-500 hover:bg-white/70 hover:text-stone-700'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div> : <p className="mt-1 text-[10px] leading-relaxed text-stone-500">현재 화단은 프레임 통합 재질을 사용합니다. 별도 화분 재질 선택은 적용되지 않습니다.</p>}
                    </div>

                    {actualAlphaControls.supported === true && <div className="mt-3 border-t border-stone-900/10 pt-2.5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black text-stone-600">
                                    Tree alpha bounds
                                </p>
                                <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-stone-400">
                                    one-shot · tree only · pre-clip
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-pressed={actualAlphaControls.requested === true}
                                data-testid="zen-bonsai-actual-alpha-observe"
                                onClick={actualAlphaControls.requested === true
                                    ? actualAlphaControls.onCancel
                                    : actualAlphaControls.onRequest}
                                disabled={actualAlphaControls.requested === true
                                    ? typeof actualAlphaControls.onCancel !== 'function'
                                    : typeof actualAlphaControls.onRequest !== 'function'}
                                className="h-7 rounded-lg border border-stone-900/10 bg-white/52 px-2 text-[8px] font-black uppercase tracking-[0.08em] text-stone-600 transition hover:bg-white/82 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {actualAlphaControls.requested === true ? 'Cancel' : 'Sample'}
                            </button>
                        </div>
                        <div className="mt-1.5 rounded-lg border border-stone-900/8 bg-white/38 px-2 py-1.5 text-[9px] font-semibold text-stone-500">
                            {actualAlphaControls.requested === true && (
                                <p>다음 완료 프레임을 관측 중입니다.</p>
                            )}
                            {actualAlphaControls.requested !== true && !actualAlphaObservation && (
                                <p>아직 관측하지 않았습니다.</p>
                            )}
                            {actualAlphaControls.requested !== true
                                && actualAlphaObservation?.status === 'empty' && (
                                <p>완료된 관측에 tree alpha가 없습니다.</p>
                            )}
                            {actualAlphaControls.requested !== true && actualAlphaBounds && (
                                <div className="space-y-0.5 tabular-nums">
                                    <p>
                                        Bounds {actualAlphaBounds.minX},{actualAlphaBounds.minY}
                                        {' → '}
                                        {actualAlphaBounds.maxX},{actualAlphaBounds.maxY}
                                    </p>
                                    <p>
                                        Overflow L{actualAlphaOverflow?.left || 0}
                                        {' · '}R{actualAlphaOverflow?.right || 0}
                                        {' · '}T{actualAlphaOverflow?.top || 0}
                                        {' · '}B{actualAlphaOverflow?.bottom || 0}px
                                    </p>
                                    <p>
                                        Censored {censoredEdgeLabels.length
                                            ? censoredEdgeLabels.join(', ')
                                            : 'none'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>}

                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-stone-900/10 pt-2.5">
                        <div>
                            <p className="text-[9px] font-semibold text-stone-500">
                                실제 활성화 점수
                            </p>
                            <p className="mt-0.5 text-[20px] font-black leading-none tabular-nums text-[#263D32]">
                                {scoring.scored === true ? <>{formatNumber(activation.score, 0)}
                                    <span className="ml-1 text-[10px] font-bold text-stone-500">점</span></> : '미평가'}
                            </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-stone-900/10 bg-white/55 px-2 py-1 text-[9px] font-bold text-stone-500">
                            {scoring.scoringMode || 'unknown'}
                        </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                        <DebugMetric label="산식" value={formula} />
                        <DebugMetric label="활력" value={formatPercent(pressure.vitality)} />
                        <DebugMetric label="압박" value={formatPercent(pressure.habitPressure)} />
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                        <DebugMetric label="스트레스" value={formatPercent(pressure.stress)} />
                        <DebugMetric label="건조" value={formatPercent(pressure.dryness)} />
                        <DebugMetric label="회복" value={formatPercent(pressure.recovery)} />
                    </div>

                    <div className="mt-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                            <ListChecks className="h-3.5 w-3.5 text-stone-500" strokeWidth={2} />
                            <p className="text-[10px] font-black text-stone-600">
                                {impactTitle}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            {impactRows.length ? impactRows.map((impact) => (
                                <div
                                    key={`${impact.subject}-${impact.dominantType}`}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-stone-900/8 pt-1.5 first:border-t-0 first:pt-0"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-[10px] font-bold text-stone-800">
                                            {formatSubject(impact)}
                                        </p>
                                        <p className="truncate text-[9px] font-semibold text-stone-500">
                                            {formatImpactDetail(impact)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[10px] font-black tabular-nums text-stone-700">
                                        {formatSignedPoints(impact)}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-[10px] font-semibold leading-4 text-stone-500">
                                    도메인별 감점 근거가 아직 없습니다.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-3">
                        <p className="text-[10px] font-black text-stone-600">
                            점수 구성
                        </p>
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            {categories.map((category) => (
                                <div
                                    key={category.category}
                                    className="min-w-0 rounded-lg border border-stone-900/8 bg-white/38 px-2 py-1.5"
                                >
                                    <p className="truncate text-[9px] font-semibold text-stone-500">
                                        {CATEGORY_LABELS[category.category] || category.category}
                                    </p>
                                    <p className="mt-0.5 text-[10px] font-black tabular-nums text-stone-800">
                                        {formatSignedPoints(category)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 border-t border-stone-900/10 pt-2">
                        <p className="text-[10px] font-black text-stone-600">
                            회복 힌트
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                            {recoveryHints.length ? recoveryHints.map((hint) => (
                                <p
                                    key={hint.id}
                                    className="text-[10px] font-semibold leading-4 text-stone-600"
                                >
                                    {formatRecoveryHint(hint)}
                                </p>
                            )) : (
                                <p className="text-[10px] font-semibold leading-4 text-stone-600">
                                    큰 감점 근거는 없습니다. 보호 시간과 성공 기록을 유지하면 회복됩니다.
                                </p>
                            )}
                        </div>
                    </div>

                    </>}
                </div>
            )}
        </div>
    );
    // Inline is the explicit standalone/Experiment presentation; Home supplies
    // the app-owned external port. A not-yet-committed port is preparation.
    return docked ? (placement.target === null ? null : createPortal(content, placement.target)) : content;
}

export default ZenBonsaiDebugPanel;
