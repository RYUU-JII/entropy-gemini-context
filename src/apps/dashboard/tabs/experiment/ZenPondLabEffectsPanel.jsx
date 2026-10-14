import React from 'react';
import { RotateCcw, Focus } from 'lucide-react';
import { IconButton } from './ZenPondExperimentLabControls.jsx';
import { ZEN_POND_LAB_WATER_EFFECT_GROUPS, resolvePondLabEffectControl } from './zenPondExperimentLabModel.js';

export default function ZenPondLabEffectsPanel({ t, toggles, soloKey, onPatch, onSolo, onRestore, onPreset }) {
    return <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
            <IconButton icon={RotateCcw} label={t('experiment.pond_lab.workbench.effects_default')} onClick={() => onPreset('on')} />
            <IconButton label={t('experiment.pond_lab.workbench.effects_off')} onClick={() => onPreset('off')} />
        </div>
        <p className="text-xs leading-relaxed text-on-surface-muted">{t('experiment.pond_lab.workbench.effects_note')}</p>
        {soloKey && <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
            <p className="mb-2 text-sm font-semibold text-on-surface">{t('experiment.pond_lab.workbench.solo_active', { effect: t(`experiment.pond_lab.effect_controls.${soloKey}`) })}</p>
                <IconButton icon={RotateCcw} actionId="restore-effects" label={t('experiment.pond_lab.workbench.solo_restore')} onClick={onRestore} />
        </div>}
        {ZEN_POND_LAB_WATER_EFFECT_GROUPS.map(group => <fieldset key={group.id} className="min-w-0 rounded-xl border border-border/40 bg-surface/40 p-3">
            <legend className="px-1 text-xs font-semibold text-on-surface-muted">{t(`experiment.pond_lab.effect_groups.${group.id}`)}</legend>
            <div className="divide-y divide-border/25">
                {group.items.map(({ key }) => {
                    const control = resolvePondLabEffectControl(toggles, key);
                    const label = t(`experiment.pond_lab.effect_controls.${key}`);
                    return <div key={key} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface">
                                <input type="checkbox" data-pond-effect={key} checked={control.active} disabled={control.disabled || !!soloKey}
                                    onChange={event => onPatch({ [key]: event.target.checked })} className="h-4 w-4 shrink-0 accent-accent" />
                                <span>{label}</span>
                            </label>
                            {control.blockedBy && <p className="ml-6 mt-1 text-[11px] text-on-surface-muted">{t('experiment.pond_lab.workbench.blocked_by', { gate: t(`experiment.pond_lab.effect_controls.${control.blockedBy}`) })}</p>}
                        </div>
                        {group.id !== 'gates' && <button type="button" data-pond-solo={key} aria-label={t('experiment.pond_lab.workbench.solo_label', { effect: label })}
                            aria-pressed={soloKey === key} title={t('experiment.pond_lab.workbench.solo_label', { effect: label })}
                            onClick={() => soloKey === key ? onRestore() : onSolo(key)}
                            className={`rounded-md p-2 transition-colors focus-visible:outline-accent ${soloKey === key ? 'bg-accent text-on-accent' : 'text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface'}`}>
                            <Focus size={15} aria-hidden="true" />
                        </button>}
                    </div>;
                })}
            </div>
        </fieldset>)}
    </section>;
}
