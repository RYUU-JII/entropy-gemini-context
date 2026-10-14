import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, RefreshCw, Shuffle } from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { runZenBonsaiEngineVNext } from '@/themes/plugins/zen/model/vnext/index.js';

const DEFAULT_CONTROLS = Object.freeze({
    seed: 20260705,
    stage: 'mature',
    trunkMovement: 62,
    branchDensity: 58,
    crownOpenness: 62,
    blossomBias: 72,
});

const DEFAULT_PRESET_ID = 'balanced';
const CUSTOM_PRESET_ID = 'custom';
const STAGE_OPTIONS = Object.freeze(['seedling', 'mid', 'mature', 'display']);
const PRESET_OPTIONS = Object.freeze([
    Object.freeze({
        id: 'balanced',
        controls: Object.freeze({
            trunkMovement: 62,
            branchDensity: 58,
            crownOpenness: 62,
            blossomBias: 72,
        }),
    }),
    Object.freeze({
        id: 'windswept',
        controls: Object.freeze({
            trunkMovement: 88,
            branchDensity: 44,
            crownOpenness: 76,
            blossomBias: 38,
        }),
    }),
    Object.freeze({
        id: 'ramified',
        controls: Object.freeze({
            trunkMovement: 48,
            branchDensity: 88,
            crownOpenness: 42,
            blossomBias: 58,
        }),
    }),
    Object.freeze({
        id: 'flowering',
        controls: Object.freeze({
            trunkMovement: 54,
            branchDensity: 66,
            crownOpenness: 56,
            blossomBias: 94,
        }),
    }),
]);

const METRIC_KEYS = Object.freeze([
    'nodes',
    'claims',
    'attractors',
    'complexity',
    'negative_space',
]);

const STAGE_COPY_KEYS = Object.freeze({
    seedling: 'experiment.vnext_growth_lab.stages.seedling',
    mid: 'experiment.vnext_growth_lab.stages.mid',
    mature: 'experiment.vnext_growth_lab.stages.mature',
    display: 'experiment.vnext_growth_lab.stages.display',
});

const PRESET_COPY_KEYS = Object.freeze({
    balanced: 'experiment.vnext_growth_lab.presets.balanced',
    windswept: 'experiment.vnext_growth_lab.presets.windswept',
    ramified: 'experiment.vnext_growth_lab.presets.ramified',
    flowering: 'experiment.vnext_growth_lab.presets.flowering',
});

const METRIC_COPY_KEYS = Object.freeze({
    nodes: 'experiment.vnext_growth_lab.metrics.nodes',
    claims: 'experiment.vnext_growth_lab.metrics.claims',
    attractors: 'experiment.vnext_growth_lab.metrics.attractors',
    complexity: 'experiment.vnext_growth_lab.metrics.complexity',
    negative_space: 'experiment.vnext_growth_lab.metrics.negative_space',
});

const CLAIM_KIND_COPY_KEYS = Object.freeze({
    trunk_guide: 'experiment.vnext_growth_lab.claim_kinds.trunk_guide',
    apex: 'experiment.vnext_growth_lab.claim_kinds.apex',
    light: 'experiment.vnext_growth_lab.claim_kinds.light',
    space: 'experiment.vnext_growth_lab.claim_kinds.space',
    style: 'experiment.vnext_growth_lab.claim_kinds.style',
    pad: 'experiment.vnext_growth_lab.claim_kinds.pad',
    void: 'experiment.vnext_growth_lab.claim_kinds.void',
});

const COPY_STATE_COPY_KEYS = Object.freeze({
    copied: 'experiment.vnext_growth_lab.copy_states.copied',
    failed: 'experiment.vnext_growth_lab.copy_states.failed',
});

