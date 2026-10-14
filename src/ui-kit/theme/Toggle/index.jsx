import React from 'react';

const TOGGLE_SIZE_STYLES = Object.freeze({
    sm: Object.freeze({
        shell: 'h-6 w-10',
        thumb: 'h-4 w-4',
        checkedTranslate: 'translate-x-5',
    }),
    md: Object.freeze({
        shell: 'h-7 w-12',
        thumb: 'h-5 w-5',
        checkedTranslate: 'translate-x-6',
    }),
    lg: Object.freeze({
        shell: 'h-8 w-14',
        thumb: 'h-6 w-6',
        checkedTranslate: 'translate-x-7',
    }),
});

const RetroToggle = ({ checked, onChange, disabled, className, ariaLabel, id, size = 'md' }) => {
    const isSquare = className?.includes('rounded-none');
    const sizeStyle = TOGGLE_SIZE_STYLES[size] || TOGGLE_SIZE_STYLES.md;

    return (
        <button
            type="button"
            id={id}
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={[
                'relative inline-flex items-center border transition-all duration-200 ease-out select-none',
                sizeStyle.shell,
                isSquare ? 'rounded-none' : 'rounded-full',
                checked
                    ? 'border-accent/80 bg-accent/20'
                    : 'border-border bg-surface-sunken',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-accent/60',
                className || '',
            ].join(' ')}
        >
            <span
                className={[
                    'pointer-events-none absolute translate-x-1 border shadow-sm transition-all duration-200 ease-out',
                    sizeStyle.thumb,
                    isSquare ? 'rounded-none' : 'rounded-full',
                    checked
                        ? `${sizeStyle.checkedTranslate} border-accent/80 bg-accent`
                        : 'border-border bg-surface',
                ].join(' ')}
            />
        </button>
    );
};

export const Toggle = ({ className, checked, onChange, disabled, ariaLabel, id, size = 'md' }) => {
    const handleChange = (nextValue) => {
        if (!onChange) return;
        onChange({ target: { checked: nextValue, type: 'checkbox' } });
    };

    return (
        <RetroToggle
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className={className}
            ariaLabel={ariaLabel}
            id={id}
            size={size}
        />
    );
};
