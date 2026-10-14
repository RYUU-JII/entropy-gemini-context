import React from 'react';
import { Database, Palette, RefreshCw, RotateCcw } from 'lucide-react';
import { IconButton, LabPanel, LabSelect } from './ZenPondExperimentLabControls.jsx';
import { listZenPondVisualProfileAxes } from '@/themes/plugins/zen/pond/contracts/zenPondVisualProfile.js';
import { formatPondLabDurationMinutes, formatPondLabPercent } from './zenPondExperimentLabModel.js';

export default function ZenPondLabScenePanel({ t, supportsSyntheticPondLab, syntheticActive, dataModes, onDataModeChange,
    syntheticSeed, syntheticSummary, onSyntheticRandomize, visualProfile, onVisualProfilePatch, onVisualProfileReset }) {
    return <div className="space-y-4">
        {supportsSyntheticPondLab && <LabPanel icon={Database} title={t('experiment.pond_lab.eyebrow')}>
            <div className="grid grid-cols-2 gap-2">
                <IconButton label={t('experiment.pond_lab.mode_synthetic')} active={syntheticActive} onClick={() => onDataModeChange(dataModes.SYNTHETIC)} />
                <IconButton label={t('experiment.pond_lab.mode_live')} active={!syntheticActive} onClick={() => onDataModeChange(dataModes.LIVE)} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-on-surface-muted">{t(syntheticActive ? 'experiment.pond_lab.workbench.synthetic_note' : 'experiment.pond_lab.workbench.live_note')}</p>
            {syntheticActive && <>
                <div className="my-3 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-on-surface-muted">{t('experiment.pond_lab.metric_seed', { seed: syntheticSeed })}</span>
                    <IconButton icon={RefreshCw} label={t('experiment.pond_lab.workbench.new_roster')} onClick={onSyntheticRandomize} />
                </div>
                <div className="grid gap-1 text-xs text-on-surface-muted">
                    <span>{t('experiment.pond_lab.metric_candidates', { count: syntheticSummary.candidateCount })}</span>
                    <span>{t('experiment.pond_lab.metric_pressure', { count: syntheticSummary.pressureCandidateCount, max: formatPondLabDurationMinutes(syntheticSummary.maxWeightedPressureMs) })}</span>
                    <span>{t('experiment.pond_lab.metric_share', { value: formatPondLabPercent(syntheticSummary.maxPressureShare) })}</span>
                </div>
            </>}
        </LabPanel>}
        <LabPanel icon={Palette} title={t('experiment.pond_lab.visual_profile.title')}>
            <div className="grid grid-cols-2 gap-3">
                {listZenPondVisualProfileAxes().map(axis => <LabSelect key={axis.id}
                    label={t(`experiment.pond_lab.visual_profile.axes.${axis.id}`)} value={visualProfile[axis.id]}
                    options={axis.options.map(value => ({ value }))}
                    getLabel={option => t(`experiment.pond_lab.visual_profile.options.${axis.id}.${option.value}`)}
                    disabled={typeof onVisualProfilePatch !== 'function'} onChange={value => onVisualProfilePatch({ [axis.id]: value })} />)}
            </div>
            <div className="mt-3 flex justify-end">
                <IconButton icon={RotateCcw} label={t('experiment.pond_lab.visual_profile.reset')} disabled={typeof onVisualProfileReset !== 'function'} onClick={onVisualProfileReset} />
            </div>
        </LabPanel>
    </div>;
}