const CLAIM_KIND_STYLE = Object.freeze({
    trunk_guide: { stroke: '#b7791f', fill: 'rgba(183,121,31,0.12)' },
    apex: { stroke: '#2f855a', fill: 'rgba(47,133,90,0.14)' },
    light: { stroke: '#d69e2e', fill: 'rgba(214,158,46,0.16)' },
    space: { stroke: '#3182ce', fill: 'rgba(49,130,206,0.13)' },
    style: { stroke: '#805ad5', fill: 'rgba(128,90,213,0.13)' },
    pad: { stroke: '#d53f8c', fill: 'rgba(213,63,140,0.13)' },
    void: { stroke: '#718096', fill: 'rgba(113,128,150,0.09)' },
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const pct = (value) => clamp(Math.round(toNumber(value, 0)), 0, 100);

const advanceSeed = (seed) => {
    const next = (Math.imul(Math.max(1, Math.floor(toNumber(seed, DEFAULT_CONTROLS.seed))), 1664525) + 1013904223) >>> 0;
    return next % 100000000;
};

const buildVNextLabInput = (controls = DEFAULT_CONTROLS) => ({
    engineVersion: 3,
    seed: controls.seed,
    stage: controls.stage,
    factors: {
        trunk_movement: controls.trunkMovement / 100,
        branch_density: controls.branchDensity / 100,
        crown_openness: controls.crownOpenness / 100,
        blossom_bias: controls.blossomBias / 100,
        trunk_primary_sweep: Math.min(1, (controls.trunkMovement + 8) / 100),
        ramification: Math.min(1, (controls.branchDensity + controls.blossomBias) / 200),
    },
    constraints: {
        maxNodes: 170,
        maxSteps: controls.stage === 'seedling' ? 14 : (controls.stage === 'mid' ? 22 : 34),
        maxDepth: controls.stage === 'seedling' ? 5 : 9,
        bounds: {
            width: 520,
            height: 430,
            depth: 430,
        },
    },
    options: {
        traceLevel: 'compact',
        engineVersion: 3,
    },
});

const runVNextLabEngine = (controls = DEFAULT_CONTROLS) => runZenBonsaiEngineVNext(buildVNextLabInput(controls));

const summarizeResult = (result = null) => ({
    nodes: result?.diagnostics?.nodeCount ?? 0,
    claims: result?.diagnostics?.selectedClaimCount ?? 0,
    claimedAttractors: result?.diagnostics?.claimedAttractorCount ?? 0,
    attractors: result?.diagnostics?.attractorCount ?? 0,
    complexity: Math.round(toNumber(result?.features?.branchComplexity, 0) * 100),
    negativeSpace: Math.round(toNumber(result?.features?.negativeSpaceScore, 0) * 100),
});

const buildPresetControls = (controls = DEFAULT_CONTROLS, preset = PRESET_OPTIONS[0]) => ({
    ...controls,
    ...(preset?.controls || {}),
});

const serializeClaimLedgerExport = ({
    controls,
    result,
    presetComparisons,
} = {}) => JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    engine: {
        family: 'zen_bonsai_vnext',
        engineVersion: 3,
    },
    controls,
    input: buildVNextLabInput(controls),
    diagnostics: result?.diagnostics || null,
    features: result?.features || null,
    attractors: result?.renderScene?.attractors || [],
    claims: result?.renderScene?.claims || [],
    claimCompetition: {
        selectedClaimCount: result?.diagnostics?.selectedClaimCount ?? 0,
        rejectedClaimCount: result?.diagnostics?.rejectedClaimCount ?? 0,
        actionCounts: result?.diagnostics?.actionCounts || {},
    },
    presetComparison: (presetComparisons || []).map((entry) => ({
        id: entry.id,
        controls: entry.controls,
        summary: entry.summary,
    })),
}, null, 2);

const formatMetricValue = (metricId, result = null) => {
    switch (metricId) {
        case 'nodes':
            return result?.diagnostics?.nodeCount ?? 0;
        case 'claims':
            return result?.diagnostics?.selectedClaimCount ?? 0;
        case 'attractors':
            return `${result?.diagnostics?.claimedAttractorCount ?? 0}/${result?.diagnostics?.attractorCount ?? 0}`;
        case 'complexity':
            return `${Math.round(toNumber(result?.features?.branchComplexity, 0) * 100)}%`;
        case 'negative_space':
            return `${Math.round(toNumber(result?.features?.negativeSpaceScore, 0) * 100)}%`;
        default:
            return '-';
    }
};

const resolveCanvasTransform = (canvas, scene) => {
    const width = canvas.width;
    const height = canvas.height;
    const bounds = scene?.bounds || { width: 420, height: 420 };
    const marginX = 52;
    const marginY = 42;
    const scale = Math.min(
        (width - (marginX * 2)) / Math.max(1, toNumber(bounds.width, 420)),
        (height - (marginY * 2)) / Math.max(1, toNumber(bounds.height, 420)),
    );
    return {
        x: (value) => (width * 0.5) + (toNumber(value, 0) * scale),
        y: (value) => height - marginY - (toNumber(value, 0) * scale),
        scale,
    };
};

const drawAttractor = (ctx, transform, attractor) => {
    const style = CLAIM_KIND_STYLE[attractor.kind] || CLAIM_KIND_STYLE.space;
    const x = transform.x(attractor.position?.[0]);
    const y = transform.y(attractor.position?.[1]);
    const radius = Math.max(5, Math.min(34, toNumber(attractor.radius, 20) * transform.scale * 0.18));
    ctx.save();
    ctx.setLineDash(attractor.kind === 'void' ? [6, 5] : []);
    ctx.fillStyle = style.fill;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = attractor.claimedBy ? 2.2 : 1.1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
};

