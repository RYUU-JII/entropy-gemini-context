import React from 'react';

function toProgressPercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed * 100)));
}

function toActiveMinutes(ms) {
    const parsed = Number(ms);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed / 60000));
}

function toTargetMinutes(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
}

export default function ArtifactSiteProgressRow({
    entry,
    t,
    mode = 'summary',
    className = '',
}) {
    if (!entry?.domain) return null;

    const progressPct = toProgressPercent(entry.ratio);
    const activeMinutes = toActiveMinutes(entry.activeMs);
    const targetMinutes = toTargetMinutes(entry.targetMinutes);
    const unit = t?.('units.min') || 'min';
    const breached = Boolean(entry.breached);

    if (mode === 'detail') {
        return (
            <div className={`min-w-0 rounded-[8px] border border-border/25 bg-surface-sunken/25 px-3 py-2 ${className}`}>
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-on-surface truncate">{entry.domain}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${breached ? 'text-danger' : 'text-on-surface-muted'}`}>
                        {breached ? t?.('artifacts.sentinel_flare.breach') : t?.('artifacts.sentinel_flare.armed')}
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-on-surface-muted">
                    <span className="tabular-nums">{activeMinutes} {unit}</span>
                    <span className="tabular-nums">{targetMinutes} {unit}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/25">
                    <div
                        className={`h-full ${breached ? 'bg-danger' : 'bg-accent'}`}
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={`min-w-0 rounded-[8px] border border-border/25 bg-surface-sunken/25 px-3 py-2 ${className}`}>
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono min-w-0">
                <span className="truncate text-on-surface">{entry.domain}</span>
                <span className="shrink-0 text-on-surface-muted tabular-nums">
                    {activeMinutes} / {targetMinutes}{unit}
                </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/25">
                <div
                    className={`h-full ${breached ? 'bg-danger' : 'bg-accent'}`}
                    style={{ width: `${progressPct}%` }}
                />
            </div>
        </div>
    );
}
