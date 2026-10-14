import React, { useMemo } from 'react';
import './ZenShojiVisualCore.css';

import {
    withAlpha,
    requireUnitInterval,
    requireBoolean,
    requireMotionBudgetMode,
    requireAccessibility,
    buildFrameBarBackground,
    buildFrameBarShadow,
    buildFaceFinishBackground,
    getFaceFinishOpacity,
    buildKumikoBackground,
    buildKumikoShadow,
    buildFaceMaterials,
    CUBE_SIZE,
    FACE_EDGE_OVERLAP_PX,
    FRAME_THICKNESS,
    CUBE_ROTATION,
    GEOMETRY_MODEL,
    MOTION_MODEL,
    MOTION_POLICY,
    CAMERA_MODEL,
    SURFACE_TREATMENT,
    FLOAT_BASE_Y,
    FLOAT_VERTICAL_DURATION_SECONDS,
    FACE_DEFS,
    FRAME_BARS,
    KUMIKO_LINES,
    buildZenShojiPalette
} from './zenShojiRecipe.js';

export default function ZenShojiVisualCore({
    nightDepth,
    shouldAnimateFloat,
    motionBudgetMode,
    ariaHidden,
    ariaLabel,
}) {
    const resolvedNightDepth = requireUnitInterval(nightDepth, 'NIGHT_DEPTH');
    const resolvedShouldAnimateFloat = requireBoolean(
        shouldAnimateFloat,
        'SHOULD_ANIMATE_FLOAT',
    );
    const resolvedMotionBudgetMode = requireMotionBudgetMode(motionBudgetMode);
    const accessibility = requireAccessibility({ ariaHidden, ariaLabel });
    const floatAnimation = resolvedShouldAnimateFloat
        ? `zenShojiFloatAxis ${FLOAT_VERTICAL_DURATION_SECONDS}s ease-in-out infinite`
        : 'none';
    const shadowAnimation = resolvedShouldAnimateFloat
        ? `zenShojiFloatShadow ${FLOAT_VERTICAL_DURATION_SECONDS}s ease-in-out infinite`
        : 'none';

    const palette = useMemo(
        () => buildZenShojiPalette(resolvedNightDepth),
        [resolvedNightDepth],
    );

    const faceMaterials = useMemo(
        () => buildFaceMaterials({ palette, nightDepth: resolvedNightDepth }),
        [palette, resolvedNightDepth],
    );

    return (
        <div
            role={accessibility.role}
            aria-label={accessibility.ariaLabel}
            aria-hidden={accessibility.ariaHidden}
            data-shoji-cube="root"
            data-shoji-geometry={GEOMETRY_MODEL}
            data-shoji-camera={CAMERA_MODEL}
            data-shoji-motion-model={MOTION_MODEL}
            data-shoji-motion-policy={MOTION_POLICY}
            data-shoji-surface-treatment={SURFACE_TREATMENT}
            data-shoji-float-system="centered-vertical"
            data-shoji-float-periods={`${FLOAT_VERTICAL_DURATION_SECONDS}s`}
            data-shoji-float-active={resolvedShouldAnimateFloat ? 'true' : 'false'}
            data-shoji-motion-budget={resolvedMotionBudgetMode}
            data-shoji-edge-treatment="overlapped-face-planes"
            style={{
                position: 'relative',
                display: 'flex',
                width: 340,
                height: 340,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
                pointerEvents: 'none',
                perspective: '1200px',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: 30,
                    width: 220,
                    height: 40,
                    transform: 'translateX(-50%)',
                }}
            >
                <div
                    data-shoji-float-shadow="organic"
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '100%',
                        background: `radial-gradient(ellipse at center, ${withAlpha(palette.woodShadow, 0.42)} 0%, rgba(0,0,0,0) 70%)`,
                        filter: 'blur(15px)',
                        opacity: 0.58,
                        transformOrigin: '50% 50%',
                        animation: shadowAnimation,
                    }}
                />
            </div>

            <div
                aria-hidden="true"
                style={{
                    position: 'relative',
                    zIndex: 10,
                    width: CUBE_SIZE,
                    height: CUBE_SIZE,
                    transformStyle: 'preserve-3d',
                    transform: `translateY(${FLOAT_BASE_Y}px)`,
                }}
            >
                <div
                    data-shoji-float-axis="vertical"
                    style={{
                        width: '100%',
                        height: '100%',
                        transformStyle: 'preserve-3d',
                        animation: floatAnimation,
                    }}
                >
                    <div
                        data-shoji-cube="body"
                        style={{
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            transformStyle: 'preserve-3d',
                            transform: `rotateX(${CUBE_ROTATION.x}deg) rotateY(${CUBE_ROTATION.y}deg)`,
                        }}
                    >
                        {FACE_DEFS.map((face) => {
                            const material = faceMaterials[face.type];
                            const faceFinishOpacity = getFaceFinishOpacity(
                                face.type,
                                resolvedNightDepth,
                            );
                            return (
                                <div
                                    key={face.id}
                                    data-shoji-face={face.id}
                                    style={{
                                        position: 'absolute',
                                        inset: -FACE_EDGE_OVERLAP_PX,
                                        transform: face.transform,
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                        overflow: 'hidden',
                                        transformStyle: 'preserve-3d',
                                    }}
                                >
                                    <div
                                        data-shoji-paper-surface={face.id}
                                        style={{
                                            position: 'absolute',
                                            inset: FRAME_THICKNESS,
                                            background: material.paper,
                                            boxShadow: `inset 0 0 22px ${withAlpha(palette.woodShadow, 0.34)}, inset 0 0 0 1px ${withAlpha(palette.woodShadow, 0.28)}`,
                                            overflow: 'hidden',
                                            isolation: 'isolate',
                                        }}
                                    >
                                        <div
                                            data-shoji-paper-shade={face.id}
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                pointerEvents: 'none',
                                                background: material.paperShade,
                                            }}
                                        />

                                        {KUMIKO_LINES.map((line) => (
                                            <div
                                                key={line.id}
                                                style={{
                                                    position: 'absolute',
                                                    left: line.left,
                                                    top: line.top,
                                                    width: line.width,
                                                    height: line.height,
                                                    background: buildKumikoBackground(line.id, palette, material.woodBase, face.type),
                                                    boxShadow: buildKumikoShadow(palette, face.type),
                                                }}
                                            />
                                        ))}
                                    </div>

                                    <div
                                        data-shoji-face-finish={face.id}
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            pointerEvents: 'none',
                                            background: buildFaceFinishBackground(face.type, palette),
                                            mixBlendMode: 'soft-light',
                                            opacity: faceFinishOpacity * (1 - resolvedNightDepth),
                                        }}
                                    />

                                    <div
                                        data-shoji-face-night-finish={face.id}
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            pointerEvents: 'none',
                                            background: buildFaceFinishBackground(face.type, palette),
                                            mixBlendMode: 'screen',
                                            opacity: faceFinishOpacity * resolvedNightDepth,
                                        }}
                                    />

                                    {FRAME_BARS.map((bar) => (
                                        <div
                                            key={bar.id}
                                            data-shoji-frame-bar={`${face.id}-${bar.id}`}
                                            style={{
                                                position: 'absolute',
                                                pointerEvents: 'none',
                                                ...bar.style,
                                                background: buildFrameBarBackground(bar.id, palette, material.woodBase, face.type),
                                                boxShadow: buildFrameBarShadow(bar.id, palette, face.type),
                                            }}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
