import React from 'react';
import { motion } from 'framer-motion';

/**
 * ScanlineOverlay
 * A digital wipe transition that opens from the center outward.
 * Overlay only (no content); it reveals whatever is underneath.
 */
export default function ScanlineOverlay({ durationMs = 1500 }) {
    const durationSec = durationMs / 1000;
    const panelTransition = { duration: durationSec, ease: 'linear' };
    const laserWidthPx = 3;
    const laserTrailPx = 64;
    const laserGlow = '0 0 12px var(--color-accent), 0 0 24px var(--color-accent)';

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
            {/* Left Panel */}
            <motion.div
                className="absolute inset-y-0 left-0 bg-[var(--color-background)]"
                initial={{ width: '50%' }}
                animate={{ width: '0%' }}
                transition={panelTransition}
            />

            {/* Right Panel */}
            <motion.div
                className="absolute inset-y-0 right-0 bg-[var(--color-background)]"
                initial={{ width: '50%' }}
                animate={{ width: '0%' }}
                transition={panelTransition}
            />

            {/* Left Scanline */}
            <motion.div
                className="absolute top-0 bottom-0"
                style={{
                    width: `${laserWidthPx}px`,
                    background: 'var(--color-accent)',
                    boxShadow: laserGlow,
                }}
                initial={{ left: '50%', opacity: 0, scaleY: 0 }}
                animate={{
                    left: '0%',
                    scaleY: 1,
                    opacity: [0, 1, 1, 0]
                }}
                transition={{
                    left: panelTransition,
                    scaleY: { duration: 0.1 },
                    opacity: {
                        times: [0, 0.1, 0.9, 1],
                        duration: durationSec,
                        ease: 'linear'
                    }
                }}
            >
                <div
                    className="absolute inset-y-0 left-full"
                    style={{
                        width: `${laserTrailPx}px`,
                        background: 'linear-gradient(90deg, var(--color-accent), rgba(0, 0, 0, 0))',
                        opacity: 0.6,
                    }}
                />
            </motion.div>

            {/* Right Scanline */}
            <motion.div
                className="absolute top-0 bottom-0"
                style={{
                    width: `${laserWidthPx}px`,
                    background: 'var(--color-accent)',
                    boxShadow: laserGlow,
                }}
                initial={{ right: '50%', opacity: 0, scaleY: 0 }}
                animate={{
                    right: '0%',
                    scaleY: 1,
                    opacity: [0, 1, 1, 0]
                }}
                transition={{
                    right: panelTransition,
                    scaleY: { duration: 0.1 },
                    opacity: {
                        times: [0, 0.1, 0.9, 1],
                        duration: durationSec,
                        ease: 'linear'
                    }
                }}
            >
                <div
                    className="absolute inset-y-0 right-full"
                    style={{
                        width: `${laserTrailPx}px`,
                        background: 'linear-gradient(270deg, var(--color-accent), rgba(0, 0, 0, 0))',
                        opacity: 0.6,
                    }}
                />
            </motion.div>
        </div>
    );
}
