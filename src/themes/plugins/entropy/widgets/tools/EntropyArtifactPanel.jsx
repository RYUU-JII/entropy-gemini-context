import React from 'react';
import ArtifactControlDock from '@/themes/core/tools/ArtifactControlDock.jsx';
import ArtifactMasterToggleBar from '@/themes/core/tools/ArtifactMasterToggleBar.jsx';
import { resolveArtifactPanelSurface } from '@/themes/core/tools/artifactPanelSurface.js';
import { getInteractionMotionStyle } from '@/themes/core/motion/index.js';
import './entropyArtifactConsole.css';

const INTERACTION_STYLE = getInteractionMotionStyle('stable');

export default function EntropyArtifactPanel({
    title, subtitle, description, index, activeColor, isActive = false, controlSurface,
}) {
    const { dockModel, masterModel, showMasterToggle } = resolveArtifactPanelSurface(controlSurface);
    return (
        <div
            data-artifact-panel-skin="entropy"
            data-entropy-console-powered={isActive ? 'true' : 'false'}
            className="entropy-artifact-panel pointer-events-auto"
            style={{ ...INTERACTION_STYLE, '--entropy-control-accent': activeColor }}
        >
            <div className="entropy-artifact-panel__guide" aria-hidden="true">
                <span /><span />
            </div>
            <div className="entropy-artifact-panel__carriage">
                <span className="entropy-artifact-panel__fastener entropy-artifact-panel__fastener--left" aria-hidden="true" />
                <span className="entropy-artifact-panel__fastener entropy-artifact-panel__fastener--right" aria-hidden="true" />
                <header className="entropy-artifact-panel__header">
                    <div className="entropy-artifact-panel__plate font-mono">
                        <span>PROJECT: ENTROPY</span>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="entropy-artifact-panel__title-row">
                        <div className="min-w-0 flex-1">
                            <p className="entropy-artifact-panel__manifestation font-mono">{subtitle}</p>
                            <h1 className="entropy-artifact-panel__title font-heading">{title}</h1>
                        </div>
                        {showMasterToggle ? (
                            <ArtifactMasterToggleBar model={masterModel} variant="entropy" />
                        ) : null}
                    </div>
                    <p className="entropy-artifact-panel__description">{description}</p>
                </header>
                <ArtifactControlDock
                    model={dockModel}
                    variant="entropy"
                    sectionClassName="entropy-artifact-panel__controls flex-1 min-h-0"
                    containerClassName="flex h-full min-h-0 flex-col"
                />
                <div className="entropy-artifact-panel__base" aria-hidden="true">
                    <span /><i /><span />
                </div>
            </div>
        </div>
    );
}
