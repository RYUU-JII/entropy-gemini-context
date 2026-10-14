import { useState } from 'react';

import {
    LATENT_STYLE_PRESETS_BY_AXIS,
    LATENT_CONTROL_SECTIONS,
    resolveLatentSliderStep,
} from '../../../model/ZenLatentControlsConfig';
import {
    SAKURA_CANONICAL_LATENT_DEFS,
} from '../../../model/v2/SakuraLatentSchema';
import {
    DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
    ZEN_HOME_GARDEN_BED_MATERIAL_STYLES,
} from '../../../model/bonsai/rendering/zenHomeGardenBedGeometry.js';

export function resolveLatentControlDisplayState(controlKey, latentState) {
    const def = SAKURA_CANONICAL_LATENT_DEFS?.[controlKey] || {};
    const min = Number.isFinite(Number(def.min)) ? Number(def.min) : 0;
    const max = Number.isFinite(Number(def.max)) ? Number(def.max) : 1;
    const step = resolveLatentSliderStep(controlKey);
    const rawValue = Number(latentState?.[controlKey]);
    const safeValue = Number.isFinite(rawValue)
        ? rawValue
        : (Number.isFinite(Number(def.default)) ? Number(def.default) : min);
    return {
        min,
        max,
        step,
        sliderValue: def.integer ? Math.round(safeValue) : safeValue,
        displayDigits: def.integer ? 0 : (step >= 0.1 ? 1 : 2),
    };
}

const PANEL_TABS = Object.freeze({
    SHAPE: 'shape',
    GROWTH: 'growth',
});

const GARDEN_BED_MATERIAL_OPTIONS = Object.freeze([
    { id: ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.GLAZED_CERAMIC, label: 'Glazed ceramic' },
    { id: ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.POLISHED_GRANITE, label: 'Polished granite' },
    { id: ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.CHARRED_WOOD, label: 'Charred wood' },
    { id: ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.WET_SLATE, label: 'Wet slate' },
]);

const formatPercentValue = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric) : 0;
};

const formatDayValue = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : 1;
};

function ZenGrowthLabSlider({
    label,
    value,
    min = 0,
    max = 100,
    suffix = '%',
    disabled = false,
    onChange,
}) {
    const safeValue = suffix === 'd' ? formatDayValue(value) : formatPercentValue(value);
    return (
        <label className={`block rounded-lg border border-stone-200 bg-white/70 px-2 py-1.5 ${disabled ? 'opacity-55' : ''}`}>
            <span className="flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">
                <span className="truncate">{label}</span>
                <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[7px] tabular-nums">
                    {safeValue}{suffix}
                </span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step="1"
                value={safeValue}
                disabled={disabled}
                aria-label={label}
                onChange={(event) => onChange?.(Number(event.target.value))}
                className="mt-1.5 h-1.5 w-full accent-[#2D4F1E]"
            />
        </label>
    );
}

