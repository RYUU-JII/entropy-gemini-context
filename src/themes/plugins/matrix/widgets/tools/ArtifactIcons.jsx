import React from 'react';

const LoopBreakerIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4.2" opacity="0.8" />
        <path d="M3 12h18" />
        <path d="M12 3v3M12 18v3" opacity="0.7" />
    </svg>
);

const MatrixIcons = {
    lens: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <path d="M5 18V7l6-2v11l-6 2Z" />
            <path d="M12 17V6l6 2v11l-6-2Z" />
            <path d="M4 12h16" opacity="0.7" />
        </svg>
    ),
    veil: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <rect x="7" y="5" width="10" height="14" rx="1.5" />
            <path d="M5 9.5h14M4 12h16M5 14.5h14" />
            <path d="M9 5v14M15 5v14" opacity="0.6" />
        </svg>
    ),
    brake: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <path d="M4 6h16l2 2v9l-2 2H4l-2-2V8l2-2Z" />
            <path d="M1 12h22M9 9v6m3-6v6m3-6v6" opacity="0.8" />
            <path d="M5 9h2v6H5m13-6h1v6h-1" opacity="0.55" />
        </svg>
    ),
    gate: LoopBreakerIcon,
    echo: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <path d="M9 4.5h6" />
            <rect x="9" y="6" width="6" height="12" rx="1" />
            <circle cx="12" cy="9" r="1.6" />
            <path d="M6 20l3-3M18 20l-3-3" opacity="0.7" />
        </svg>
    ),
    flare: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <polygon points="12 3 18 7 18 15 12 19 6 15 6 7 12 3" />
            <circle cx="12" cy="11" r="2.1" />
            <path d="M12 13v7" />
            <path d="M4 20h16" opacity="0.7" />
            <path d="M8 21.5h8" opacity="0.5" />
        </svg>
    ),
    barrier: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <rect x="8" y="2.5" width="8" height="19" />
            <path d="M10 6h4M10 10h4M10 14h4M10 18h4" opacity="0.75" />
            <path d="M8 12h8" />
        </svg>
    ),
};

export default function ArtifactIcons({ artifactKey, className, color, ...props }) {
    if (!Object.prototype.hasOwnProperty.call(MatrixIcons, artifactKey)) {
        throw new Error(`ARTIFACT_ICON_KEY_UNDECLARED:matrix:${artifactKey}`);
    }
    const Icon = MatrixIcons[artifactKey];
    return <Icon className={className} color={color} {...props} />;
}
