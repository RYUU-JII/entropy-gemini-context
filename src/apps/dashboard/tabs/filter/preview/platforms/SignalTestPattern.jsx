import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

/**
 * SignalTestPattern Mockup
 * A radical, experimental ground for testing visual filters.
 * Features SMPTE-style bars, grayscale ramps, resolution charts, and typography tests.
 */
export default function SignalTestPattern({ baseText, settings }) {
    const { t } = useAppTranslation('settings');
    const pt = (key) => t(`preview.signal_test_pattern.${key}`);

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background p-4 font-mono text-on-surface select-none">
            <div className="mb-2 flex items-end justify-between border-b border-border/30 pb-1">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-muted/70">
                        {pt('calibration_signal')}
                    </span>
                    <span className="text-xs font-black leading-none text-on-surface">
                        {pt('carrier_id')}
                    </span>
                </div>
                <div className="text-right text-[8px] leading-tight text-on-surface-muted/65">
                    {pt('ref_level')}<br />
                    {pt('sync_internal')}
                </div>
            </div>

            <div className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                    backgroundImage: 'linear-gradient(color-mix(in srgb, var(--color-on-surface) 16%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-on-surface) 16%, transparent) 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
            />

            <div className="relative flex flex-1 flex-col gap-4">
                <div className="h-24 w-full flex shadow-lg">
                    <div className="flex-1 bg-[#C0C0C0]" title={pt('color_gray')} />
                    <div className="flex-1 bg-[#FFFF00]" title={pt('color_yellow')} />
                    <div className="flex-1 bg-[#00FFFF]" title={pt('color_cyan')} />
                    <div className="flex-1 bg-[#00FF00]" title={pt('color_green')} />
                    <div className="flex-1 bg-[#FF00FF]" title={pt('color_magenta')} />
                    <div className="flex-1 bg-[#FF0000]" title={pt('color_red')} />
                    <div className="flex-1 bg-[#0000FF]" title={pt('color_blue')} />
                </div>

                <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                    <div className="flex flex-col gap-2 overflow-hidden rounded border border-border/30 bg-surface/25 p-3">
                        <div className="mb-1 border-b border-accent/20 text-[8px] font-bold uppercase text-accent">
                            {pt('readability_test')}
                        </div>
                        <div className="whitespace-pre-wrap leading-tight break-all text-on-surface">
                            <h4 className="text-sm font-black mb-1">{pt('headline_mark')}</h4>
                            <p className="text-[10px] opacity-80 mb-2">
                                {baseText || pt('default_copy')}
                            </p>
                            <div className="grid grid-cols-1 gap-1">
                                <p className="text-[8px] opacity-60">{pt('small_sample')}</p>
                                <p className="text-[6px] opacity-40">{pt('tiny_sample')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="h-12 w-full flex flex-col border border-border/30">
                            <div className="flex-1 flex">
                                {[...Array(11)].map((_, i) => (
                                    <div key={i} className="flex-1" style={{ backgroundColor: `rgb(${(i * 10)}%, ${(i * 10)}%, ${(i * 10)}%)` }} />
                                ))}
                            </div>
                            <div className="flex-1 flex">
                                {[...Array(11)].map((_, i) => (
                                    <div key={i} className="flex-1" style={{ backgroundColor: `rgb(${(100 - i * 10)}%, ${(100 - i * 10)}%, ${(100 - i * 10)}%)` }} />
                                ))}
                            </div>
                        </div>

                        <div className="group relative flex flex-1 items-center justify-center overflow-hidden border border-border/20 bg-surface-sunken/45">
                            <div className="absolute h-32 w-32 rounded-full border-[0.5px] border-border/40" />
                            <div className="absolute h-24 w-24 rounded-full border-[0.5px] border-border/40" />
                            <div className="absolute h-16 w-16 rounded-full border border-border/60" />
                            <div className="absolute h-8 w-8 rounded-full border-2 border-border-strong/70" />

                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-px w-full bg-border/60" />
                                <div className="h-full w-px bg-border/60" />
                            </div>

                            <div className="z-10 -rotate-45 text-[8px] font-black uppercase tracking-[0.5em] text-on-surface-muted/40">
                                {pt('resolution_target')}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative flex h-8 w-full items-center overflow-hidden border border-border/30 bg-surface-sunken px-4">
                    <div className="flex gap-1 items-center">
                        <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                        <span className="text-[10px] font-bold text-danger animate-pulse">
                            {pt('live_signal')}
                        </span>
                    </div>
                    <div className="pointer-events-none absolute inset-0 opacity-20"
                        style={{
                            background: 'linear-gradient(transparent 50%, color-mix(in srgb, var(--color-on-surface) 6%, transparent) 50%)',
                            backgroundSize: '100% 2px'
                        }}
                    />
                </div>
            </div>

            <div className="absolute left-4 top-0 -translate-y-1/2 bg-background px-1 text-[8px] font-bold text-on-surface-muted/65">
                {pt('system_code')}
            </div>
            <div className="absolute bottom-0 right-4 translate-y-1/2 cursor-default bg-background px-1 text-[8px] font-bold text-on-surface-muted/65">
                {pt('system_status')}
            </div>
        </div>
    );
}
