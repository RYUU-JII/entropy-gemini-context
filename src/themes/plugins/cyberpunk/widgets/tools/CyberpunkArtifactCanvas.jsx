import React from 'react';

// The console shell is light, but the instruments live in a dark inspection
// bay. Placement and readiness remain entirely with the shared gallery owner.
export default function CyberpunkArtifactCanvas({ themeId, renderArtifact }) {
    if (themeId !== 'cyberpunk' || typeof renderArtifact !== 'function') {
        throw new Error('CYBERPUNK_ARTIFACT_CANVAS_CONTRACT_INVALID');
    }
    return (
        <>
            <div className="absolute inset-0 z-0" data-cyberpunk-artifact-bay="inspection"
                style={{ background: 'radial-gradient(ellipse at 50% 36%, rgba(31, 48, 77, 0.44) 0%, transparent 62%), linear-gradient(180deg, var(--color-background) 0%, #071121 66%, #040912 100%)' }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]"
                style={{ background: 'linear-gradient(90deg, transparent 4%, rgba(0,243,255,0.06) 4.2%, transparent 4.4%, transparent 95.6%, rgba(106,92,255,0.08) 95.8%, transparent 96%), linear-gradient(180deg, transparent 65%, rgba(0,243,255,0.09) 65.2%, transparent 65.5%)' }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] bottom-[17%] z-[1] h-[10%]"
                style={{ background: 'radial-gradient(ellipse at center, rgba(0,243,255,0.09) 0%, rgba(106,92,255,0.05) 42%, transparent 72%)' }} />
            <div className="absolute inset-0 z-10 pointer-events-none" data-artifact-canvas-space="flat-2d">
                <div className="absolute inset-0">{renderArtifact()}</div>
            </div>
        </>
    );
}
