import React from 'react';
import './entropyArtifactConsole.css';

// The flat gallery owns placement and the renderer. This is its physical bay,
// with no additional scene, clock, settings subscription or ground animation.
export default function EntropyArtifactCanvas({ renderArtifact }) {
    return (
        <div className="entropy-artifact-bay absolute inset-0" data-artifact-canvas-space="flat-2d">
            <div className="entropy-artifact-bay__recess absolute inset-0 pointer-events-none" aria-hidden="true" />
            <div className="entropy-artifact-bay__registration" aria-hidden="true"><span /><span /><span /><span /></div>
            {renderArtifact()}
        </div>
    );
}
