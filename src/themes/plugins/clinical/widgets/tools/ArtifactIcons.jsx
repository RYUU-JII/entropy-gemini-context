import React from 'react';

const ClinicalIcons = Object.freeze({
    lens: <><circle cx="11" cy="10" r="6" /><circle cx="11" cy="10" r="3" /><path d="M17 9h3v10H4m7-3v3" /></>,
    veil: <><path d="M5 3l13 3v15L5 18zM18 6l2-2v15l-2 2M3 20h18" /><path d="M8 8l7 2m-7 2 7 2" opacity="0.5" /></>,
    brake: <><rect x="8" y="5" width="9" height="14" rx="2" /><path d="M12 2v8m-3 0h7M8 8H4v10h4m9-3h3V5h-3M6 21h13" /></>,
    barrier: <><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M6 7h12M6 10v7h12v-7" /><circle cx="9" cy="14" r="1.5" /><circle cx="15" cy="14" r="1.5" /></>,
    gate: <><path d="M3 21V8h9v13M6 21V11h3v10m3-13 3-3h6v13l-3 3V8h-6m3-3V3h6v2" /></>,
    flare: <><path d="M7 14V8a5 5 0 0 1 10 0v6M5 14h14v3H5zM10 17v4m4-4v4M6 21h12" /><path d="M12 6v6" /></>,
    echo: <><path d="M3 7l4-3h14v15l-4 3L3 20zM3 7h14v15m0-15 4-3M8 4V2h6v2" /><path d="M7 11v6m6-6v6m-8 2h10" /></>,
});

export default function ArtifactIcons({ artifactKey, className, color, ...props }) {
    if (!Object.prototype.hasOwnProperty.call(ClinicalIcons, artifactKey)) {
        throw new Error(`ARTIFACT_ICON_KEY_UNDECLARED:clinical:${artifactKey}`);
    }
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className={className} color={color} {...props}>
            {ClinicalIcons[artifactKey]}
        </svg>
    );
}
