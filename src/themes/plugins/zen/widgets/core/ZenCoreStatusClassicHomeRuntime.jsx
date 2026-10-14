import React from 'react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { ZenClassicViewport } from './components/ZenClassicViewport';
import { ZenClassicWorkspaceShell } from './components/ZenClassicWorkspaceShell';
import { useZenClassicHomeWorkspaceRuntime } from '../../runtime/classic/useZenClassicHomeWorkspaceRuntime.js';

export default function ZenCoreStatusClassicHomeRuntime({
    integrityScore = 100,
    experimental = false,
    embedded = false,
    homeEmbedded = false,
    frameVariant = 'card',
    homeGardenBedLayoutFrame = null,
    solarLocationProfile = null,
    presentationEnvironmentMode = null,
    presentationWeatherAuthority = null,
    presentationIdentityOverride = null,
    bonsaiLifecycleInput = null,
    showBonsaiTimeDiagnostics = false,
    showBonsaiDebugPanel = false,
    bonsaiLifeDebugControls = null,
    raiseBonsaiTimeDiagnostics = false,
    isTabActive = true,
    presentationSceneCommitKey = null,
    bloomPresentation = null,
    onBloomPresentationComplete = null,
    onFirstVisualMilestone = null,
    onBonsaiFirstFrameReady = null,
    onBonsaiMaterializationPrepared = null,
    onHomeCanopyReadingEnvelope = null,
    onBloomRegionTargets = null,
    workerRenderBudget = null,
    bootTraceContext = null,
}) {
    void integrityScore;
    const { t } = useAppTranslation('main');
    const {
        shellProps,
        workspaceLayoutClassName,
        viewportBaseProps,
    } = useZenClassicHomeWorkspaceRuntime({
        embedded,
        homeEmbedded,
        frameVariant,
        homeGardenBedLayoutFrame,
        solarLocationProfile,
        presentationEnvironmentMode,
        presentationWeatherAuthority,
        presentationIdentityOverride,
        bonsaiLifecycleInput,
        showBonsaiTimeDiagnostics,
        showBonsaiDebugPanel,
        bonsaiLifeDebugControls,
        raiseBonsaiTimeDiagnostics,
        isTabActive,
        presentationSceneCommitKey,
        bloomPresentation,
        onBloomPresentationComplete,
        onFirstVisualMilestone,
        onBonsaiFirstFrameReady,
        onBonsaiMaterializationPrepared,
        onHomeCanopyReadingEnvelope,
        onBloomRegionTargets,
        workerRenderBudget,
        bootTraceContext,
    });
    return (
        <ZenClassicWorkspaceShell {...shellProps}>
            {({ isHomeEmbedded, viewportStyle }) => {
                const resolvedViewportStyle = frameVariant === 'slab-aperture'
                    ? {
                        background: homeGardenBedLayoutFrame?.support === 'frame-seam'
                            ? 'transparent' : 'var(--zen-layer-l2-surface)',
                    }
                    : viewportStyle;
                return (
                    <div className={workspaceLayoutClassName}>
                        <ZenClassicViewport
                            {...viewportBaseProps}
                            experimental={experimental}
                            isHomeEmbedded={isHomeEmbedded}
                            frameVariant={frameVariant}
                            rerollBonsaiLabel={t('core_status.reroll_seed')}
                            viewportStyle={resolvedViewportStyle}
                        />
                    </div>
                );
            }}
        </ZenClassicWorkspaceShell>
    );
}