function ZenLatentShapeControlContent({
    latentState,
    activeLatentPresetIds,
    onApplyLatentAxisPreset,
    onBranchDetailControlChange,
}) {
    return (
        <>
            <div className="rounded-lg border border-[#EAE8E3] bg-stone-100/55 px-2 py-2">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-700">
                    Latent Detail Controls
                </p>
                <p className="mt-1 text-[8px] font-semibold text-stone-500">
                    최소 컨트롤: Trunk / Scaffold / Twig
                </p>
                <p className="mt-2 text-[8px] font-semibold text-stone-500">
                    Preset은 현재 섹션의 latent 값만 덮어씁니다.
                </p>
            </div>

            {LATENT_CONTROL_SECTIONS.map((section) => {
                const presetAxisId = section.presetAxisId || section.id;
                const sectionPresets = Array.isArray(LATENT_STYLE_PRESETS_BY_AXIS?.[presetAxisId])
                    ? LATENT_STYLE_PRESETS_BY_AXIS[presetAxisId]
                    : [];
                return (
                    <div
                        key={section.id}
                        className={`rounded-lg border px-2 py-2 ${section.toneClass}`}
                    >
                        <p className="text-[9px] font-black uppercase tracking-[0.12em]">
                            {section.label}
                        </p>
                        {sectionPresets.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {sectionPresets.map((preset) => (
                                    <button
                                        key={`${presetAxisId}_${preset.id}`}
                                        type="button"
                                        onClick={() => onApplyLatentAxisPreset?.(presetAxisId, preset.id)}
                                        className={`h-5 rounded-md border px-1.5 text-[7px] font-black uppercase tracking-[0.11em] ${activeLatentPresetIds?.[presetAxisId] === preset.id
                                            ? 'border-[#2D4F1E] bg-[#2D4F1E] text-white'
                                            : 'border-white/80 bg-white/70 text-stone-700 hover:bg-white'
                                            }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="mt-2 space-y-1.5">
                            {section.controls.map((control) => {
                                const {
                                    min,
                                    max,
                                    step,
                                    sliderValue,
                                    displayDigits,
                                } = resolveLatentControlDisplayState(control.key, latentState);
                                return (
                                    <label
                                        key={control.key}
                                        className="flex flex-col gap-1 text-[8px] font-black uppercase tracking-[0.12em]"
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span>{control.label}</span>
                                            <span className="rounded-full border border-white/70 bg-white/70 px-1.5 py-0.5 text-[7px]">
                                                {sliderValue.toFixed(displayDigits)}
                                            </span>
                                        </span>
                                        <input
                                            type="range"
                                            min={min}
                                            max={max}
                                            step={step}
                                            value={sliderValue}
                                            onChange={(event) => onBranchDetailControlChange?.(control.key, event.target.value)}
                                            className={`h-1.5 w-full ${section.sliderClass}`}
                                        />
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </>
    );
}

function ZenGrowthMemoryControlContent({
    controls,
    gardenBedMaterialStyle,
    onGardenBedMaterialStyleChange,
}) {
    const enabled = controls?.enabled === true;
    const maxDays = Math.max(1, Number(controls?.maxDays) || 84);
    const phaseLabel = controls?.phaseId === 'mature'
        ? 'Mature'
        : (controls?.phaseId === 'juvenile' ? 'Juvenile' : 'Seedling');
    const scenarios = Array.isArray(controls?.scenarios) ? controls.scenarios : [];
    return (
        <>
            <div className="flex items-center gap-1.5 border-b border-stone-900/10 px-1 pb-2">
                <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#2D4F1E]">
                        Lifecycle input
                    </p>
                    <p className="mt-0.5 text-[8px] font-semibold text-stone-500">
                        Render-only fixture · ledger untouched
                    </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] ${enabled
                    ? 'border-[#829177]/30 bg-[#EDF1E9] text-[#52634A]'
                    : 'border-stone-200 bg-white text-stone-500'
                }`}>
                    {enabled ? `${phaseLabel} · Virtual` : 'Live'}
                </span>
                <button
                    type="button"
                    onClick={controls?.onRandomize}
                    aria-label="Randomize lifecycle fixture"
                    className="ml-auto h-6 shrink-0 rounded-md border border-[#9F6D31]/20 bg-[#FFF8EA] px-1.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#7A4D15] hover:bg-[#FFF0CF]"
                >
                    Random
                </button>
                <button
                    type="button"
                    onClick={controls?.onReset}
                    aria-label="Reset lifecycle fixture"
                    className="h-6 shrink-0 rounded-md border border-stone-200 bg-white px-1.5 text-[7px] font-black uppercase tracking-[0.08em] text-stone-500 hover:bg-stone-50"
                >
                    Reset
                </button>
            </div>

            <div className="px-1 pt-0.5">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-600">
                    Scenario
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                    {scenarios.map((scenario) => (
                        <button
                            key={scenario.id}
                            type="button"
                            onClick={() => controls?.onScenarioSelect?.(scenario.id)}
                            aria-pressed={controls?.scenarioId === scenario.id}
                            className={`h-5 rounded-md border px-1.5 text-[7px] font-black uppercase tracking-[0.1em] ${controls?.scenarioId === scenario.id
                                ? 'border-[#2D4F1E] bg-[#2D4F1E] text-white'
                                : 'border-stone-200 bg-white/80 text-stone-700 hover:bg-white'
                                }`}
                        >
                            {scenario.label}
                        </button>
                    ))}
                </div>
            </div>

            <label className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E0D6] bg-white/70 px-2 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] text-stone-600">
                <span>Garden bed</span>
                <select
                    value={gardenBedMaterialStyle || DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE}
                    onChange={(event) => onGardenBedMaterialStyleChange?.(event.target.value)}
                    aria-label="Garden bed material"
                    className="min-w-0 max-w-[148px] bg-transparent text-right text-[8px] font-black normal-case tracking-normal text-[#314438] outline-hidden"
                >
                    {GARDEN_BED_MATERIAL_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                </select>
            </label>

            <div className="space-y-1.5">
                <ZenGrowthLabSlider
                    label={`G score / ${phaseLabel}`}
                    value={controls?.growthStage}
                    disabled={!enabled}
                    onChange={(value) => controls?.onPreviewControlChange?.('growthStage', value)}
                />
                <ZenGrowthLabSlider
                    label="H activation"
                    value={controls?.activation}
                    disabled={!enabled}
                    onChange={(value) => controls?.onPreviewControlChange?.('activation', value)}
                />
                <ZenGrowthLabSlider
                    label="Days"
                    value={controls?.dayCount}
                    min={1}
                    max={maxDays}
                    suffix="d"
                    disabled={!enabled}
                    onChange={(value) => controls?.onGrowthLabControlChange?.('dayCount', value)}
                />
            </div>

            <details className="group rounded-lg border border-[#E5E0D6] bg-white/70 px-2 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[0.12em] text-stone-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#536B46]">
                    <span>Structural imprint</span>
                    <span aria-hidden="true" className="text-[11px] font-medium text-stone-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="mt-2 space-y-1.5">
                    <ZenGrowthLabSlider
                        label="Exposure"
                        value={controls?.exposureQuality}
                        disabled={!enabled}
                        onChange={(value) => controls?.onGrowthLabControlChange?.('exposureQuality', value)}
                    />
                    <ZenGrowthLabSlider
                        label="Stress wood"
                        value={controls?.stressWood}
                        disabled={!enabled}
                        onChange={(value) => controls?.onGrowthLabControlChange?.('stressWood', value)}
                    />
                    <ZenGrowthLabSlider
                        label="Recovery wood"
                        value={controls?.recoveryWood}
                        disabled={!enabled}
                        onChange={(value) => controls?.onGrowthLabControlChange?.('recoveryWood', value)}
                    />
                    <ZenGrowthLabSlider
                        label="Volatility"
                        value={controls?.volatility}
                        disabled={!enabled}
                        onChange={(value) => controls?.onGrowthLabControlChange?.('volatility', value)}
                    />
                    <ZenGrowthLabSlider
                        label="Canopy reserve"
                        value={controls?.canopyReserve}
                        disabled={!enabled}
                        onChange={(value) => controls?.onGrowthLabControlChange?.('canopyReserve', value)}
                    />
                </div>
            </details>
        </>
    );
}

export function ZenLatentControlPanel({
    latentState = null,
    activeLatentPresetIds = null,
    onApplyLatentAxisPreset = null,
    onBranchDetailControlChange = null,
    bonsaiGrowthLabControls = null,
    showShapeControls = false,
    gardenBedMaterialStyle = DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
    onGardenBedMaterialStyleChange = null,
}) {
    const [activeTab, setActiveTab] = useState(() => (
        bonsaiGrowthLabControls ? PANEL_TABS.GROWTH : PANEL_TABS.SHAPE
    ));
    const showGrowthTab = Boolean(bonsaiGrowthLabControls);
    const showTabSwitcher = showGrowthTab && showShapeControls;
    const resolvedActiveTab = showGrowthTab && !showShapeControls
        ? PANEL_TABS.GROWTH
        : (showGrowthTab ? activeTab : PANEL_TABS.SHAPE);
    return (
        <aside
            className="min-h-[300px] shrink-0 space-y-1.5 overflow-y-auto rounded-[14px] border border-[#E3E0D8] bg-white/88 p-1.5 lg:h-full lg:min-h-0 lg:space-y-2 lg:p-2"
            aria-label="Bonsai lab inspector"
            data-bonsai-lab-inspector
        >
            {showTabSwitcher && (
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#EAE8E3] bg-stone-100/55 p-1" role="tablist" aria-label="Bonsai inspector section">
                    {[
                        [PANEL_TABS.SHAPE, 'Shape'],
                        [PANEL_TABS.GROWTH, 'Growth'],
                    ].map(([tabId, label]) => (
                        <button
                            key={tabId}
                            type="button"
                            onClick={() => setActiveTab(tabId)}
                            role="tab"
                            aria-selected={resolvedActiveTab === tabId}
                            className={`h-6 rounded-md text-[8px] font-black uppercase tracking-[0.12em] transition-colors ${resolvedActiveTab === tabId
                                ? 'bg-white text-[#2D4F1E] shadow-sm'
                                : 'text-stone-500 hover:text-stone-800'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {resolvedActiveTab === PANEL_TABS.GROWTH ? (
                <ZenGrowthMemoryControlContent
                    controls={bonsaiGrowthLabControls}
                    gardenBedMaterialStyle={gardenBedMaterialStyle}
                    onGardenBedMaterialStyleChange={onGardenBedMaterialStyleChange}
                />
            ) : (
                <ZenLatentShapeControlContent
                    latentState={latentState}
                    activeLatentPresetIds={activeLatentPresetIds}
                    onApplyLatentAxisPreset={onApplyLatentAxisPreset}
                    onBranchDetailControlChange={onBranchDetailControlChange}
                />
            )}
        </aside>
    );
}

export default ZenLatentControlPanel;