const drawSegment = (ctx, transform, segment) => {
    const order = Math.max(0, Math.floor(toNumber(segment.order, 0)));
    const isDeadwood = segment.role === 'deadwood';
    const isTrunk = order === 0;
    const width = Math.max(
        1.1,
        ((toNumber(segment.radius0, 0.3) + toNumber(segment.radius1, 0.3)) * 0.5) * transform.scale * 0.62,
    );
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    if (isDeadwood) {
        ctx.strokeStyle = '#9b8a75';
    } else if (isTrunk) {
        ctx.strokeStyle = '#5f4634';
    } else if (order === 1) {
        ctx.strokeStyle = '#6f513c';
    } else {
        ctx.strokeStyle = '#85634a';
    }
    ctx.beginPath();
    ctx.moveTo(transform.x(segment.p0?.[0]), transform.y(segment.p0?.[1]));
    ctx.lineTo(transform.x(segment.p1?.[0]), transform.y(segment.p1?.[1]));
    ctx.stroke();
    if (isTrunk && width > 4) {
        ctx.strokeStyle = 'rgba(255,248,229,0.22)';
        ctx.lineWidth = Math.max(0.8, width * 0.18);
        ctx.beginPath();
        ctx.moveTo(transform.x(segment.p0?.[0]) - width * 0.18, transform.y(segment.p0?.[1]));
        ctx.lineTo(transform.x(segment.p1?.[0]) - width * 0.18, transform.y(segment.p1?.[1]));
        ctx.stroke();
    }
    ctx.restore();
};

const drawTerminal = (ctx, transform, terminal) => {
    const x = transform.x(terminal.position?.[0]);
    const y = transform.y(terminal.position?.[1]);
    ctx.save();
    ctx.fillStyle = terminal.flower ? '#d98aa8' : '#6a9b6f';
    ctx.strokeStyle = terminal.flower ? 'rgba(130,47,74,0.45)' : 'rgba(43,92,50,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, terminal.flower ? 4.5 : 3.5, terminal.flower ? 3.2 : 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
};

const drawVNextScene = (canvas, scene) => {
    if (!canvas || !scene) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(720, Math.floor(rect.width * dpr));
    const height = Math.max(420, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#f7f2ea');
    bg.addColorStop(0.52, '#edf3ee');
    bg.addColorStop(1, '#e8edf5');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const transform = resolveCanvasTransform(canvas, scene);
    ctx.save();
    ctx.strokeStyle = 'rgba(80,91,106,0.14)';
    ctx.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
        const y = transform.y((scene.bounds.height / 4) * index);
        ctx.beginPath();
        ctx.moveTo(38, y);
        ctx.lineTo(width - 38, y);
        ctx.stroke();
    }
    ctx.restore();

    (scene.attractors || []).forEach((attractor) => drawAttractor(ctx, transform, attractor));
    [...(scene.woodSegments || [])]
        .sort((left, right) => toNumber(left.order, 0) - toNumber(right.order, 0))
        .forEach((segment) => drawSegment(ctx, transform, segment));
    (scene.terminals || []).forEach((terminal) => drawTerminal(ctx, transform, terminal));
};

function ControlSlider({
    label,
    value,
    onChange,
}) {
    return (
        <label className="min-w-0 rounded-[8px] border border-on-surface/10 bg-surface/80 px-3 py-2 shadow-sm">
            <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-semibold text-on-surface-muted">{label}</span>
                <span className="text-[11px] font-bold tabular-nums text-on-surface">{value}%</span>
            </span>
            <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(event) => onChange(pct(event.target.value))}
                className="mt-2 h-2 w-full accent-accent"
            />
        </label>
    );
}

