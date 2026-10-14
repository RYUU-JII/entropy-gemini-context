import { assertThemePluginId } from './runtime/pluginCatalog.js';
import { ZEN_ARTIFACT_SURFACE_POLICY } from '../plugins/zen/presentation/artifacts/zenArtifactSurfacePolicy.js';
import {
    DEFAULT_TOOLS_SCENE_SPEC,
    TOOLS_THEME_ARTIFACT_SCENE_SPEC_OVERRIDES,
    TOOLS_THEME_SCENE_SPEC_OVERRIDES,
} from './sceneSpecs/index.js';

function buildArtifactSurfacePolicy({
    motionEase,
    pulseDuration,
    particleColor,
    buildBackgroundStyle,
    buildMaterialOverlayStyle,
}) {
    return Object.freeze({
        motionEase: Object.freeze([...(motionEase || [])]),
        pulseDuration,
        particleColor,
        buildBackgroundStyle,
        buildMaterialOverlayStyle,
    });
}

const ENTROPY_ARTIFACT_SURFACE_POLICY = buildArtifactSurfacePolicy({
    motionEase: [0.16, 1, 0.3, 1],
    pulseDuration: 1.4,
    particleColor: '#f8fafc',
    buildBackgroundStyle: ({ signatureColor, isActive = true }) => ({
        backgroundImage: `radial-gradient(circle at 50% 40%, ${signatureColor}2e 0%, rgba(3,7,18,0.92) 48%, rgba(2,6,23,0.96) 100%), linear-gradient(145deg, #020617 0%, #111827 55%, #030712 100%)`,
        boxShadow: isActive
            ? `inset 0 0 48px rgba(148,163,184,0.1), 0 0 42px ${signatureColor}42`
            : 'inset 0 0 40px rgba(15,23,42,0.6)',
    }),
    buildMaterialOverlayStyle: ({ isActive = true }) => ({
        backgroundImage: 'repeating-linear-gradient(35deg, rgba(148,163,184,0.08) 0px, rgba(148,163,184,0.08) 1px, transparent 1px, transparent 6px)',
        mixBlendMode: 'screen',
        opacity: isActive ? 0.3 : 0.12,
    }),
});

const MATRIX_ARTIFACT_SURFACE_POLICY = buildArtifactSurfacePolicy({
    motionEase: [0.1, 0.9, 0.2, 1],
    pulseDuration: 1.6,
    particleColor: '#39ff14',
    buildBackgroundStyle: ({ signatureColor, isActive = true }) => ({
        backgroundImage: `radial-gradient(circle at 50% 38%, ${signatureColor}2b 0%, rgba(0, 8, 0, 0.92) 50%, rgba(0, 0, 0, 0.98) 100%), linear-gradient(150deg, #001100 0%, #000000 68%, #001907 100%)`,
        boxShadow: isActive
            ? `inset 0 0 48px rgba(0, 255, 65, 0.1), 0 0 44px ${signatureColor}46`
            : 'inset 0 0 40px rgba(0, 20, 0, 0.55)',
    }),
    buildMaterialOverlayStyle: ({ isActive = true }) => ({
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,255,65,0.08) 0px, rgba(0,255,65,0.08) 1px, transparent 1px, transparent 5px)',
        mixBlendMode: 'screen',
        opacity: isActive ? 0.34 : 0.14,
    }),
});

