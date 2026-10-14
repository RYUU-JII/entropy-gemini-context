import React from 'react';
import { UiToggle } from '../../../../../ui-kit';
import ArtifactInfoButton from './ArtifactInfoButton.jsx';

export default function ArtifactToggleRow({
    label,
    description,
    infoTitle = '',
    infoBody = '',
    statusLabel = '',
    statusClassName = '',
    checked = false,
    onToggle,
    FluxToggle = null,
    color = '#0ea5e9',
    size = 'sm',
    className = '',
    labelClassName = '',
    descriptionClassName = '',
    control = null,
    controlClassName = '',
    controlRowIndex = null,
    controlChildKey = '',
    showToggle = true,
    children = null,
}) {
    const resolvedInfoTitle = infoTitle || label || '';
    const resolvedInfoBody = infoBody || description || '';
    const controlNode = control || (
        showToggle ? (
            FluxToggle ? (
                <FluxToggle
                    active={checked}
                    onChange={(value) => onToggle?.({ target: { checked: value } })}
                    color={color}
                    size={size}
                />
            ) : (
                <UiToggle
                    checked={checked}
                    onChange={onToggle}
                />
            )
        ) : null
    );

    return (
        <div
            data-artifact-control-row-index={Number.isInteger(controlRowIndex) ? controlRowIndex : undefined}
            data-artifact-control-child-key={controlChildKey || undefined}
            className={`min-w-0 border-b border-border/10 py-3 ${className}`}
        >
            <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start gap-1.5">
                            <div className={`min-w-0 flex-1 text-[12px] font-semibold leading-snug break-keep break-words text-on-surface ${labelClassName}`}>
                                {label}
                            </div>
                        </div>
                        <ArtifactInfoButton title={resolvedInfoTitle} body={resolvedInfoBody}
                            className={`mt-1.5 break-words ${descriptionClassName}`} />
                    </div>
                    {statusLabel ? (
                        <div className={`shrink-0 rounded-full border border-border/20 bg-surface/60 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] ${statusClassName}`}>
                            {statusLabel}
                        </div>
                    ) : null}
                </div>

                {controlNode ? (
                    <div className={`min-w-0 ${controlClassName}`}>
                        {controlNode}
                    </div>
                ) : null}

                {children ? (
                    <div className="min-w-0">
                        {children}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
