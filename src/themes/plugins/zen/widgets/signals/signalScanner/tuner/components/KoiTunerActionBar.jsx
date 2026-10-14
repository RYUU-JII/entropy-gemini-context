import React from 'react';
export default function KoiTunerActionBar({
  t,
  onHardReset,
  onReset,
  onCopy,
  hoveredParam,
  hoveredHint = '',
  flatParams
}) {
  const hoveredDescription = hoveredHint || (hoveredParam ? flatParams.find(param => param.id === hoveredParam)?.desc : '');
  return <div className="border-t border-border/40 p-4 bg-surface/40">
            <div className="flex gap-2 mb-3">
                {onHardReset && <button type="button" onClick={onHardReset} className="flex-1 rounded-xl bg-rose-500/12 py-2.5 text-[10px] font-bold uppercase tracking-widest text-rose-300 transition-all hover:bg-rose-500/20 active:scale-[0.98] ring-1 ring-rose-500/20">
                        {t('tools:koi_tuner.actions.hard_cache_reset', {})}
                    </button>}
                <button type="button" onClick={onReset} className="flex-1 rounded-xl bg-surface-sunken py-2.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-muted transition-all hover:bg-surface hover:text-on-surface active:scale-[0.98] ring-1 ring-border/20">
                    {t('tools:koi_tuner.actions.reset')}
                </button>
                <button type="button" onClick={onCopy} className="flex-1 rounded-xl bg-accent/10 py-2.5 text-[10px] font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent/20 hover:text-accent active:scale-[0.98] ring-1 ring-accent/20">
                    {t('tools:koi_tuner.actions.copy')}
                </button>
            </div>
            <div className="h-8 flex items-center justify-center px-2 text-center">
                <p className="text-[10px] font-medium leading-relaxed text-on-surface-muted transition-colors animate-in fade-in slide-in-from-bottom-1">
                    {hoveredDescription || t('tools:koi_tuner.default_hint', {})}
                </p>
            </div>
        </div>;
}
