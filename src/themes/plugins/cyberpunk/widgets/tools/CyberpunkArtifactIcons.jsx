import React from 'react';
const LoopBreakerIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
        <path d="M4 12h16" />
        <path d="M12 4v16" />
        <path d="M7 7l10 10M17 7L7 17" opacity="0.7" />
        <rect x="8" y="8" width="8" height="8" />
    </svg>
);

const CyberpunkIcons = {
    lens: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <path d="M4 17V8l7-3v10l-7 2Z" />
            <path d="M12 17V5l8 3v11l-8-2Z" />
            <path d="M3 12h18" opacity="0.65" />
        </svg>
    ),
    veil: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <rect x="6" y="5" width="12" height="14" rx="2" />
            <path d="M5 10h14M4 14h16" />
            <path d="M7 7l10 10M17 7L7 17" opacity="0.5" />
        </svg>
    ),
    brake: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <path d="M5 19V7l3-3h8l3 3v12M5 21h14" />
            <ellipse cx="12" cy="13" rx="9" ry="3.5" opacity="0.65" />
            <path d="M9 7h6v12H9zM9 10h6m-6 6h6" />
        </svg>
    ),
    gate: LoopBreakerIcon,
    echo: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <path d="M6 5h12l-2 14H8L6 5Z" />
            <path d="M9 9h6M9 13h6" />
            <circle cx="12" cy="17.5" r="1" />
        </svg>
    ),
    flare: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <polygon points="12 3 19 7 19 15 12 20 5 15 5 7 12 3" />
            <circle cx="12" cy="11.5" r="2.2" />
            <path d="M12 14v6" />
        </svg>
    ),
    barrier: (props) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" {...props}>
            <rect x="8" y="2.5" width="8" height="19" />
            <path d="M10 7h4M10 11h4M10 15h4M10 19h4" opacity="0.8" />
        </svg>
    ),
};

export default function CyberpunkArtifactIcons({ artifactKey, className, color, ...props }) {
    if (!Object.prototype.hasOwnProperty.call(CyberpunkIcons, artifactKey)) {
        throw new Error(`ARTIFACT_ICON_KEY_UNDECLARED:cyberpunk:${artifactKey}`);
    }
    const Icon = CyberpunkIcons[artifactKey];
    return <Icon className={className} color={color} {...props} />;
}
