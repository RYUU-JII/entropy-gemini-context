import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getInteractionMotionStyle } from '@/themes/core/motion/index.js';
import ArtifactControlDock from '@/themes/core/tools/ArtifactControlDock.jsx';
import ArtifactMasterToggleBar from '@/themes/core/tools/ArtifactMasterToggleBar.jsx';
import { resolveArtifactPanelSurface } from '@/themes/core/tools/artifactPanelSurface.js';

const ARTIFACT_PANEL_INTERACTION_STYLE = getInteractionMotionStyle('stable');

export default function ArtifactPanel({
    title,
    subtitle,
    description,
    index,
    activeColor,
    isActive = false,
    controlSurface,
}) {
    const { t } = useAppTranslation('tools');
    const { dockModel, masterModel, showMasterToggle } = resolveArtifactPanelSurface(controlSurface);

    return (
        <div
            data-artifact-panel-skin="default"
            className="relative z-10 h-full w-full min-h-0 min-w-0 overflow-x-hidden px-3 py-3 pointer-events-auto"
            style={{ ...ARTIFACT_PANEL_INTERACTION_STYLE, '--artifact-control-radius': 'var(--radius-sm)' }}
        >
            <div className={`relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border px-5 py-5 ${isActive ? 'border-accent/20 bg-surface/72' : 'border-border/20 bg-surface-sunken/24'}`}>
                <div
                    className="pointer-events-none absolute inset-0 opacity-40"
                    style={{
                        background: `radial-gradient(circle at 50% 42%, ${activeColor}12 0%, transparent 48%), linear-gradient(180deg, color-mix(in srgb, var(--color-on-surface) 2%, transparent) 0%, transparent 55%)`,
                    }}
                />

                <header className="relative z-10 shrink-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 opacity-65">
                        <span
                            className="font-mono text-[10px] font-bold tracking-[0.22em]"
                            style={{ color: activeColor }}
                        >
                            {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-on-surface-muted">
                            {subtitle || t('artifacts.unknown')}
                        </span>
                    </div>
                    <div className="space-y-2.5">
                        <div className="flex items-start gap-3">
                            <h1 className="min-w-0 flex-1 text-[2.15rem] font-black uppercase tracking-[0.03em] text-on-surface leading-[0.92] break-words">
                                {title}
                            </h1>
                            {showMasterToggle ? (
                                <ArtifactMasterToggleBar
                                    model={masterModel}
                                    variant="default"
                                    className="mt-1"
                                />
                            ) : null}
                        </div>
                        <p className="max-w-sm text-[13px] leading-relaxed text-on-surface-muted break-words">
                            {description}
                        </p>
                    </div>
                </header>

                <ArtifactControlDock
                    model={dockModel}
                    variant="default"
                    sectionClassName="relative z-10 mt-4 flex-1 min-h-0"
                    containerClassName="flex h-full min-h-0 flex-col"
                />
            </div>
        </div>
    );
}
