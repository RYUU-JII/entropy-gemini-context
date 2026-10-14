import React, { useMemo } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getInteractionMotionStyle } from '@/themes/core/motion/index.js';
import ArtifactControlDock from '@/themes/core/tools/ArtifactControlDock.jsx';
import ArtifactMasterToggleBar from '@/themes/core/tools/ArtifactMasterToggleBar.jsx';
import { resolveArtifactPanelSurface } from '@/themes/core/tools/artifactPanelSurface.js';
import { ZenArtifactControlGarden } from './ZenArtifactSwitchBand.jsx';
import './ZenArtifactPanel.css';

const ARTIFACT_PANEL_INTERACTION_STYLE = getInteractionMotionStyle('stable');

/**
 * ZenArtifactPanel
 * - Surface: transparent content layer inside the workspace-owned L2 control rail
 * - Identity: artifact name and one quiet inscription precede its controls
 * - Controls: one disclosed feature at a time; settings own confirmation and failure
 */
export default function ZenArtifactPanel({
  title,
  subtitle,
  description,
  index,
  isActive = false,
  controlSurface,
}) {
  const { t } = useAppTranslation('tools');
  const { dockModel, masterModel, showMasterToggle } = resolveArtifactPanelSurface(controlSurface);
  const dockRowGroups = useMemo(() => {
    if (!Array.isArray(dockModel?.blocks)) return [];
    return dockModel.blocks
      .filter((block) => block?.kind === 'rows');
  }, [dockModel?.blocks]);

  return (
    <div
      data-artifact-panel-skin="zen"
      data-artifact-panel-layout="identity-control-garden"
      data-artifact-panel-active={isActive ? 'true' : 'false'}
      className="relative h-full w-full min-h-0 min-w-0 overflow-hidden font-sans text-on-surface pointer-events-auto"
      style={ARTIFACT_PANEL_INTERACTION_STYLE}
    >
      <div
        data-artifact-control-rail-surface="true"
        className="zen-artifact-panel__layout relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
      >
        <header
          data-artifact-identity-header="true"
          className="zen-artifact-panel__identity relative z-10 min-w-0"
        >
          <div className="zen-artifact-panel__identity-top">
            <div className="zen-artifact-panel__number-cell" aria-hidden="true">
              <span className="zen-artifact-panel__number font-mono text-on-surface-muted">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <span className="zen-artifact-panel__subtitle font-sans text-on-surface-muted">
                {subtitle || t('artifacts.unknown')}
              </span>

              <div className="mt-1.5 flex min-w-0 items-start gap-3">
                <h1 className="zen-artifact-panel__title min-w-0 flex-1 whitespace-pre-wrap font-heading text-on-surface break-words">
                  {title}
                </h1>
                {showMasterToggle ? (
                  <ArtifactMasterToggleBar
                    model={masterModel}
                    variant="zen"
                    className="mt-1"
                  />
                ) : null}
              </div>
            </div>
          </div>

          <p className="zen-artifact-panel__inscription max-w-[38ch] font-serif text-on-surface-muted">
            “{description}”
          </p>
        </header>

        <div
          data-artifact-control-garden="true"
          className="zen-artifact-panel__control-garden custom-scrollbar relative z-20 flex-1 min-h-0 overflow-y-auto pr-1"
        >
          {dockRowGroups.length > 0 ? (
            <ZenArtifactControlGarden
              rowGroups={dockRowGroups}
              statusBlock={dockModel?.statusBlock}
              supplementalContent={dockModel?.supplementalContent}
            />
          ) : dockModel ? (
            <ArtifactControlDock
              SectionComponent="div"
              model={dockModel}
              variant="zen"
              sectionClassName="h-full min-h-0 !border-t-0"
              containerClassName="flex h-full min-h-0 flex-col"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