const CYBERPUNK_ARTIFACT_SURFACE_POLICY = buildArtifactSurfacePolicy({
    motionEase: [0.18, 1, 0.22, 1],
    pulseDuration: 1.2,
    particleColor: '#67e8f9',
    buildBackgroundStyle: ({ signatureColor, isActive = true }) => ({
        backgroundImage: `radial-gradient(circle at 50% 38%, ${signatureColor}3a 0%, rgba(8, 14, 31, 0.94) 50%, rgba(2, 6, 23, 0.98) 100%), linear-gradient(150deg, #030712 0%, #1e1b4b 56%, #020617 100%)`,
        boxShadow: isActive
            ? `inset 0 0 50px rgba(6,182,212,0.12), 0 0 46px ${signatureColor}48`
            : 'inset 0 0 42px rgba(30,41,59,0.62)',
    }),
    buildMaterialOverlayStyle: ({ isActive = true }) => ({
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,243,255,0.1) 0px, rgba(0,243,255,0.1) 1px, transparent 1px, transparent 6px), repeating-linear-gradient(0deg, rgba(106,92,255,0.08) 0px, rgba(106,92,255,0.08) 1px, transparent 1px, transparent 6px)',
        mixBlendMode: 'screen',
        opacity: isActive ? 0.34 : 0.14,
    }),
});

const CLINICAL_ARTIFACT_SURFACE_POLICY = buildArtifactSurfacePolicy({
    motionEase: [0.2, 0.9, 0.2, 1],
    pulseDuration: 1.5,
    particleColor: '#d8f4ff',
    buildBackgroundStyle: ({ signatureColor, isActive = true }) => ({
        backgroundImage: 'radial-gradient(circle at 50% 34%, rgba(230,247,255,0.26) 0%, rgba(220,236,245,0.2) 26%, rgba(12,25,37,0.92) 68%, rgba(6,14,24,0.98) 100%), linear-gradient(160deg, #edf7fb 0%, #cfe0e8 24%, #122432 74%, #07111b 100%)',
        boxShadow: isActive
            ? `inset 0 0 40px rgba(225,244,252,0.28), 0 0 30px ${signatureColor}36`
            : 'inset 0 0 32px rgba(9,19,29,0.42)',
    }),
    buildMaterialOverlayStyle: ({ isActive = true }) => ({
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(148,184,198,0.1) 0px, rgba(148,184,198,0.1) 1px, transparent 1px, transparent 7px), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.16) 0%, transparent 58%)',
        mixBlendMode: 'screen',
        opacity: isActive ? 0.28 : 0.12,
    }),
});

const SCP_ARTIFACT_SURFACE_POLICY = buildArtifactSurfacePolicy({
    motionEase: [0.24, 1, 0.3, 1],
    pulseDuration: 1.7,
    particleColor: '#e2d7bf',
    buildBackgroundStyle: ({ signatureColor, isActive = true }) => ({
        backgroundImage: 'radial-gradient(circle at 50% 34%, rgba(214,206,186,0.18) 0%, rgba(74,68,57,0.28) 34%, rgba(17,17,17,0.92) 68%, rgba(5,5,5,0.98) 100%), linear-gradient(150deg, #111111 0%, #24211c 48%, #050505 100%)',
        boxShadow: isActive
            ? `inset 0 0 38px rgba(255,241,214,0.12), 0 0 28px ${signatureColor}32`
            : 'inset 0 0 30px rgba(12,10,8,0.46)',
    }),
    buildMaterialOverlayStyle: ({ isActive = true }) => ({
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 8px), repeating-linear-gradient(0deg, rgba(189,166,120,0.05) 0px, rgba(189,166,120,0.05) 1px, transparent 1px, transparent 8px)',
        mixBlendMode: 'screen',
        opacity: isActive ? 0.2 : 0.08,
    }),
});

