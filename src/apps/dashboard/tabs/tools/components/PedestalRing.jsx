import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const DEFAULT_GROUND_POLICY = Object.freeze({
    enabled: true,
    style: 'neutral',
    anchor: Object.freeze({
        x: 0,
        y: 0,
    }),
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
});

const MODE_STYLING = Object.freeze({
    static: Object.freeze({}),
    void: Object.freeze({
        ringColor: '#f8fafc',
        glowColor: '#ffffff',
        ringBoost: 0.88,
    }),
    hazard: Object.freeze({
        ringColor: '#ef4444',
        glowColor: '#ff2a2a',
        ringBoost: 1.18,
    }),
    distortion: Object.freeze({
        ringBoost: 1.12,
        jitter: true,
    }),
    pulse: Object.freeze({
        ringBoost: 1.04,
    }),
});

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, override) {
    if (!isPlainObject(override)) return { ...base };
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value === undefined) continue;
        const baseValue = out[key];
        if (isPlainObject(baseValue) && isPlainObject(value)) {
            out[key] = mergeDeep(baseValue, value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

function toFiniteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function CenteredLayer({
    children,
    extraTransform = '',
    className = '',
    style,
    zIndex = 0,
}) {
    const transform = `translate(-50%, -50%)${extraTransform ? ` ${extraTransform}` : ''}`;
    return (
        <div
            className={`absolute left-1/2 top-1/2 ${className}`.trim()}
            style={{ transform, zIndex, ...style }}
        >
            {children}
        </div>
    );
}

function hexToRgb(value) {
    const raw = String(value || '').replace('#', '').trim();
    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
        return {
            r: Number.parseInt(raw[0] + raw[0], 16),
            g: Number.parseInt(raw[1] + raw[1], 16),
            b: Number.parseInt(raw[2] + raw[2], 16),
        };
    }
    if (/^[0-9a-fA-F]{6}$/.test(raw)) {
        return {
            r: Number.parseInt(raw.slice(0, 2), 16),
            g: Number.parseInt(raw.slice(2, 4), 16),
            b: Number.parseInt(raw.slice(4, 6), 16),
        };
    }
    return { r: 255, g: 255, b: 255 };
}

function withAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function getSurfaceStyles(style, color, glowColor) {
    switch (style) {
        case 'zen':
            return {
                base: `radial-gradient(circle at 50% 44%, rgba(255,255,255,0.12) 0%, rgba(168,162,158,0.40) 42%, rgba(63,58,52,0.92) 100%),
                       linear-gradient(148deg, #78716c 0%, #57534e 46%, #3f3a34 100%)`,
                texture: 'repeating-radial-gradient(circle at 50% 50%, rgba(245,245,244,0.16) 0px, rgba(245,245,244,0.16) 1px, transparent 1px, transparent 9px)',
                borderColor: 'rgba(231,229,228,0.35)',
                innerBorderColor: 'rgba(245,245,244,0.28)',
            };
        case 'entropy':
            return {
                base: `radial-gradient(circle at 50% 40%, ${withAlpha(color, 0.28)} 0%, rgba(15,23,42,0.92) 54%, rgba(2,6,23,0.98) 100%),
                       linear-gradient(155deg, #020617 0%, #0f172a 52%, #020617 100%)`,
                texture: `repeating-linear-gradient(90deg, rgba(148,163,184,0.10) 0px, rgba(148,163,184,0.10) 1px, transparent 1px, transparent 8px),
                          repeating-linear-gradient(0deg, rgba(148,163,184,0.08) 0px, rgba(148,163,184,0.08) 1px, transparent 1px, transparent 8px)`,
                borderColor: withAlpha(glowColor, 0.42),
                innerBorderColor: withAlpha(color, 0.28),
            };
        case 'cyberpunk':
            return {
                base: `radial-gradient(circle at 50% 38%, ${withAlpha(color, 0.3)} 0%, rgba(8,18,38,0.92) 52%, rgba(3,5,18,0.98) 100%),
                       linear-gradient(150deg, #030712 0%, #1e1b4b 42%, #020617 100%)`,
                texture: `repeating-linear-gradient(90deg, rgba(0,243,255,0.1) 0px, rgba(0,243,255,0.1) 1px, transparent 1px, transparent 8px),
                          repeating-linear-gradient(0deg, rgba(106,92,255,0.1) 0px, rgba(106,92,255,0.1) 1px, transparent 1px, transparent 8px)`,
                borderColor: withAlpha(glowColor, 0.46),
                innerBorderColor: withAlpha(color, 0.32),
            };
        case 'clinical':
            return {
                base: `radial-gradient(circle at 50% 35%, rgba(255,255,255,0.82) 0%, rgba(226,232,240,0.75) 42%, rgba(148,163,184,0.66) 100%),
                       linear-gradient(145deg, #f8fafc 0%, #e2e8f0 56%, #cbd5e1 100%)`,
                texture: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.16) 0px, rgba(148,163,184,0.16) 1px, transparent 1px, transparent 10px)',
                borderColor: 'rgba(71,85,105,0.35)',
                innerBorderColor: 'rgba(71,85,105,0.22)',
            };
        case 'matrix':
            return {
                base: `radial-gradient(circle at 50% 42%, rgba(34,197,94,0.24) 0%, rgba(5,46,22,0.86) 44%, rgba(2,20,10,0.96) 100%),
                       linear-gradient(145deg, #052e16 0%, #14532d 52%, #052e16 100%)`,
                texture: 'repeating-linear-gradient(90deg, rgba(74,222,128,0.16) 0px, rgba(74,222,128,0.16) 1px, transparent 1px, transparent 9px)',
                borderColor: 'rgba(74,222,128,0.40)',
                innerBorderColor: 'rgba(134,239,172,0.24)',
            };
        case 'scp':
            return {
                base: `radial-gradient(circle at 50% 44%, rgba(250,204,21,0.22) 0%, rgba(55,48,20,0.80) 44%, rgba(24,24,27,0.94) 100%),
                       linear-gradient(145deg, #1f2937 0%, #111827 52%, #0b1120 100%)`,
                texture: 'repeating-linear-gradient(120deg, rgba(250,204,21,0.18) 0px, rgba(250,204,21,0.18) 6px, transparent 6px, transparent 16px)',
                borderColor: 'rgba(250,204,21,0.36)',
                innerBorderColor: 'rgba(250,204,21,0.22)',
            };
        default:
            return {
                base: `radial-gradient(circle at 50% 42%, ${withAlpha(glowColor, 0.16)} 0%, rgba(30,41,59,0.76) 44%, rgba(15,23,42,0.92) 100%),
                       linear-gradient(145deg, #0f172a 0%, #1e293b 52%, #0f172a 100%)`,
                texture: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.12) 0px, rgba(148,163,184,0.12) 1px, transparent 1px, transparent 10px)',
                borderColor: withAlpha(glowColor, 0.32),
                innerBorderColor: withAlpha(color, 0.22),
            };
    }
}

