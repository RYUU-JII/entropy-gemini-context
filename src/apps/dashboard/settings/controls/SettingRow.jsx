import React from 'react';
import { UiToggle } from '../../../../ui-kit';
import RangeInput from '../../../../ui-kit/RangeInput.jsx';
import ShadowPicker from '../../../../ui-kit/ShadowPicker.jsx';
import {
    normalizeSocialMetricOptions,
    resolveSocialMetricScope,
} from '../../../../domains/settings/config/index.js';
import {
    getTextShadowState,
    valueForInput,
} from '../../../../domains/settings/config/settingsConfig.js';

function getRangeOutput(meta, inputValue, isActive) {
    if (!isActive) return 'OFF';
    if (typeof meta.displayValue === 'function') return meta.displayValue(inputValue);
    if (meta.control === 'range') return `${inputValue}${meta.unitSuffix || meta.unit || ''}`;
    return `${meta.unitSuffix || meta.unit || ''}`;
}

const RANGE_COMMIT_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
]);

export default function SettingRow({
    settingKey,
    meta,
    setting,
    shadowColors,
    shadowLevels,
    onToggle,
    onValueChange,
    onRangeInput,
    onRangeCommit,
    onShadowChange,
    onCompoundChange,
    isLast,
}) {
    const inputId = `setting-${settingKey}`;
    const isActive = !!setting?.isActive;
    const isToggleOnly = meta.control === 'toggle';
    const isShadow = meta.control === 'shadow';
    const isRange = meta.control === 'range';
    const isSocialMetricScope = meta.control === 'socialMetricScope';
    const inputValue = !isShadow ? valueForInput(meta, setting) : null;
    const rawValue = inputValue ?? '';
    const shadowState = isShadow ? getTextShadowState(setting?.value) : null;
    const shadowLevel = shadowState?.level ?? 1;
    const shadowColorKey = shadowState?.color?.key ?? shadowColors[0]?.key;
    const isStepped = isShadow;

    // Dynamic Style for Active State
    const rowStyle = {
        '--level-1': '#10b981', // Emerald
        '--level-2': '#f59e0b', // Amber
        '--level-3': '#ef4444', // Red
        '--range-track-rest': 'var(--color-border)',
        '--range-track-fill': 'var(--color-accent)',
        '--range-tick': 'var(--color-on-surface-muted)',
    };

    if (isShadow && shadowState) {
        const progress = shadowLevels.length > 1 ? ((shadowLevel - 1) / (shadowLevels.length - 1)) * 100 : 0;
        rowStyle['--range-progress'] = `${progress}%`;
        rowStyle['--range-accent'] = isActive ? 'var(--color-accent)' : 'var(--color-on-surface-muted)';
    }

    const outputText = !isShadow ? getRangeOutput(meta, rawValue, isActive) : '';

    const emitRangeInput = (event) => {
        const nextValue = event?.target?.value;
        if (typeof onRangeInput === 'function') {
            onRangeInput(settingKey, meta, nextValue);
            return;
        }
        onValueChange(settingKey, meta, nextValue);
    };
    const emitRangeCommit = (event) => {
        const nextValue = event?.target?.value;
        if (typeof onRangeCommit === 'function') {
            onRangeCommit(settingKey, meta, nextValue);
            return;
        }
        onValueChange(settingKey, meta, nextValue);
    };
    const handleRangeKeyUp = (event) => {
        if (!RANGE_COMMIT_KEYS.has(event.key)) return;
        emitRangeCommit(event);
    };
    const socialMetricValue = isSocialMetricScope
        ? normalizeSocialMetricOptions(setting?.value)
        : null;
    const socialMetricComparisonActive = isSocialMetricScope && (
        socialMetricValue.feedbackCounts
        || socialMetricValue.viewCounts
        || socialMetricValue.audienceCounts
    );
    const socialMetricScope = socialMetricComparisonActive
        ? resolveSocialMetricScope(socialMetricValue)
        : 'off';

    return (
        <div
            className={`group flex flex-col gap-3 py-3.5 transition-opacity ${!isActive ? 'opacity-70 hover:opacity-100' : ''}`}
            style={rowStyle}
            data-key={settingKey}
        >
            {/* Header Row: Label + Toggle */}
            <div className="flex items-center justify-between gap-4 h-8">
                <div className="flex items-center gap-3">
                    <label
                        htmlFor={inputId}
                        className="text-[14px] font-semibold text-on-surface transition-colors group-hover:text-accent"
                    >
                        {meta.label}
                    </label>
                </div>
                <div className="flex items-center gap-3">
                    {!isSocialMetricScope ? (
                        <UiToggle
                            checked={isActive}
                            onChange={(event) => onToggle(settingKey, meta, event.target.checked)}
                            ariaLabel={`${meta.label} toggle`}
                            className="scale-[0.85] origin-right"
                        />
                    ) : null}
                </div>
            </div>

            {/* Helper Text (Separate line) */}
            {(isToggleOnly || isSocialMetricScope || isStepRange) && meta.helper && (
                <p className="text-[12px] text-on-surface-muted leading-relaxed -mt-1 pr-8">
                    {meta.helper}
                </p>
            )}

            {/* Control Row: Inputs (if enabled or always visible but disabled) */}
            {!isToggleOnly && !isSocialMetricScope && (
                <div className={`pl-0 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                    {isShadow ? (
                        <ShadowPicker
                            id={inputId}
                            dataKey={settingKey}
                            level={shadowLevel}
                            colorKey={shadowColorKey}
                            levels={shadowLevels}
                            colors={shadowColors}
                            disabled={!isActive}
                            outputLabel={isActive ? shadowLevels[shadowLevel - 1]?.label || `Lv${shadowLevel}` : 'OFF'}
                            onLevelChange={(nextLevel) => onShadowChange(settingKey, meta, nextLevel, shadowColorKey)}
                            onColorChange={(nextColor) => onShadowChange(settingKey, meta, shadowLevel, nextColor)}
                        />
                    ) : isRange ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1 h-8 flex items-center">
                                    <RangeInput
                                        id={inputId}
                                        dataKey={settingKey}
                                        value={rawValue}
                                        min={meta.min}
                                        max={meta.max}
                                        step={meta.step}
                                        disabled={!isActive}
                                        ariaLabel={meta.label}
                                        className={isStepped ? 'range-input-stepped' : undefined}
                                        onInput={emitRangeInput}
                                        inputProps={{
                                            onPointerUp: emitRangeCommit,
                                            onKeyUp: handleRangeKeyUp,
                                        }}
                                    />
                                </div>
                                {(
                                    <output className="min-w-[3rem] text-right text-xs font-bold text-on-surface-muted tabular-nums">
                                        {outputText}
                                    </output>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                id={inputId}
                                className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-on-surface placeholder-on-surface-muted/50 focus-visible:border-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/30 disabled:bg-transparent"
                                type={meta.type === 'number' ? 'number' : 'text'}
                                value={rawValue}
                                placeholder={meta.placeholder || ''}
                                min={meta.min}
                                step={meta.step}
                                disabled={!isActive}
                                onChange={(event) => onValueChange(settingKey, meta, event.target.value)}
                            />
                            <span className="text-xs font-medium text-on-surface-muted">
                                {meta.unitSuffix || meta.unit || ''}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {isSocialMetricScope && (
                <div className="space-y-2 rounded-xl border border-border bg-surface/50 p-3">
                    <div
                        className="grid grid-cols-2 gap-2"
                        role="radiogroup"
                        aria-label={meta.label}
                    >
                        {[
                            { value: 'off', label: meta.offLabel || 'Off' },
                            ...(Array.isArray(meta.scopeOptions) ? meta.scopeOptions : []),
                        ].map((option) => {
                            const selected = socialMetricScope === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => onCompoundChange(
                                        settingKey,
                                        meta,
                                        'scope',
                                        option.value,
                                    )}
                                    className={[
                                        'rounded-lg border px-3 py-2 text-left transition-colors',
                                        selected
                                            ? 'border-accent/45 bg-accent/12 text-accent'
                                            : 'border-border/70 bg-surface/70 text-on-surface-muted hover:border-accent/25 hover:text-on-surface',
                                    ].join(' ')}
                                    title={option.helper || option.label}
                                >
                                    <span className="block text-[12px] font-semibold">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-surface/70 px-3 py-2.5">
                        <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-on-surface">
                                {meta.timeSignalsOption?.label || 'Time Signals'}
                            </div>
                            {meta.timeSignalsOption?.helper ? (
                                <p className="mt-1 text-[11px] leading-relaxed text-on-surface-muted">
                                    {meta.timeSignalsOption.helper}
                                </p>
                            ) : null}
                        </div>
                        <UiToggle
                            checked={socialMetricValue.timeSignals === true}
                            onChange={(event) => onCompoundChange(
                                settingKey,
                                meta,
                                'timeSignals',
                                event.target.checked,
                            )}
                            ariaLabel={`${meta.label} ${meta.timeSignalsOption?.label || 'Time Signals'}`}
                            className="scale-[0.85] origin-right"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
