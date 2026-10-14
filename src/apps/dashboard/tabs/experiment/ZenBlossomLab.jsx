import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useToast } from '@/ui-kit';
import {
    createAssetCache,
    DEFAULT_SAKURA_BLOSSOM_LAB_TUNING,
    SAKURA_BLOSSOM_LAB_TUNING_DEFS,
    ZEN_ASSET_CACHE_VERSION,
    compileSakuraPhenotypeFromLatent,
    createSakuraBlossomPreviewSample,
    persistSakuraBlossomLabTuning,
    readSakuraBlossomLabTuning,
    sanitizeSakuraBlossomLabTuning,
    useZenBonsaiActiveProfileState,
} from '@/themes/plugins/zen/api';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SLIDER_ORDER = [
    'openness_bias',
    'petal_length_scale',
    'petal_width_scale',
    'core_size_gain',
    'notch_depth_gain',
    'warmth_bias',
];

const SLIDER_COPY_KEYS = Object.freeze({
    openness_bias: { label: 'experiment.blossom_lab.sliders.openness_bias.label', hint: 'experiment.blossom_lab.sliders.openness_bias.hint' },
    petal_length_scale: { label: 'experiment.blossom_lab.sliders.petal_length_scale.label', hint: 'experiment.blossom_lab.sliders.petal_length_scale.hint' },
    petal_width_scale: { label: 'experiment.blossom_lab.sliders.petal_width_scale.label', hint: 'experiment.blossom_lab.sliders.petal_width_scale.hint' },
    petal_count: { label: 'experiment.blossom_lab.sliders.petal_count.label', hint: 'experiment.blossom_lab.sliders.petal_count.hint' },
    layers: { label: 'experiment.blossom_lab.sliders.layers.label', hint: 'experiment.blossom_lab.sliders.layers.hint' },
    ruffle_gain: { label: 'experiment.blossom_lab.sliders.ruffle_gain.label', hint: 'experiment.blossom_lab.sliders.ruffle_gain.hint' },
    core_size_gain: { label: 'experiment.blossom_lab.sliders.core_size_gain.label', hint: 'experiment.blossom_lab.sliders.core_size_gain.hint' },
    inner_scale_gain: { label: 'experiment.blossom_lab.sliders.inner_scale_gain.label', hint: 'experiment.blossom_lab.sliders.inner_scale_gain.hint' },
    notch_depth_gain: { label: 'experiment.blossom_lab.sliders.notch_depth_gain.label', hint: 'experiment.blossom_lab.sliders.notch_depth_gain.hint' },
    translucency_gain: { label: 'experiment.blossom_lab.sliders.translucency_gain.label', hint: 'experiment.blossom_lab.sliders.translucency_gain.hint' },
    stamen_burst_gain: { label: 'experiment.blossom_lab.sliders.stamen_burst_gain.label', hint: 'experiment.blossom_lab.sliders.stamen_burst_gain.hint' },
    warmth_bias: { label: 'experiment.blossom_lab.sliders.warmth_bias.label', hint: 'experiment.blossom_lab.sliders.warmth_bias.hint' },
});

const PREVIEW_STAGE_OPTIONS = Object.freeze([
    { id: 'auto', labelKey: 'experiment.blossom_lab.preview_stage_auto' },
    { id: 'bud', labelKey: 'experiment.blossom_lab.preview_stage_bud' },
    { id: 'half_open', labelKey: 'experiment.blossom_lab.preview_stage_half_open' },
    { id: 'full', labelKey: 'experiment.blossom_lab.preview_stage_full' },
]);

const PREVIEW_FACING_COPY_KEYS = Object.freeze({
    preview_yaw: {
        label: 'experiment.blossom_lab.preview_controls.preview_yaw.label',
        hint: 'experiment.blossom_lab.preview_controls.preview_yaw.hint',
    },
    preview_pitch: {
        label: 'experiment.blossom_lab.preview_controls.preview_pitch.label',
        hint: 'experiment.blossom_lab.preview_controls.preview_pitch.hint',
    },
});