export default function PedestalRing({
    color = '#00f3ff',
    glowColor = '#00f3ff',
    mode = 'static',
    isVisible = false,
    pulseKey = 0,
    themeId = 'entropy',
    policy,
    isVolatile = false,
    isActive = true,
    depth = 0,
}) {
    const resolvedPolicy = useMemo(
        () => mergeDeep(DEFAULT_GROUND_POLICY, policy),
        [policy],
    );
    const modeStyle = MODE_STYLING[mode] || MODE_STYLING.static;
    const ringColor = modeStyle.ringColor || color;
    const ringGlowColor = modeStyle.glowColor || glowColor;
    const ringBoost = toFiniteNumber(modeStyle.ringBoost, 1);

    const anchorX = toFiniteNumber(resolvedPolicy?.anchor?.x, 0);
    const anchorY = toFiniteNumber(resolvedPolicy?.anchor?.y, 0);
    const anchorLeft = `${anchorX}px`;
    const anchorTop = `${anchorY}px`;
    const contactWidth = toFiniteNumber(resolvedPolicy?.contactShadow?.width, 170);
    const contactHeight = toFiniteNumber(resolvedPolicy?.contactShadow?.height, 36);
    const contactOpacity = toFiniteNumber(resolvedPolicy?.contactShadow?.opacity, 0.42) * (isActive ? 1 : 0.7);
    const contactBlur = toFiniteNumber(resolvedPolicy?.contactShadow?.blur, 16);

    const ambientWidth = toFiniteNumber(resolvedPolicy?.ambientShadow?.width, 260);
    const ambientHeight = toFiniteNumber(resolvedPolicy?.ambientShadow?.height, 96);
    const ambientOpacity = toFiniteNumber(resolvedPolicy?.ambientShadow?.opacity, 0.22) * (isActive ? 1 : 0.7);
    const ambientBlur = toFiniteNumber(resolvedPolicy?.ambientShadow?.blur, 40);

    const surfaceWidth = toFiniteNumber(resolvedPolicy?.surface?.width, 220);
    const surfaceHeight = toFiniteNumber(resolvedPolicy?.surface?.height, 220);
    const surfaceOpacity = toFiniteNumber(resolvedPolicy?.surface?.opacity, 0.76) * (isActive ? 1 : 0.78);
    const surfaceBlur = toFiniteNumber(resolvedPolicy?.surface?.blur, 0);
    const tiltX = toFiniteNumber(resolvedPolicy?.surface?.tiltX, 74);
    const surfaceJitter = resolvedPolicy?.surface?.jitter;
    const shouldJitter = typeof surfaceJitter === 'boolean'
        ? surfaceJitter
        : Boolean(modeStyle.jitter || isVolatile);

    const accentRingEnabled = resolvedPolicy?.accentRing?.enabled !== false;
    const accentRingOpacity = toFiniteNumber(resolvedPolicy?.accentRing?.opacity, 0.34) * ringBoost;
    const accentRingGlowOpacity = toFiniteNumber(resolvedPolicy?.accentRing?.glowOpacity, 0.18) * ringBoost;
    const accentRingThickness = toFiniteNumber(resolvedPolicy?.accentRing?.thickness, 2);

    const ripplesEnabled = resolvedPolicy?.ripples?.enabled !== false;
    const rippleCount = Math.max(1, Math.floor(toFiniteNumber(resolvedPolicy?.ripples?.count, 2)));
    const rippleDuration = toFiniteNumber(resolvedPolicy?.ripples?.duration, 1.35);
    const rippleSpread = toFiniteNumber(resolvedPolicy?.ripples?.spread, 2.1);
    const rippleDelayStep = toFiniteNumber(resolvedPolicy?.ripples?.delayStep, 0.16);

    const containerWidth = Math.max(surfaceWidth * 1.7, 260);
    const containerHeight = Math.max(surfaceHeight * 1.1, 180);
    const surfaceStyles = getSurfaceStyles(resolvedPolicy?.style || themeId, color, glowColor);
    const rippleWidth = surfaceWidth * 0.85;
    const rippleHeight = surfaceHeight * 0.85;
    const surfaceTiltScaleY = Math.max(0.18, Math.cos((tiltX * Math.PI) / 180));

    return (
        <div
            className="absolute pointer-events-none z-0"
            style={{
                left: anchorLeft,
                top: anchorTop,
                width: `${containerWidth}px`,
                height: `${containerHeight}px`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            <CenteredLayer zIndex={0}>
                <motion.div
                    className="rounded-full"
                    animate={isVisible
                        ? { opacity: [contactOpacity * 0.85, contactOpacity, contactOpacity * 0.85], scale: [1, 1.02, 1] }
                        : { opacity: 0, scale: 0.96 }}
                    transition={isVisible
                        ? { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }
                        : { duration: 0.2, ease: 'linear' }}
                    style={{
                        width: `${contactWidth}px`,
                        height: `${contactHeight}px`,
                        filter: `blur(${contactBlur}px)`,
                        background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,${contactOpacity}), transparent 72%)`,
                    }}
                />
            </CenteredLayer>

            <CenteredLayer zIndex={1}>
                <motion.div
                    className="rounded-full"
                    animate={isVisible
                        ? { opacity: [ambientOpacity * 0.8, ambientOpacity, ambientOpacity * 0.8], scale: [1, 1.03, 1] }
                        : { opacity: 0, scale: 0.95 }}
                    transition={isVisible
                        ? { duration: 6.4, repeat: Infinity, ease: 'easeInOut' }
                        : { duration: 0.2, ease: 'linear' }}
                    style={{
                        width: `${ambientWidth}px`,
                        height: `${ambientHeight}px`,
                        filter: `blur(${ambientBlur}px)`,
                        background: `radial-gradient(circle at 50% 50%, ${withAlpha(ringGlowColor, ambientOpacity * 0.55)} 0%, transparent 72%)`,
                    }}
                />
            </CenteredLayer>

            <CenteredLayer zIndex={2} extraTransform={`scaleY(${surfaceTiltScaleY})`}>
                <div
                    className="relative"
                    style={{
                        width: `${surfaceWidth}px`,
                        height: `${surfaceHeight}px`,
                    }}
                >
                    <motion.div
                        className="absolute inset-0 rounded-full overflow-hidden"
                        animate={isVisible
                            ? {
                                opacity: surfaceOpacity,
                                scale: [1, 1.008, 1],
                                x: shouldJitter ? [0, -1.5, 1.5, 0] : 0,
                            }
                            : { opacity: 0, scale: 0.94, x: 0 }}
                        transition={{
                            opacity: { duration: 0.35, ease: 'easeOut' },
                            scale: isVisible
                                ? { duration: 5.2, repeat: Infinity, ease: 'easeInOut' }
                                : { duration: 0.2, ease: 'linear' },
                            x: shouldJitter && isVisible
                                ? { duration: 0.28, repeat: Infinity, ease: 'linear' }
                                : { duration: 0.2, ease: 'easeOut' },
                        }}
                        style={{
                            filter: surfaceBlur > 0 ? `blur(${surfaceBlur}px)` : 'none',
                            backgroundImage: surfaceStyles.base,
                            border: `1px solid ${surfaceStyles.borderColor}`,
                            boxShadow: `inset 0 0 28px ${withAlpha(ringGlowColor, accentRingGlowOpacity * 0.5)}, 0 0 16px ${withAlpha(ringGlowColor, accentRingGlowOpacity * 0.55)}`,
                        }}
                    >
                        <div
                            className="absolute inset-[8%] rounded-full border"
                            style={{ borderColor: surfaceStyles.innerBorderColor }}
                        />
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                backgroundImage: surfaceStyles.texture,
                                opacity: 0.75,
                            }}
                        />
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                background: 'radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.20) 0%, transparent 64%)',
                                opacity: isActive ? 0.6 : 0.4,
                            }}
                        />
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(2,6,23,0.42) 68%, rgba(2,6,23,0.58) 100%)',
                                opacity: 0.42,
                                mixBlendMode: 'multiply',
                            }}
                        />

                        {accentRingEnabled && (
                            <motion.div
                                className="absolute inset-[16%] rounded-full"
                                animate={isVisible
                                    ? { opacity: [accentRingOpacity * 0.75, accentRingOpacity, accentRingOpacity * 0.75] }
                                    : { opacity: 0 }}
                                transition={isVisible
                                    ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                                    : { duration: 0.2, ease: 'linear' }}
                                style={{
                                    border: `${accentRingThickness}px solid ${withAlpha(ringColor, accentRingOpacity)}`,
                                    boxShadow: `0 0 14px ${withAlpha(ringGlowColor, accentRingGlowOpacity)}`,
                                }}
                            />
                        )}
                    </motion.div>

                    {isVisible && ripplesEnabled && Array.from({ length: rippleCount }).map((_, idx) => (
                        <motion.div
                            key={`ground-ripple-${pulseKey}-${idx}`}
                            className="absolute left-1/2 top-1/2 rounded-full border"
                            initial={{ opacity: 0, scale: 0.62, borderWidth: `${accentRingThickness}px` }}
                            animate={pulseKey > 0 ? {
                                opacity: [0, 0.42, 0],
                                scale: [0.62, rippleSpread],
                                borderWidth: [`${accentRingThickness}px`, '0px'],
                            } : { opacity: 0 }}
                            transition={{
                                duration: rippleDuration,
                                ease: 'circOut',
                                delay: idx * rippleDelayStep,
                                times: [0, 0.25, 1],
                            }}
                            style={{
                                width: `${rippleWidth}px`,
                                height: `${rippleHeight}px`,
                                marginLeft: `${-rippleWidth / 2}px`,
                                marginTop: `${-rippleHeight / 2}px`,
                                borderColor: withAlpha(ringColor, 0.54),
                                boxShadow: idx === 0 ? `0 0 18px ${withAlpha(ringGlowColor, 0.26)}` : 'none',
                            }}
                        />
                    ))}
                </div>
            </CenteredLayer>
        </div>
    );
}