const DEFAULT_TOOLS_VISUAL_POLICY = Object.freeze({
    sceneSpec: DEFAULT_TOOLS_SCENE_SPEC,
    artifactSurface: null,
    ground: Object.freeze({
        enabled: true,
        style: 'neutral',
        contactShadow: Object.freeze({
            width: 170,
            height: 36,
            opacity: 0.42,
            blur: 16,
        }),
        ambientShadow: Object.freeze({
            width: 260,
            height: 96,
            opacity: 0.22,
            blur: 40,
        }),
        surface: Object.freeze({
            width: 220,
            height: 220,
            opacity: 0.76,
            blur: 0,
            tiltX: 74,
        }),
        accentRing: Object.freeze({
            enabled: true,
            opacity: 0.34,
            glowOpacity: 0.18,
            thickness: 2,
        }),
        ripples: Object.freeze({
            enabled: true,
            count: 2,
            duration: 1.35,
            spread: 2.1,
            delayStep: 0.16,
        }),
    }),
    float: Object.freeze({
        enabled: true,
        amplitude: 10,
        duration: 3,
    }),
    rendererFx: Object.freeze({
        activeGlow: true,
        activeGlowBlur: 30,
        activeScale: 1.1,
        inactiveScale: 1,
        inactiveOpacity: 0.4,
        inactiveGrayscale: 0.5,
        hoverRing: true,
        rotateY: Object.freeze({
            enabled: true,
            amplitude: 5,
            duration: 6,
        }),
    }),
});

const TOOLS_THEME_POLICY_OVERRIDES = Object.freeze({
    entropy: Object.freeze({
        artifactSurface: ENTROPY_ARTIFACT_SURFACE_POLICY,
        float: Object.freeze({ enabled: false }),
        rendererFx: Object.freeze({
            activeGlow: false,
            activeScale: 1.02,
            inactiveOpacity: 0.82,
            inactiveGrayscale: 0.16,
            rotateY: Object.freeze({ enabled: false }),
        }),
        ground: Object.freeze({
            style: 'entropy',
            contactShadow: Object.freeze({
                opacity: 0.48,
            }),
            ambientShadow: Object.freeze({
                opacity: 0.26,
            }),
            accentRing: Object.freeze({
                opacity: 0.42,
                glowOpacity: 0.24,
            }),
        }),
    }),
    cyberpunk: Object.freeze({
        artifactSurface: CYBERPUNK_ARTIFACT_SURFACE_POLICY,
        rendererFx: Object.freeze({ inactiveOpacity: 0.86, inactiveGrayscale: 0.16 }),
        ground: Object.freeze({
            style: 'cyberpunk',
            contactShadow: Object.freeze({
                opacity: 0.52,
            }),
            ambientShadow: Object.freeze({
                opacity: 0.3,
            }),
            accentRing: Object.freeze({
                opacity: 0.5,
                glowOpacity: 0.3,
            }),
        }),
    }),
    zen: Object.freeze({
        artifactSurface: ZEN_ARTIFACT_SURFACE_POLICY,
        ground: Object.freeze({
            style: 'zen',
            contactShadow: Object.freeze({
                opacity: 0.34,
                blur: 12,
            }),
            ambientShadow: Object.freeze({
                opacity: 0.15,
                blur: 30,
            }),
            surface: Object.freeze({
                opacity: 0.86,
                tiltX: 72,
            }),
            accentRing: Object.freeze({
                opacity: 0.22,
                glowOpacity: 0.08,
                thickness: 1.5,
            }),
            ripples: Object.freeze({
                enabled: true,
                count: 1,
                duration: 1.6,
                spread: 1.8,
                delayStep: 0,
            }),
        }),
        float: Object.freeze({
            enabled: false,
        }),
        rendererFx: Object.freeze({
            preserveBodyAppearance: true,
            activeGlow: false,
            hoverRing: false,
            rotateY: Object.freeze({
                enabled: false,
            }),
        }),
    }),
    clinical: Object.freeze({
        artifactSurface: CLINICAL_ARTIFACT_SURFACE_POLICY,
        ground: Object.freeze({
            style: 'clinical',
            contactShadow: Object.freeze({
                opacity: 0.3,
            }),
            ambientShadow: Object.freeze({
                opacity: 0.16,
            }),
            accentRing: Object.freeze({
                opacity: 0.2,
                glowOpacity: 0.1,
            }),
            ripples: Object.freeze({
                enabled: false,
            }),
        }),
        float: Object.freeze({
            enabled: false,
        }),
        rendererFx: Object.freeze({
            activeGlow: true,
            activeGlowBlur: 20,
            activeScale: 1.06,
            inactiveOpacity: 0.84,
            inactiveGrayscale: 0.12,
            rotateY: Object.freeze({
                enabled: false,
            }),
        }),
    }),
    matrix: Object.freeze({
        artifactSurface: MATRIX_ARTIFACT_SURFACE_POLICY,
        ground: Object.freeze({
            style: 'matrix',
            contactShadow: Object.freeze({
                opacity: 0.38,
            }),
            ambientShadow: Object.freeze({
                opacity: 0.2,
            }),
            accentRing: Object.freeze({
                opacity: 0.28,
                glowOpacity: 0.14,
            }),
            ripples: Object.freeze({
                enabled: false,
            }),
        }),
        float: Object.freeze({
            enabled: false,
        }),
        rendererFx: Object.freeze({
            activeGlow: true,
            activeGlowBlur: 24,
            activeScale: 1.08,
            inactiveOpacity: 0.86,
            inactiveGrayscale: 0.16,
            rotateY: Object.freeze({
                enabled: false,
            }),
        }),
    }),
    scp: Object.freeze({
        artifactSurface: SCP_ARTIFACT_SURFACE_POLICY,
        ground: Object.freeze({
            style: 'scp',
            contactShadow: Object.freeze({
                opacity: 0.42,
            }),
            ambientShadow: Object.freeze({
                opacity: 0.22,
            }),
            accentRing: Object.freeze({
                opacity: 0.24,
                glowOpacity: 0.12,
            }),
            ripples: Object.freeze({
                enabled: false,
            }),
        }),
        float: Object.freeze({
            enabled: false,
        }),
        rendererFx: Object.freeze({
            activeGlow: true,
            activeGlowBlur: 18,
            activeScale: 1.05,
            inactiveOpacity: 0.72,
            inactiveGrayscale: 0.2,
            rotateY: Object.freeze({
                enabled: false,
            }),
        }),
    }),
});

