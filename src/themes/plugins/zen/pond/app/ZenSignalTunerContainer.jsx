import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import ZenKoiTunerPanel from './ZenKoiTunerPanel.jsx';
import { useZenSettingsStore, useZenSessionStore } from '../state/stores/index.js';
import {
    selectZenSettingsSlice,
    selectZenSessionSlice,
} from '../state/selectors/zenSelectors.js';

export default function ZenSignalTunerContainer(props) {
    const {
        tuning: tuningProp = undefined,
        onTuningChange: onTuningChangeProp = null,
        onReset: onResetProp = null,
        onHardReset: onHardResetProp = null,
        siteKoiColorStrategy: siteKoiColorStrategyProp = undefined,
        onSiteKoiColorStrategyChange: onSiteKoiColorStrategyChangeProp = null,
        ...restProps
    } = props || {};

    const {
        tuning: storeTuning,
        setTuning,
        resetTuning,
        siteKoiColorStrategy: storeSiteKoiColorStrategy,
        setSiteKoiColorStrategy,
    } = useZenSettingsStore(useShallow(selectZenSettingsSlice));
    const {
        requestHardReset,
        hardResetStatus,
    } = useZenSessionStore(useShallow(selectZenSessionSlice));

    const resolvedTuning = tuningProp !== undefined
        ? tuningProp
        : storeTuning;
    const resolvedOnTuningChange = typeof onTuningChangeProp === 'function'
        ? onTuningChangeProp
        : setTuning;
    const resolvedOnReset = typeof onResetProp === 'function'
        ? onResetProp
        : resetTuning;
    const resolvedOnHardReset = typeof onHardResetProp === 'function'
        ? onHardResetProp
        : requestHardReset;
    const resolvedSiteKoiColorStrategy = siteKoiColorStrategyProp !== undefined
        ? siteKoiColorStrategyProp
        : storeSiteKoiColorStrategy;
    const resolvedOnSiteKoiColorStrategyChange = typeof onSiteKoiColorStrategyChangeProp === 'function'
        ? onSiteKoiColorStrategyChangeProp
        : setSiteKoiColorStrategy;

    return (
        <ZenKoiTunerPanel
            {...restProps}
            tuning={resolvedTuning}
            onTuningChange={resolvedOnTuningChange}
            onReset={resolvedOnReset}
            onHardReset={resolvedOnHardReset}
            hardResetPending={hardResetStatus === 'resetting'}
            siteKoiColorStrategy={resolvedSiteKoiColorStrategy}
            onSiteKoiColorStrategyChange={resolvedOnSiteKoiColorStrategyChange}
        />
    );
}
