import React from 'react';
import { ARTIFACT_SVG_FILTER_REGIONS, createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';

// These are shared material recipes, not shared object silhouettes. Geometry and
// semantic movements belong to the seven independent instrument bodies.
export default function ClinicalArtifactInstrument({ family, presentation, children }) {
    const { channels, ids, shouldAnimate } = presentation;
    return (
        <div
            className="pointer-events-none relative flex h-[330px] w-[340px] items-end justify-center"
            data-clinical-artifact={family}
            data-artifact-motion-mode={shouldAnimate ? channels.motionBudgetMode : 'still'}
            data-artifact-runtime-state={channels.renderState.runtimeState}
            style={{
                '--clinical-ink': 'var(--color-on-surface)',
                '--clinical-edge': 'color-mix(in srgb, var(--color-on-surface) 25%, var(--color-border-strong))',
                '--clinical-teal': 'color-mix(in srgb, var(--color-accent-tertiary) 48%, var(--color-accent-secondary))',
                '--clinical-signal': channels.color,
                '--clinical-white': 'var(--color-surface)',
            }}
        >
            <svg
                aria-hidden="true"
                width="340"
                height="330"
                viewBox={createArtifactSvgViewBox(340, 330)}
                className="block overflow-visible"
                fill="none"
            >
                <defs>
                    <linearGradient id={ids.get('porcelain')} x1="0" y1="0" x2="1" y2="1">
                        <stop stopColor="var(--color-background)" />
                        <stop offset="0.5" stopColor="var(--color-surface)" />
                        <stop offset="1" stopColor="color-mix(in srgb, var(--color-on-surface) 6%, var(--color-surface-sunken))" />
                    </linearGradient>
                    <linearGradient id={ids.get('metal')} x1="0" y1="0" x2="1" y2="0">
                        <stop stopColor="var(--clinical-edge)" />
                        <stop offset="0.22" stopColor="var(--color-background)" />
                        <stop offset="0.47" stopColor="var(--color-border)" />
                        <stop offset="0.68" stopColor="var(--color-background)" />
                        <stop offset="1" stopColor="var(--clinical-edge)" />
                    </linearGradient>
                    <linearGradient id={ids.get('glass')} x1="0" y1="0" x2="1" y2="1">
                        <stop stopColor="var(--color-background)" stopOpacity="0.64" />
                        <stop offset="0.38" stopColor="var(--clinical-teal)" stopOpacity="0.1" />
                        <stop offset="0.72" stopColor="var(--color-background)" stopOpacity="0.38" />
                        <stop offset="1" stopColor="var(--clinical-teal)" stopOpacity="0.18" />
                    </linearGradient>
                    <linearGradient id={ids.get('teal')} x1="0" y1="0" x2="1" y2="1">
                        <stop stopColor="var(--clinical-teal)" stopOpacity="0.8" />
                        <stop offset="1" stopColor="var(--color-accent-tertiary)" stopOpacity="0.36" />
                    </linearGradient>
                    <radialGradient id={ids.get('optic')} cx="0.35" cy="0.3" r="0.72">
                        <stop stopColor="var(--color-background)" stopOpacity="0.98" />
                        <stop offset="0.34" stopColor="var(--clinical-teal)" stopOpacity="0.16" />
                        <stop offset="0.75" stopColor="var(--clinical-teal)" stopOpacity="0.55" />
                        <stop offset="1" stopColor="var(--clinical-ink)" stopOpacity="0.72" />
                    </radialGradient>
                    <filter id={ids.get('shadow')} {...ARTIFACT_SVG_FILTER_REGIONS.objectGlow}>
                        <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="var(--clinical-ink)" floodOpacity="0.12" />
                    </filter>
                    <filter id={ids.get('frost')} {...ARTIFACT_SVG_FILTER_REGIONS.tightObjectBlur}>
                        <feGaussianBlur stdDeviation="2.4" />
                    </filter>
                </defs>
                {children}
            </svg>
        </div>
    );
}