const TOOLS_ARTIFACT_POLICY_OVERRIDES = Object.freeze({
    lens: Object.freeze({
        ground: Object.freeze({
            surface: Object.freeze({
                width: 244,
                height: 192,
                opacity: 0.82,
            }),
            accentRing: Object.freeze({
                opacity: 0.12,
                glowOpacity: 0.04,
            }),
            ripples: Object.freeze({
                enabled: true,
                count: 1,
                duration: 2.1,
                spread: 1.5,
                delayStep: 0,
            }),
        }),
        rendererFx: Object.freeze({
            activeGlow: false,
            activeScale: 1.03,
            inactiveOpacity: 0.6,
            inactiveGrayscale: 0.08,
            usesLocal3d: true,
        }),
    }),
    veil: Object.freeze({
        ground: Object.freeze({
            surface: Object.freeze({
                width: 224,
                height: 236,
                opacity: 0.78,
            }),
            accentRing: Object.freeze({
                opacity: 0.18,
                glowOpacity: 0.05,
            }),
            ripples: Object.freeze({
                enabled: true,
                count: 1,
                duration: 1.9,
                spread: 1.65,
                delayStep: 0,
            }),
        }),
        rendererFx: Object.freeze({
            activeGlow: false,
            activeScale: 1.02,
            inactiveOpacity: 0.58,
            inactiveGrayscale: 0.06,
        }),
    }),
    resonance: Object.freeze({
        ground: Object.freeze({
            surface: Object.freeze({
                width: 252,
                height: 176,
                opacity: 0.9,
            }),
            accentRing: Object.freeze({
                opacity: 0.2,
                glowOpacity: 0.1,
            }),
            ripples: Object.freeze({
                enabled: true,
                count: 2,
                duration: 2.4,
                spread: 1.72,
                delayStep: 0.24,
            }),
        }),
        float: Object.freeze({
            enabled: false,
        }),
        rendererFx: Object.freeze({
            activeGlow: false,
            activeScale: 1.01,
            inactiveOpacity: 0.62,
            inactiveGrayscale: 0.08,
            rotateY: Object.freeze({
                enabled: false,
            }),
        }),
    }),
    brake: Object.freeze({
        ground: Object.freeze({
            accentRing: Object.freeze({
                opacity: 0.24,
                glowOpacity: 0.1,
            }),
            ripples: Object.freeze({
                enabled: false,
            }),
        }),
        float: Object.freeze({
            enabled: false,
        }),
    }),
    monolith: Object.freeze({
        ground: Object.freeze({
            surface: Object.freeze({
                width: 250,
                height: 250,
            }),
            accentRing: Object.freeze({
                opacity: 0.2,
            }),
            ripples: Object.freeze({
                enabled: false,
            }),
        }),
        float: Object.freeze({
            enabled: false,
        }),
    }),
    gate: Object.freeze({
        ground: Object.freeze({
            surface: Object.freeze({
                jitter: false,
            }),
            accentRing: Object.freeze({
                opacity: 0.4,
                glowOpacity: 0.26,
            }),
            ripples: Object.freeze({
                enabled: true,
                duration: 1.75,
                spread: 2.4,
            }),
        }),
        float: Object.freeze({
            amplitude: 8,
            duration: 6.5,
        }),
    }),
    lethe: Object.freeze({
        ground: Object.freeze({
            accentRing: Object.freeze({
                opacity: 0.28,
            }),
            ripples: Object.freeze({
                enabled: true,
                count: 2,
                duration: 1.5,
                spread: 2.0,
            }),
        }),
        float: Object.freeze({
            amplitude: 6,
            duration: 4.2,
        }),
    }),
    sentinelFlare: Object.freeze({
        ground: Object.freeze({
            accentRing: Object.freeze({
                opacity: 0.44,
                glowOpacity: 0.28,
            }),
            ripples: Object.freeze({
                enabled: true,
                count: 2,
                duration: 1.05,
                spread: 2.2,
            }),
        }),
        float: Object.freeze({
            amplitude: 9,
            duration: 2.8,
        }),
    }),
});

