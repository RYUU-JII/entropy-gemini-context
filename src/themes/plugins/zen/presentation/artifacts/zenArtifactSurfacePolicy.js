// Canonical Zen material policy shared by document widgets and Worker scenes.
// It has no theme registry, UI lifecycle, or storage dependency.
export const ZEN_ARTIFACT_SURFACE_POLICY = Object.freeze({
    motionEase: Object.freeze([0.22, 0.61, 0.36, 1]),
    pulseDuration: 2.8,
    particleColor: '#cbd5e1',
    buildBackgroundStyle: ({ signatureColor, isActive = true }) => ({
        backgroundImage: 'radial-gradient(circle at 48% 30%, rgba(226,232,240,0.14) 0%, rgba(15,23,42,0.78) 42%, rgba(2,6,23,0.94) 100%), linear-gradient(160deg, #1f2937 0%, #0f172a 65%, #020617 100%)',
        boxShadow: isActive
            ? `inset 0 0 32px rgba(148,163,184,0.2), 0 0 24px ${signatureColor}2a`
            : 'inset 0 0 28px rgba(15,23,42,0.5)',
    }),
    buildMaterialOverlayStyle: ({ isActive = true }) => ({
        backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(148,163,184,0.18) 0%, transparent 45%), radial-gradient(circle at 78% 65%, rgba(120,113,108,0.16) 0%, transparent 40%)',
        mixBlendMode: 'soft-light',
        opacity: isActive ? 0.45 : 0.2,
    }),
});
