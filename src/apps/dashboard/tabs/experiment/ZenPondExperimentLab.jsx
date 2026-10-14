import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Activity, Clipboard, Fish, Mountain, RotateCcw, Waves } from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { resolveZenRendererDebugTogglePreset } from '@/themes/plugins/zen/pond/contracts/zenRendererDebugToggles.js';
import { DEFAULT_ZEN_POND_VISUAL_PROFILE } from '@/themes/plugins/zen/pond/contracts/zenPondVisualProfile.js';
import { IconButton, LabPanel } from './ZenPondExperimentLabControls.jsx';
import ZenPondLabEffectsPanel from './ZenPondLabEffectsPanel.jsx';
import ZenPondLabScenePanel from './ZenPondLabScenePanel.jsx';
import {
    createPondLabSoloEffects, mergePondLabTuningWithDefaults,
    resolvePondLabRendererDebugTogglesForSwimModel, resolvePondLabRendererTogglePatch,
} from './zenPondExperimentLabModel.js';

export default function ZenPondExperimentLab({
    isActive = false, SignalScanner, SignalTuner = null, showSignalTuner = false,
    supportsSyntheticPondLab = true, dataMode, dataModes, syntheticActive, syntheticSeed, syntheticSummary,
    snapshotCopyFeedback, onDataModeChange, onSyntheticRandomize, onSnapshotCopy,
    scannerStatus, scannerFeedProps, dailyDisplayScore, topFactors, lockedTarget, onLockTarget, isolationProps,
    koiTuning, onTuningChange, onResetTuning, onHardReset, hardResetStatus = 'idle', hardResetError = null,
    siteKoiColorStrategy, onSiteKoiColorStrategyChange,
    visualProfile = DEFAULT_ZEN_POND_VISUAL_PROFILE, onVisualProfilePatch = null, onVisualProfileReset = null,
}) {
    const { t } = useAppTranslation('tools');
    const [section, setSection] = useState('scene');
    const [rendererDebugToggles, setRendererDebugToggles] = useState(() => resolveZenRendererDebugTogglePreset('on'));
    const [soloKey, setSoloKey] = useState(null);
    const beforeSolo = useRef(null);
    const [runtimeReadiness, setRuntimeReadiness] = useState(null);
    const resetPending = hardResetStatus === 'resetting';
    const tuning = useMemo(() => mergePondLabTuningWithDefaults(koiTuning), [koiTuning]);
    const activeSwimModel = tuning.physics.swimModel;
    const resolvedToggles = useMemo(() => resolvePondLabRendererDebugTogglesForSwimModel(rendererDebugToggles, activeSwimModel), [rendererDebugToggles, activeSwimModel]);
    const patchEffects = useCallback(patch => setRendererDebugToggles(current => resolvePondLabRendererTogglePatch(current, patch)), []);
    const presetEffects = preset => {
        beforeSolo.current = null;
        setSoloKey(null);
        setRendererDebugToggles(resolveZenRendererDebugTogglePreset(preset));
    };
    const soloEffect = key => {
        if (!soloKey) beforeSolo.current = rendererDebugToggles;
        setRendererDebugToggles(createPondLabSoloEffects(key));
        setSoloKey(key);
    };
    const restoreEffects = () => {
        if (!beforeSolo.current) throw new Error('ZEN_POND_LAB_SOLO_SNAPSHOT_MISSING');
        setRendererDebugToggles(beforeSolo.current);
        beforeSolo.current = null;
        setSoloKey(null);
    };
    const sections = [
        { id: 'scene', icon: Mountain, label: t('experiment.pond_lab.workbench.scene'), hint: t('experiment.pond_lab.workbench.scene_hint') },
        { id: 'water', icon: Waves, label: t('experiment.pond_lab.workbench.water'), hint: t('experiment.pond_lab.workbench.water_hint') },
        { id: 'koi', icon: Fish, label: t('experiment.pond_lab.workbench.koi'), hint: t('experiment.pond_lab.workbench.koi_hint') },
        { id: 'inspect', icon: Activity, label: t('experiment.pond_lab.workbench.inspect'), hint: t('experiment.pond_lab.workbench.inspect_hint') },
    ];
    const currentSection = sections.find(entry => entry.id === section);
    const copyExperiment = () => onSnapshotCopy({
        contract: 'entropy.zen.pond-lab.controls', version: 1,
        tuning, visualProfile, siteKoiColorStrategy, rendererDebugToggles: resolvedToggles,
        soloEffect: soloKey, runtimeReadiness,
        evidence: 'requested_controls_and_scanner_readiness_not_per_effect_worker_ack',
    });
    const renderDiagnostics = () => <LabPanel icon={Activity} title={t('experiment.pond_lab.workbench.runtime_title')}>
        <p className="text-sm text-on-surface">{t(`experiment.pond_lab.runtime.${runtimeReadiness?.phase || 'idle'}`)}</p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-muted">{t('experiment.pond_lab.workbench.runtime_note')}</p>
        <label className="mt-4 flex items-center gap-2 text-xs text-on-surface">
            <input type="checkbox" checked={resolvedToggles.koiIntentHudEnabled} disabled={!activeSwimModel.startsWith('event_fsm_life_') || !!soloKey}
                onChange={event => patchEffects({ koiIntentHudEnabled: event.target.checked })} className="h-4 w-4 accent-accent" />
            {t('experiment.pond_lab.workbench.intent_hud')}
        </label>
    </LabPanel>;
    const renderMaintenance = () => <LabPanel icon={RotateCcw} title={t('experiment.pond_lab.workbench.maintenance')}>
        <div className="space-y-4">
            <div>
                <IconButton label={t('experiment.pond_lab.workbench.reset_tuning')} disabled={typeof onResetTuning !== 'function'} onClick={onResetTuning} />
                <p className="mt-2 text-xs text-on-surface-muted">{t('experiment.pond_lab.workbench.reset_tuning_note')}</p>
            </div>
            <div className="border-t border-border/30 pt-4">
                <IconButton label={t(resetPending ? 'experiment.pond_lab.reset_pending' : 'koi_tuner.actions.hard_cache_reset')}
                    actionId="hard-reset"
                    disabled={resetPending || typeof onHardReset !== 'function'} onClick={onHardReset} />
                <p className="mt-2 text-xs leading-relaxed text-on-surface-muted">{t('experiment.pond_lab.reset_scope')}</p>
                {hardResetStatus === 'complete' && <p className="mt-2 text-xs text-accent">{t('experiment.pond_lab.reset_complete')}</p>}
            </div>
        </div>
    </LabPanel>;

    return <div data-pond-lab="true" data-pond-lab-section={section} data-pond-lab-readiness={runtimeReadiness?.phase || 'idle'}
        data-pond-lab-solo={soloKey || ''} data-pond-lab-reset={hardResetStatus}
        data-pond-lab-controls={JSON.stringify(resolvedToggles)} className="flex h-full min-h-0 min-w-0 flex-col gap-3">
        <header className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-surface/80 px-4 py-3">
            <div className="mr-auto min-w-0">
                <h3 className="text-sm font-semibold text-on-surface">{t('experiment.pond_lab.workbench.title')}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-muted">
                    <span role="status">{t(`experiment.pond_lab.runtime.${runtimeReadiness?.phase || 'idle'}`)}</span>
                    <span>{t(syntheticActive ? 'experiment.pond_lab.mode_synthetic' : 'experiment.pond_lab.mode_live')}</span>
                    <span>{t(`koi_tuner.model_options.${activeSwimModel}`)}</span>
                </div>
            </div>
            <IconButton icon={Clipboard} label={t('experiment.pond_lab.workbench.copy_experiment')} disabled={typeof onSnapshotCopy !== 'function'} onClick={copyExperiment} />
            {snapshotCopyFeedback && <span className="text-xs text-on-surface-muted">{snapshotCopyFeedback}</span>}
        </header>
        {(hardResetError || runtimeReadiness?.error) && <p role="alert" className="shrink-0 break-words rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">{hardResetError || runtimeReadiness.error}</p>}
        {soloKey && section !== 'water' && <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-accent/30 px-3 py-2 text-xs text-on-surface">
            <span>{t('experiment.pond_lab.workbench.solo_active', { effect: t(`experiment.pond_lab.effect_controls.${soloKey}`) })}</span>
            <IconButton label={t('experiment.pond_lab.workbench.solo_restore')} onClick={restoreEffects} />
        </div>}
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-h-[360px] min-w-0 overflow-hidden rounded-xl border border-border/40 bg-surface-sunken lg:min-h-0">
                {SignalScanner ? <SignalScanner key={`pond-${dataMode}-${syntheticSeed}-single`}
                    status={scannerStatus} {...scannerFeedProps} dailyScore={dailyDisplayScore} topFactors={topFactors}
                    lockedTarget={lockedTarget} onLockTarget={onLockTarget} className="h-full w-full" isTabActive={isActive}
                    {...isolationProps} visualProfile={visualProfile} parkRuntimeOnUnmount={true}
                    onRuntimeReadinessChange={setRuntimeReadiness} presentationSceneCommitKey={`pond_experiment:${dataMode}:${syntheticSeed}:single`}
                    koiTuning={tuning} rendererDebugToggles={resolvedToggles}
                /> : <p role="alert" className="p-6 text-sm text-on-surface-muted">{t('experiment.pond_lab.workbench.scanner_unavailable')}</p>}
            </div>
            <aside className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border/40 bg-surface/70 lg:overflow-hidden">
                <nav aria-label={t('experiment.pond_lab.workbench.navigation')} className="grid shrink-0 grid-cols-4 gap-1 border-b border-border/30 p-2">
                    {sections.map(({ id, icon: Icon, label }) => <button key={id} type="button" data-pond-section={id} aria-pressed={section === id}
                        onClick={() => setSection(id)} className={`flex flex-col items-center gap-1.5 rounded-lg px-1 py-2.5 text-xs font-medium transition-colors focus-visible:outline-accent ${section === id ? 'bg-accent/15 text-accent' : 'text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface'}`}>
                        <Icon size={17} aria-hidden="true" />{label}
                    </button>)}
                </nav>
                <div key={section} className="space-y-4 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                    <p className="text-xs leading-relaxed text-on-surface-muted">{currentSection.hint}</p>
                    {section === 'scene' && <ZenPondLabScenePanel {...{ t, supportsSyntheticPondLab, syntheticActive, dataModes, onDataModeChange, syntheticSeed, syntheticSummary, onSyntheticRandomize, visualProfile, onVisualProfilePatch, onVisualProfileReset }} />}
                    {section === 'water' && <ZenPondLabEffectsPanel t={t} toggles={resolvedToggles} soloKey={soloKey} onPatch={patchEffects} onSolo={soloEffect} onRestore={restoreEffects} onPreset={presetEffects} />}
                    {section === 'inspect' && renderDiagnostics()}
                    {showSignalTuner && SignalTuner ? <SignalTuner embedded={true} layoutMode="pond_inspector" inspectorSection={section}
                        tuning={tuning} onTuningChange={onTuningChange} showHardReset={false}
                        siteKoiColorStrategy={siteKoiColorStrategy} onSiteKoiColorStrategyChange={onSiteKoiColorStrategyChange}
                    /> : <p className="text-xs text-on-surface-muted">{t('experiment.pond_lab.workbench.tuner_unavailable')}</p>}
                    {section === 'inspect' && renderMaintenance()}
                </div>
            </aside>
        </div>
    </div>;
}