const TOOLS_THEME_ARTIFACT_POLICY_OVERRIDES = Object.freeze({
    matrix: Object.freeze({
        lens: Object.freeze({ rendererFx: Object.freeze({ inactiveOpacity: 0.86 }) }),
        veil: Object.freeze({ rendererFx: Object.freeze({ inactiveOpacity: 0.86 }) }),
    }),
    cyberpunk: Object.freeze({
        lens: Object.freeze({ rendererFx: Object.freeze({ inactiveOpacity: 0.86 }) }),
        veil: Object.freeze({ rendererFx: Object.freeze({ inactiveOpacity: 0.86 }) }),
    }),
    zen: Object.freeze({
        lens: Object.freeze({
            ground: Object.freeze({
                surface: Object.freeze({
                    width: 236,
                    height: 188,
                }),
                accentRing: Object.freeze({
                    opacity: 0.1,
                    glowOpacity: 0.03,
                }),
            }),
        }),
        veil: Object.freeze({
            ground: Object.freeze({
                surface: Object.freeze({
                    width: 212,
                    height: 226,
                }),
                accentRing: Object.freeze({
                    opacity: 0.28,
                    glowOpacity: 0.14,
                }),
            }),
        }),
        resonance: Object.freeze({
            ground: Object.freeze({
                surface: Object.freeze({
                    width: 250,
                    height: 170,
                    opacity: 0.92,
                }),
                accentRing: Object.freeze({
                    opacity: 0.2,
                    glowOpacity: 0.08,
                }),
                ripples: Object.freeze({
                    enabled: true,
                    count: 2,
                    duration: 2.65,
                    spread: 1.62,
                    delayStep: 0.2,
                }),
            }),
        }),
        brake: Object.freeze({
            ground: Object.freeze({
                accentRing: Object.freeze({
                    opacity: 0.26,
                    glowOpacity: 0.08,
                }),
                ripples: Object.freeze({
                    enabled: false,
                }),
            }),
        }),
        monolith: Object.freeze({
            ground: Object.freeze({
                surface: Object.freeze({
                    width: 220,
                    height: 220,
                }),
            }),
        }),
        lethe: Object.freeze({
            ground: Object.freeze({
                accentRing: Object.freeze({
                    opacity: 0.34,
                    glowOpacity: 0.16,
                }),
            }),
        }),
        sentinelFlare: Object.freeze({
            ground: Object.freeze({
                accentRing: Object.freeze({
                    opacity: 0.46,
                    glowOpacity: 0.28,
                }),
            }),
        }),
        gate: Object.freeze({
            ground: Object.freeze({
                accentRing: Object.freeze({
                    opacity: 0.48,
                    glowOpacity: 0.3,
                }),
                ripples: Object.freeze({
                    enabled: true,
                    count: 2,
                    duration: 1.5,
                    spread: 2.35,
                    delayStep: 0.14,
                }),
            }),
        }),
    }),
});

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergePolicy(base, override) {
    if (!isPlainObject(override)) return { ...base };
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value === undefined) continue;
        const baseValue = out[key];
        if (isPlainObject(baseValue) && isPlainObject(value)) {
            out[key] = mergePolicy(baseValue, value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

function assertToolsArtifactPolicyKey(artifactKey) {
    const normalized = typeof artifactKey === 'string' ? artifactKey.trim() : '';
    if (Object.prototype.hasOwnProperty.call(TOOLS_ARTIFACT_POLICY_OVERRIDES, normalized)) {
        return normalized;
    }
    throw new Error(
        `[toolsVisualPolicy] Unknown artifact visual key "${normalized || '<empty>'}".`,
    );
}

export function getToolsArtifactSurfacePolicy(themeId) {
    const resolvedThemeId = assertThemePluginId(themeId, 'tools artifact surface policy lookup');
    const withTheme = mergePolicy(
        DEFAULT_TOOLS_VISUAL_POLICY,
        TOOLS_THEME_POLICY_OVERRIDES[resolvedThemeId],
    );
    return withTheme.artifactSurface;
}

export function getToolsVisualPolicy(themeId, artifactKey) {
    const resolvedThemeId = assertThemePluginId(themeId, 'tools visual policy lookup');
    const themeOverride = TOOLS_THEME_POLICY_OVERRIDES[resolvedThemeId];
    const themeSceneSpecOverride = TOOLS_THEME_SCENE_SPEC_OVERRIDES?.[resolvedThemeId];
    const artifactPolicyKey = assertToolsArtifactPolicyKey(artifactKey);
    const artifactOverride = TOOLS_ARTIFACT_POLICY_OVERRIDES[artifactPolicyKey];
    const themeArtifactOverride = TOOLS_THEME_ARTIFACT_POLICY_OVERRIDES?.[resolvedThemeId]?.[artifactPolicyKey];
    const themeArtifactSceneSpecOverride = TOOLS_THEME_ARTIFACT_SCENE_SPEC_OVERRIDES?.[resolvedThemeId]?.[artifactPolicyKey];

    const withTheme = mergePolicy(DEFAULT_TOOLS_VISUAL_POLICY, themeOverride);
    const withThemeSceneSpec = isPlainObject(themeSceneSpecOverride)
        ? mergePolicy(withTheme, { sceneSpec: themeSceneSpecOverride })
        : withTheme;
    const withArtifact = mergePolicy(withThemeSceneSpec, artifactOverride);
    const withThemeArtifact = mergePolicy(withArtifact, themeArtifactOverride);
    return isPlainObject(themeArtifactSceneSpecOverride)
        ? mergePolicy(withThemeArtifact, { sceneSpec: themeArtifactSceneSpecOverride })
        : withThemeArtifact;
}
