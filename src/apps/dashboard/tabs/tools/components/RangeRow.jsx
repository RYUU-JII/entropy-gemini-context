import React, { useCallback } from 'react';
import RangeInput from '../../../../../ui-kit/RangeInput.jsx';

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

export default function RangeRow({
    label,
    value,
    min,
    max,
    step,
    output,
    disabled,
    onInput,
    onChange,
    onCommit,
}) {
    const handleCommitKeyUp = useCallback((event) => {
        if (!RANGE_COMMIT_KEYS.has(event.key)) return;
        onCommit?.(event);
    }, [onCommit]);

    return (
        <div className="flex flex-col gap-2.5 border-b border-border/10 py-3.5">
            <div className="flex items-center justify-between gap-3 text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-on-surface-muted">
                <span>{label}</span>
                <span className="tabular-nums text-accent">{output}</span>
            </div>
            <RangeInput
                value={value}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                variant="fader"
                onInput={onInput}
                onChange={onChange}
                inputProps={{
                    onPointerUp: onCommit,
                    onKeyUp: handleCommitKeyUp,
                }}
            />
        </div>
    );
}
