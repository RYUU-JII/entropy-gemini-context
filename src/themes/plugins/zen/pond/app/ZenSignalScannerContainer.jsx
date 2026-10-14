import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import ZenSignalScannerSurface from './ZenSignalScannerSurface.jsx';
import { useZenSettingsStore, useZenSessionStore } from '../state/stores/index.js';
import {
    useZenScannerBridgeController,
} from './controllers/useZenScannerBridgeController.js';
import {
    resolveZenPondProjectionDataIsolationMode,
    resolveZenPondProjectionKoiPresentationMode,
} from './zenSignalScannerPresentation.js';
import {
    selectZenSessionSlice,
} from '../state/selectors/zenSelectors.js';

export default function ZenSignalScannerContainer(props) {
    const {
        koiTuning: koiTuningProp = undefined,
        visualProfile: visualProfileProp = undefined,
        hardResetToken: hardResetTokenProp = undefined,
        lockedTarget: lockedTargetProp = undefined,
        onLockTarget: onLockTargetProp = null,
        bootTraceContext = null,
        rosterAuthoritySource = undefined,
        domainCandidates: domainCandidatesProp = undefined,
        koiRosterFrame: koiRosterFrameProp = undefined,
        dataIsolationMode = false,
        pondProjection = null,
        runtimeMountReady: runtimeMountReadyProp = true,
        invitationSlots = [],
        invitationInteractionEnabled = true,
        invitationAssignment = null,
        ...restProps
    } = props || {};

    const storeTuning = useZenSettingsStore((state) => state.tuning);
    const storeVisualProfile = useZenSettingsStore((state) => state.visualProfile);
    const {
        hardResetToken: storeHardResetToken,
    } = useZenSessionStore(useShallow(selectZenSessionSlice));
    const resolvedTuning = koiTuningProp !== undefined
        ? koiTuningProp
        : storeTuning;
    const resolvedVisualProfile = visualProfileProp !== undefined
        ? visualProfileProp
        : storeVisualProfile;
    const resolvedHardResetToken = hardResetTokenProp !== undefined
        ? hardResetTokenProp
        : storeHardResetToken;
    const presentationMode = resolveZenPondProjectionKoiPresentationMode({
        pondProjection,
    });
    const resolvedDataIsolationMode = resolveZenPondProjectionDataIsolationMode({
        pondProjection,
        requestedDataIsolationMode: dataIsolationMode,
    });
    const {
        koiRosterFrame: runtimeKoiRosterFrame,
        rosterMemoryReady,
        resolvedLockedTarget,
        handleLockTarget,
    } = useZenScannerBridgeController({
        bootTraceContext,
        domainCandidates: domainCandidatesProp,
        dataIsolationMode: resolvedDataIsolationMode,
        hardResetToken: resolvedHardResetToken,
        lockedTarget: lockedTargetProp,
        onLockTarget: onLockTargetProp,
        presentationMode,
        rosterAuthoritySource,
        invitationSlots,
        invitationInteractionEnabled,
        invitationAssignment,
    });
    const koiRosterFrame = koiRosterFrameProp !== undefined
        ? koiRosterFrameProp
        : runtimeKoiRosterFrame;
    const koiRosterReady = koiRosterFrameProp !== undefined || rosterMemoryReady === true;

    return (
        <ZenSignalScannerSurface
            {...restProps}
            bootTraceContext={bootTraceContext}
            koiRosterFrame={koiRosterFrame}
            lockedTarget={resolvedLockedTarget}
            onLockTarget={handleLockTarget}
            koiTuning={resolvedTuning}
            visualProfile={resolvedVisualProfile}
            hardResetToken={resolvedHardResetToken}
            runtimeMountReady={runtimeMountReadyProp === true && koiRosterReady}
            dataIsolationMode={resolvedDataIsolationMode}
            pondProjection={pondProjection}
        />
    );
}