export default function ZenBonsaiVNextGrowthLab({ isActive = false }) {
    const { t } = useAppTranslation('tools');
    const canvasRef = useRef(null);
    const [controls, setControls] = useState(DEFAULT_CONTROLS);
    const [activePresetId, setActivePresetId] = useState(DEFAULT_PRESET_ID);
    const [copyState, setCopyState] = useState('idle');
    const result = useMemo(() => runVNextLabEngine(controls), [controls]);
    const selectedClaims = result?.renderScene?.claims || [];
    const presetComparisons = useMemo(() => PRESET_OPTIONS.map((preset) => {
        const presetControls = buildPresetControls({
            ...DEFAULT_CONTROLS,
            seed: controls.seed,
            stage: controls.stage,
        }, preset);
        const presetResult = runVNextLabEngine(presetControls);
        return {
            id: preset.id,
            controls: presetControls,
            summary: summarizeResult(presetResult),
        };
    }), [controls.seed, controls.stage]);

    const setControl = useCallback((key, value) => {
        setControls((current) => ({
            ...current,
            [key]: value,
        }));
        if (['trunkMovement', 'branchDensity', 'crownOpenness', 'blossomBias'].includes(key)) {
            setActivePresetId(CUSTOM_PRESET_ID);
        }
    }, []);
    const handlePresetApply = useCallback((presetId) => {
        const preset = PRESET_OPTIONS.find((entry) => entry.id === presetId);
        if (!preset) return;
        setControls((current) => buildPresetControls(current, preset));
        setActivePresetId(presetId);
    }, []);
    const handleRandomize = useCallback(() => {
        setControls((current) => {
            const nextSeed = advanceSeed(current.seed);
            return {
                ...current,
                seed: nextSeed,
                trunkMovement: 34 + (nextSeed % 56),
                branchDensity: 32 + ((nextSeed >> 3) % 54),
                crownOpenness: 36 + ((nextSeed >> 5) % 54),
                blossomBias: 28 + ((nextSeed >> 7) % 62),
            };
        });
        setActivePresetId(CUSTOM_PRESET_ID);
    }, []);
    const handleReset = useCallback(() => {
        setControls(DEFAULT_CONTROLS);
        setActivePresetId(DEFAULT_PRESET_ID);
    }, []);
    const handleCopyLedger = useCallback(async () => {
        try {
            if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
                throw new Error('ZEN_VNEXT_CLAIM_LEDGER_CLIPBOARD_UNAVAILABLE');
            }
            await navigator.clipboard.writeText(serializeClaimLedgerExport({
                controls,
                result,
                presetComparisons,
            }));
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    }, [controls, presetComparisons, result]);

    useEffect(() => {
        drawVNextScene(canvasRef.current, result?.renderScene);
    }, [result]);
    useEffect(() => {
        if (copyState === 'idle' || typeof window === 'undefined') {
            return undefined;
        }
        const timeoutId = window.setTimeout(() => {
            setCopyState('idle');
        }, 1800);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [copyState]);
    useEffect(() => {
        if (!isActive || typeof window === 'undefined') {
            return undefined;
        }
        const handleResize = () => drawVNextScene(canvasRef.current, result?.renderScene);
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [isActive, result]);

    return (
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
                <div className="rounded-[8px] border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="min-w-[8rem] flex-1">
                            <span className="text-[10px] font-semibold uppercase text-on-surface-muted">
                                {t('experiment.vnext_growth_lab.seed')}
                            </span>
                            <input
                                type="number"
                                value={controls.seed}
                                onChange={(event) => setControl('seed', Math.max(0, Math.floor(toNumber(event.target.value, 0))))}
                                className="mt-1 h-9 w-full rounded-[8px] border border-on-surface/10 bg-surface-sunken/60 px-2 text-xs font-semibold tabular-nums text-on-surface outline-hidden focus:border-accent/40"
                            />
                        </label>
                        <label className="min-w-[8rem] flex-1">
                            <span className="text-[10px] font-semibold uppercase text-on-surface-muted">
                                {t('experiment.vnext_growth_lab.stage')}
                            </span>
                            <select
                                value={controls.stage}
                                onChange={(event) => setControl('stage', event.target.value)}
                                className="mt-1 h-9 w-full rounded-[8px] border border-on-surface/10 bg-surface-sunken/60 px-2 text-xs font-semibold text-on-surface outline-hidden focus:border-accent/40"
                            >
                                {STAGE_OPTIONS.map((stage) => (
                                    <option key={stage} value={stage}>
                                        {t(STAGE_COPY_KEYS[stage])}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={handleRandomize}
                            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-accent px-3 text-[11px] font-semibold text-on-accent shadow-sm transition-colors hover:opacity-90"
                        >
                            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('experiment.vnext_growth_lab.randomize')}
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-surface-sunken px-3 text-[11px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface"
                        >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('experiment.vnext_growth_lab.reset')}
                        </button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <ControlSlider
                            label={t('experiment.vnext_growth_lab.controls.trunk_movement')}
                            value={controls.trunkMovement}
                            onChange={(value) => setControl('trunkMovement', value)}
                        />
                        <ControlSlider
                            label={t('experiment.vnext_growth_lab.controls.branch_density')}
                            value={controls.branchDensity}
                            onChange={(value) => setControl('branchDensity', value)}
                        />
                        <ControlSlider
                            label={t('experiment.vnext_growth_lab.controls.crown_openness')}
                            value={controls.crownOpenness}
                            onChange={(value) => setControl('crownOpenness', value)}
                        />
                        <ControlSlider
                            label={t('experiment.vnext_growth_lab.controls.blossom_bias')}
                            value={controls.blossomBias}
                            onChange={(value) => setControl('blossomBias', value)}
                        />
                    </div>
                </div>
                <div className="grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-5">
                        {METRIC_KEYS.map((metricId) => (
                            <div
                                key={metricId}
                                className="rounded-[8px] border border-on-surface/10 bg-surface/85 px-3 py-2 shadow-sm"
                            >
                                <div className="truncate text-[10px] font-semibold uppercase text-on-surface-muted">
                                    {t(METRIC_COPY_KEYS[metricId])}
                                </div>
                                <div className="mt-1 text-lg font-bold tabular-nums text-on-surface">
                                    {formatMetricValue(metricId, result)}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-[8px] border border-on-surface/10 bg-surface/85 p-2 shadow-sm">
                        <div className="mb-2 px-1 text-[10px] font-semibold uppercase text-on-surface-muted">
                            {t('experiment.vnext_growth_lab.preset_compare')}
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                            {presetComparisons.map((entry) => {
                                const isActivePreset = activePresetId === entry.id;
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => handlePresetApply(entry.id)}
                                        className={`min-w-0 rounded-[8px] border px-3 py-2 text-left transition-colors ${
                                            isActivePreset
                                                ? 'border-accent/55 bg-accent/10'
                                                : 'border-on-surface/10 bg-surface-sunken/45 hover:border-accent/35'
                                        }`}
                                    >
                                        <span className="block truncate text-[11px] font-bold text-on-surface">
                                            {t(PRESET_COPY_KEYS[entry.id])}
                                        </span>
                                        <span className="mt-2 grid grid-cols-2 gap-1">
                                            <span className="min-w-0">
                                                <span className="block truncate text-[9px] font-semibold uppercase text-on-surface-muted">
                                                    {t(METRIC_COPY_KEYS.claims)}
                                                </span>
                                                <span className="block text-[12px] font-bold tabular-nums text-on-surface">
                                                    {entry.summary.claims}
                                                </span>
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-[9px] font-semibold uppercase text-on-surface-muted">
                                                    {t(METRIC_COPY_KEYS.negative_space)}
                                                </span>
                                                <span className="block text-[12px] font-bold tabular-nums text-on-surface">
                                                    {entry.summary.negativeSpace}%
                                                </span>
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.75fr)]">
                <div className="min-h-0 overflow-hidden rounded-[8px] border border-on-surface/10 bg-surface/85 shadow-sm">
                    <canvas
                        ref={canvasRef}
                        className="block h-full min-h-[420px] w-full"
                    />
                </div>
                <div className="min-h-0 overflow-hidden rounded-[8px] border border-on-surface/10 bg-surface/85 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-on-surface/10 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase text-on-surface-muted">
                            {t('experiment.vnext_growth_lab.claims')}
                        </span>
                        {copyState !== 'idle' && (
                            <span className="text-[10px] font-semibold text-on-surface-muted">
                                {t(COPY_STATE_COPY_KEYS[copyState])}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleCopyLedger}
                            title={t('experiment.vnext_growth_lab.copy_ledger')}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[8px] bg-surface-sunken px-2 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface"
                        >
                            {copyState === 'copied' ? (
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {t('experiment.vnext_growth_lab.copy_ledger')}
                        </button>
                    </div>
                    <div className="h-full min-h-0 overflow-auto p-2">
                        {selectedClaims.slice(0, 14).map((claim) => {
                            const style = CLAIM_KIND_STYLE[claim.kind] || CLAIM_KIND_STYLE.space;
                            return (
                                <div
                                    key={`${claim.budId}:${claim.attractorId}`}
                                    className="mb-2 rounded-[8px] border border-on-surface/10 bg-surface-sunken/45 px-3 py-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: style.stroke }}
                                        />
                                        <span className="truncate text-[11px] font-semibold text-on-surface">
                                            {t(CLAIM_KIND_COPY_KEYS[claim.kind] || CLAIM_KIND_COPY_KEYS.space)}
                                        </span>
                                        <span className="ml-auto text-[10px] font-semibold tabular-nums text-on-surface-muted">
                                            {Math.round(toNumber(claim.score, 0) * 100)}
                                        </span>
                                    </div>
                                    <div className="mt-1 truncate text-[10px] text-on-surface-muted">
                                        {claim.phase} / {claim.attractorId}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
