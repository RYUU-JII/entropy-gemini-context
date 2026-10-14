import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getInteractionMotionStyle } from '@/themes/core/motion/index.js';
import ArtifactControlDock from '@/themes/core/tools/ArtifactControlDock.jsx';
import ArtifactMasterToggleBar from '@/themes/core/tools/ArtifactMasterToggleBar.jsx';
import { resolveArtifactPanelSurface } from '@/themes/core/tools/artifactPanelSurface.js';

const ARTIFACT_PANEL_INTERACTION_STYLE = getInteractionMotionStyle('stable');
// The console's global semantic palette pairs dark text with its light shell.
// This inset is a dark surface; project matching pairs for the shared controls.
const CYBERPUNK_CONTROL_SURFACE_STYLE = Object.freeze({
  '--color-on-surface': '#def3ff',
  '--color-on-surface-muted': '#9dc2df',
  '--color-on-surface-subtle': '#88b5d7',
  '--color-surface': '#071727',
  '--color-surface-elevated': '#102a42',
  '--color-border': '#88b5d7',
});

export default function CyberpunkArtifactPanel({
  title,
  subtitle,
  description,
  index,
  isActive = false,
  activeColor,
  controlSurface,
}) {
  const { t } = useAppTranslation('tools');
  const { dockModel, masterModel, showMasterToggle } = resolveArtifactPanelSurface(controlSurface);

  return (
    <div
      data-artifact-panel-skin="cyberpunk"
      className="relative h-full w-full overflow-hidden px-4 py-4 font-mono text-[#d8ecff] pointer-events-auto"
      style={{ ...ARTIFACT_PANEL_INTERACTION_STYLE, '--artifact-control-radius': '4px' }}
    >
      <div className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[4px] border px-5 py-5 ${isActive ? 'border-[#2f8ac0] bg-[#031123]/[0.88]' : 'border-[#1b486c] bg-[#020713]'}`}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.24]"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(0,243,255,0.1) 1px, transparent 1px), linear-gradient(0deg, rgba(106,92,255,0.1) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 80% 12%, rgba(0,243,255,0.22), transparent 38%), radial-gradient(circle at 12% 82%, rgba(106,92,255,0.22), transparent 40%)',
          }}
        />

        <div className="relative z-10 flex h-full min-h-0 flex-col">
          <header className="shrink-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#88b5d7] opacity-70">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>{subtitle || t('artifacts.unknown')}</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <h2 className="min-w-0 flex-1 text-[2rem] font-black uppercase leading-[0.94] tracking-[0.04em] text-[#def3ff] break-words">
                  {title}
                </h2>
                {showMasterToggle ? (
                  <ArtifactMasterToggleBar
                    model={masterModel}
                    variant="cyberpunk"
                    className="mt-1"
                  />
                ) : null}
              </div>
              <p className="max-w-sm text-[12px] leading-relaxed text-[#9dc2df] break-words">
                {description}
              </p>
            </div>
          </header>

          <ArtifactControlDock
            SectionComponent="section"
            sectionProps={{ style: CYBERPUNK_CONTROL_SURFACE_STYLE }}
            model={dockModel}
            variant="cyberpunk"
            sectionClassName="mt-4 flex-1 min-h-0"
            containerClassName="flex h-full min-h-0 flex-col"
          />
        </div>
      </div>
    </div>
  );
}
