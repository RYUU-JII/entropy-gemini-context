import React from 'react';

import { ZenClassicViewport } from './components/ZenClassicViewport';
import { ZenClassicWorkspacePanels } from './components/ZenClassicWorkspacePanels';
import { ZenClassicWorkspaceShell } from './components/ZenClassicWorkspaceShell';
import { ZenLatentControlPanel } from './components/ZenLatentControlPanel';
import { ZenMainControlBar } from './components/ZenMainControlBar';
import { useZenClassicWorkspaceRuntime } from '../../runtime/classic/useZenClassicWorkspaceRuntime.js';

export default function ZenCoreStatusClassicExperiment({
    integrityScore = 100,
    experimental = true,
    labRuntimeActive = experimental,
    embedded = false,
    homeEmbedded = false,
    solarLocationProfile = null,
    bonsaiLifecycleInput = null,
    bonsaiGrowthLabControls = null,
    bonsaiGrowthModel = null,
}) {
    void integrityScore;
    const {
        shellProps,
        controlBarProps,
        workspaceLayoutClassName,
        viewportBaseProps,
        showLatentControlPanel,
        latentControlPanelProps,
        workspacePanelsProps,
    } = useZenClassicWorkspaceRuntime({
        experimental,
        labRuntimeActive,
        embedded,
        homeEmbedded,
        solarLocationProfile,
        bonsaiLifecycleInput,
        bonsaiGrowthLabControls,
        bonsaiGrowthModel,
    });

    return (
        <ZenClassicWorkspaceShell {...shellProps}>
            {({ isHomeEmbedded, viewportStyle }) => (
                <>
                    <ZenMainControlBar {...controlBarProps} />

                    <div className={workspaceLayoutClassName}>
                        <ZenClassicViewport
                            {...viewportBaseProps}
                            isHomeEmbedded={isHomeEmbedded}
                            viewportStyle={viewportStyle}
                        />

                        {showLatentControlPanel && (
                            <ZenLatentControlPanel {...latentControlPanelProps} />
                        )}
                    </div>

                    <ZenClassicWorkspacePanels {...workspacePanelsProps} />
                </>
            )}
        </ZenClassicWorkspaceShell>
    );
}