const drawPreview = (canvas, sprite, sample) => {
    if (!canvas) {
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#f8f3ec');
    bg.addColorStop(0.52, '#efe6db');
    bg.addColorStop(1, '#e0d1c1');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.46)';
    ctx.fillRect(22, 22, width - 44, height - 44);

    ctx.strokeStyle = 'rgba(109,84,68,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, 42);
    ctx.lineTo(width * 0.5, height - 42);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(width * 0.26, height * 0.5);
    const floor = ctx.createRadialGradient(0, 8, 8, 0, 18, 90);
    floor.addColorStop(0, 'rgba(113,74,67,0.18)');
    floor.addColorStop(0.72, 'rgba(113,74,67,0.06)');
    floor.addColorStop(1, 'rgba(113,74,67,0)');
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.ellipse(0, 22, 86, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(sprite, -72, -72, 144, 144);
    ctx.restore();

    ctx.save();
    ctx.translate(width * 0.74, height * 0.68);
    const branchGradient = ctx.createLinearGradient(-120, -50, 40, 10);
    branchGradient.addColorStop(0, '#5c4036');
    branchGradient.addColorStop(1, '#7a5a4b');
    ctx.strokeStyle = branchGradient;
    ctx.lineCap = 'round';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(-122, 46);
    ctx.quadraticCurveTo(-56, 16, -12, -42);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(110,84,67,0.72)';
    ctx.beginPath();
    ctx.moveTo(-96, 38);
    ctx.quadraticCurveTo(-48, 10, -10, -38);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(122,101,79,0.55)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-14, -36);
    ctx.quadraticCurveTo(8, -28, 20, -12);
    ctx.stroke();

    ctx.save();
    ctx.translate(28, -4);
    ctx.rotate((sample?.angle || 0) + (Number(sample?.blossom?.tilt) || 0));
    const floorSmall = ctx.createRadialGradient(0, 10, 8, 0, 18, 56);
    floorSmall.addColorStop(0, 'rgba(113,74,67,0.16)');
    floorSmall.addColorStop(1, 'rgba(113,74,67,0)');
    ctx.fillStyle = floorSmall;
    ctx.beginPath();
    ctx.ellipse(0, 18, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(sprite, -46, -46, 92, 92);
    ctx.restore();
    ctx.restore();
};

export default function ZenBlossomLab() {
    const { t } = useAppTranslation('tools');
    const toast = useToast();
    const canvasRef = useRef(null);
    const assetCache = useMemo(() => createAssetCache(), [ZEN_ASSET_CACHE_VERSION]);
    const activeProfile = useZenBonsaiActiveProfileState();
    const [appliedTuning, setAppliedTuning] = useState(() => readSakuraBlossomLabTuning());
    const [draftTuning, setDraftTuning] = useState(() => readSakuraBlossomLabTuning());
    const [previewStage, setPreviewStage] = useState('auto');
    const [previewYaw, setPreviewYaw] = useState(0);
    const [previewPitch, setPreviewPitch] = useState(0);

    const phenotype = useMemo(
        () => compileSakuraPhenotypeFromLatent(activeProfile.sakuraV2Latent),
        [activeProfile.sakuraV2Latent],
    );
    const previewFlower = useMemo(
        () => {
            const sample = createSakuraBlossomPreviewSample({
                gene: phenotype,
                tuning: draftTuning,
                seed: 4171,
                context: 'canopy',
            });
            return {
                ...sample,
                blossom: {
                    ...sample.blossom,
                    ...(previewStage !== 'auto' ? { bloomStage: previewStage } : {}),
                    facingYaw: Number(previewYaw.toFixed(3)),
                    facingPitch: Number(previewPitch.toFixed(3)),
                },
            };
        },
        [draftTuning, phenotype, previewPitch, previewStage, previewYaw],
    );

    useEffect(() => {
        const sprite = assetCache.resolveFlowerSprite(previewFlower);
        drawPreview(canvasRef.current, sprite, previewFlower);
    }, [assetCache, previewFlower]);

    const dirty = useMemo(() => (
        JSON.stringify(sanitizeSakuraBlossomLabTuning(draftTuning))
        !== JSON.stringify(sanitizeSakuraBlossomLabTuning(appliedTuning))
    ), [appliedTuning, draftTuning]);

    const handleSliderChange = (key, rawValue) => {
        const def = SAKURA_BLOSSOM_LAB_TUNING_DEFS[key];
        if (!def) {
            return;
        }
        const numeric = Number(rawValue);
        const normalized = def.integer
            ? Math.round(clamp(numeric, def.min, def.max))
            : Number(clamp(numeric, def.min, def.max).toFixed(3));
        setDraftTuning((current) => ({
            ...current,
            [key]: normalized,
        }));
    };

    const handleApply = () => {
        const persisted = persistSakuraBlossomLabTuning(draftTuning);
        setAppliedTuning(persisted);
        toast.success(t('experiment.blossom_lab.toast_applied'), { dedupeKey: 'zen-blossom-lab-applied' });
    };

    const handleReset = () => {
        setDraftTuning({ ...DEFAULT_SAKURA_BLOSSOM_LAB_TUNING });
    };

    const handleRevert = () => {
        setDraftTuning({ ...appliedTuning });
    };

    return (
        <div className="grid h-full min-h-0 min-w-0 grid-cols-1 gap-4 overflow-y-auto pr-1 xl:overflow-hidden xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
            <section className="flex min-h-[420px] flex-col rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,#fdfaf6_0%,#f4ece2_100%)] p-4 shadow-[0_24px_70px_rgba(77,49,35,0.10)] xl:min-h-0">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                            {t('experiment.blossom_lab.preview_eyebrow')}
                        </p>
                        <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-stone-800">
                            {t('experiment.blossom_lab.preview_title')}
                        </h3>
                        <p className="mt-1 max-w-xl text-[12px] leading-5 text-stone-600">
                            {t('experiment.blossom_lab.preview_desc')}
                        </p>
                    </div>
                    <div className="rounded-full border border-stone-300/80 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-stone-600">
                        {dirty ? t('experiment.blossom_lab.pending_badge') : t('experiment.blossom_lab.applied_badge')}
                    </div>
                </div>
                <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-[24px] border border-white/70 bg-white/35 p-3 xl:min-h-0">
                    <canvas
                        ref={canvasRef}
                        width={460}
                        height={460}
                        className="h-full w-full max-h-[460px] max-w-[460px] rounded-[22px]"
                    />
                </div>
                <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                        {t('experiment.blossom_lab.preview_stage_label')}
                    </span>
                    <div className="inline-flex rounded-full border border-stone-200 bg-white/80 p-1">
                        {PREVIEW_STAGE_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => setPreviewStage(option.id)}
                                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                                    previewStage === option.id
                                        ? 'bg-[#2D4F1E] text-white'
                                        : 'text-stone-600 hover:bg-stone-100'
                                }`}
                            >
                                {t(option.labelKey)}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="flex min-h-[420px] flex-col rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_20px_60px_rgba(57,39,27,0.08)] xl:min-h-0">
                <div className="mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                        {t('experiment.blossom_lab.controls_eyebrow')}
                    </p>
                    <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-stone-800">
                        {t('experiment.blossom_lab.controls_title')}
                    </h3>
                    <p className="mt-1 text-[12px] leading-5 text-stone-600">
                        {t('experiment.blossom_lab.controls_desc')}
                    </p>
                </div>
                <div className="mb-3 grid grid-cols-1 gap-3">
                    {Object.entries(PREVIEW_FACING_COPY_KEYS).map(([key, copy]) => {
                        const value = key === 'preview_yaw' ? previewYaw : previewPitch;
                        return (
                            <label key={key} className="rounded-2xl border border-stone-200 bg-stone-50/75 px-3 py-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <div>
                                        <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-stone-800">
                                            {t(copy.label)}
                                        </span>
                                        <span className="block text-[11px] text-stone-500">
                                            {t(copy.hint)}
                                        </span>
                                    </div>
                                    <span className="rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[11px] font-bold text-stone-700">
                                        {value.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={-1}
                                    max={1}
                                    step={0.01}
                                    value={value}
                                    onChange={(event) => {
                                        const numeric = Number(event.target.value);
                                        if (key === 'preview_yaw') {
                                            setPreviewYaw(numeric);
                                            return;
                                        }
                                        setPreviewPitch(numeric);
                                    }}
                                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-linear-to-r/srgb from-sky-200 via-stone-200 to-amber-200 accent-stone-700"
                                />
                            </label>
                        );
                    })}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-3">
                        {SLIDER_ORDER.map((key) => {
                            const def = SAKURA_BLOSSOM_LAB_TUNING_DEFS[key];
                            const copyKeys = SLIDER_COPY_KEYS[key];
                            const value = draftTuning[key];
                            const display = def.integer ? String(Math.round(value)) : Number(value).toFixed(2);
                            return (
                                <label key={key} className="rounded-2xl border border-stone-200 bg-stone-50/75 px-3 py-3">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <div>
                                            <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-stone-800">
                                                {t(copyKeys.label)}
                                            </span>
                                            <span className="block text-[11px] text-stone-500">
                                                {t(copyKeys.hint)}
                                            </span>
                                        </div>
                                        <span className="rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[11px] font-bold text-stone-700">
                                            {display}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={def.min}
                                        max={def.max}
                                        step={def.step}
                                        value={value}
                                        onChange={(event) => handleSliderChange(key, event.target.value)}
                                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-linear-to-r/srgb from-rose-200 via-stone-200 to-emerald-200 accent-rose-500"
                                    />
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2">
                    <button
                        onClick={handleApply}
                        className="rounded-xl bg-[#2D4F1E] px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white hover:bg-[#223d18]"
                    >
                        {t('experiment.blossom_lab.apply')}
                    </button>
                    <button
                        onClick={handleRevert}
                        disabled={!dirty}
                        className={`rounded-xl border px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] ${
                            dirty
                                ? 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                                : 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                        }`}
                    >
                        {t('experiment.blossom_lab.revert')}
                    </button>
                    <button
                        onClick={handleReset}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-100"
                    >
                        {t('experiment.blossom_lab.reset')}
                    </button>
                    <p className="ml-auto text-[11px] text-stone-500">
                        {t('experiment.blossom_lab.apply_hint')}
                    </p>
                </div>
            </section>
        </div>
    );
}
