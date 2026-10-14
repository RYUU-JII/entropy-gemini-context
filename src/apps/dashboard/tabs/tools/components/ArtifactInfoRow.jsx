import React from 'react';

export default function ArtifactInfoRow({
    label,
    value,
    className = '',
    labelClassName = '',
    valueClassName = '',
}) {
    return (
        <div className={`flex items-center justify-between gap-3 min-w-0 ${className}`}>
            <span className={`min-w-0 break-keep break-words text-xs font-mono text-on-surface-muted ${labelClassName}`}>
                {label}
            </span>
            <span className={`shrink-0 text-right text-[10px] font-black uppercase tracking-widest ${valueClassName}`}>
                {value}
            </span>
        </div>
    );
}
